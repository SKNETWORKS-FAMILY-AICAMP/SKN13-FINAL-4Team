# backend/chat/agent/agent.py
import asyncio
import uuid
from datetime import datetime
from typing import Callable
import time
from .state import AgentState
from .classifiers import LiteClassifier, EmotionClassifier
from .topic import TopicThreading
from .queue_manager import QueueManager
from .responder import Responder
from .pipeline import GraphPipeline
from .idle import IdleManager
from ..response_manager import ResponseManager
from ..activity_manager import ActivityManager
from .story import StoryRepository
from .db import UserDB, Utils
from langchain_openai import ChatOpenAI, OpenAIEmbeddings
from langchain_core.messages import HumanMessage
from ..services.persona_loader import load_persona_profile

class LoveStreamerAgent:
    """통합 에이전트"""
    def __init__(self, api_key: str, story_repo: StoryRepository, streamer_id: str = None):
        self.llm = ChatOpenAI(model="gpt-4o", temperature=0.2, api_key=api_key)
        self.fast_llm = ChatOpenAI(model="gpt-4o-mini", temperature=0.2, api_key=api_key)
        self.embeddings = OpenAIEmbeddings(model="text-embedding-3-small", api_key=api_key)
        self.lite = LiteClassifier(self.fast_llm)
        self.topic = TopicThreading(self.fast_llm, self.embeddings)
        self.queue = QueueManager(self.topic, trigger_graph_cb=self.trigger_graph_async, broadcast_cb=self.broadcast_queue_state)
        self.emotion_cls = EmotionClassifier(self.fast_llm)
        self.responder = Responder(self, self.llm, self.emotion_cls, streamer_id=streamer_id) # self(agent) 전달
        self.idle = IdleManager(self, self.llm, self.queue, story_repo, self.responder, streamer_id=streamer_id) # self(agent) 전달
        self.graph = GraphPipeline(self.responder, self.queue, UserDB()).build()
        self.superchat_q = asyncio.Queue()
        self.streamer_id = streamer_id
        self.persona_profile = {} # 페르소나 프로필을 저장할 변수
        # Managers (외부에서 주입)
        self.response_manager: ResponseManager | None = None
        self.activity_manager: ActivityManager | None = None
        self.idle_task = None
        self.superchat_task = None

        self.idle.set_graph_trigger(self.trigger_graph_async)
        self.idle.set_bootstrap_helpers(
            topic_label_fn=lambda: self.topic.topic_ctx.get("active_label") or "",
            bootstrap_fn=self._bootstrap_topic_from_tail
        )
        self.graph.idle_mgr = self.idle

    @classmethod
    async def create(cls, api_key: str, story_repo: StoryRepository, streamer_id: str = None):
        """비동기 초기화를 포함한 에이전트 생성 팩토리 메서드"""
        agent = cls(api_key, story_repo, streamer_id)
        await agent._load_persona()
        return agent

    def run(self):
        """에이전트의 백그라운드 작업을 시작합니다."""
        if self.idle_task is None:
            self.idle_task = asyncio.create_task(self.idle.idle_loop())
            print(f"✅ [{self.streamer_id}] IdleManager task started.")
        if self.superchat_task is None:
            self.superchat_task = asyncio.create_task(self.superchat_worker_coro())
            print(f"✅ [{self.streamer_id}] Superchat worker task started.")

    def shutdown(self):
        """에이전트의 모든 백그라운드 작업을 종료합니다."""
        print(f"🗑️ [{self.streamer_id}] LoveStreamerAgent shutting down...")
        if self.idle_task:
            self.idle_task.cancel()
            self.idle_task = None
            print(f"🛑 [{self.streamer_id}] IdleManager task cancelled.")
        if self.superchat_task:
            self.superchat_task.cancel()
            self.superchat_task = None
            print(f"🛑 [{self.streamer_id}] Superchat worker task cancelled.")

    async def _load_persona(self):
        """DB에서 페르소나 프로필을 로드하여 인스턴스에 저장"""
        if self.streamer_id:
            self.persona_profile = await load_persona_profile(self.streamer_id)
            if self.persona_profile:
                print(f"✅ [{self.streamer_id}] 페르소나 로드 완료.")
            else:
                print(f"⚠️ [{self.streamer_id}] 페르소나를 찾을 수 없습니다. 기본 프롬프트로 동작합니다.")

    def _compact_result_from_state(self, state: dict) -> dict:
        return {
            "assistant_text": Utils.text_of(state["messages"][-1]) if state.get("messages") else None,
            "emotion": state.get("assistant_emotion"),
            "categories": state.get("categories", []),
        }

    async def on_new_input_async(self, input_msg: dict):
        # 활동 마킹 (가능한 즉시)
        try:
            if self.activity_manager:
                content = input_msg.get("content", "") or ""
                self.activity_manager.mark_activity(
                    source="agent_input",
                    details=f"len={len(content)} type={input_msg.get('type','')}",
                    user_info={"user_id": input_msg.get("user_id")}
                )
        except Exception:
            pass
        msg_type = input_msg.get("type", "normal")
        content = input_msg.get("content", "")
        msg_id = input_msg.get("msg_id") or str(uuid.uuid4())
        if "msg_id" not in input_msg:
            input_msg = {**input_msg, "msg_id": msg_id}

        if msg_type == "superchat" and content:
            self.queue.mark_event()
            await self.superchat_q.put(dict(input_msg))
            return {"routed": "superchat_async_worker", "state": None, "result": None}

        if msg_type == "normal" and content:
            self.queue.mark_event()
            await self.queue.enqueue_general_chat(input_msg, self.lite)
            await asyncio.sleep(0.1)
            await self.queue.wait_graph_idle(1.0)

        state = self.graph.agent_state
        return {"state": state, "result": self._compact_result_from_state(state)}

    def trigger_graph_async(self, reason: str = ""):
        print(f"[trigger_graph_async] Triggered (reason={reason})")
        # 이미 그래프가 실행 중이면 무시하여 중복 실행 방지
        if not self.queue.is_busy():
            asyncio.create_task(self.graph.run_one_turn())
        else:
            print(f"[trigger_graph_async] Graph is busy, ignoring trigger: {reason}")

    def _bootstrap_topic_from_tail(self):
        with self.queue._q_lock:
            gq = self.queue.general_queue
            if not self.topic.topic_ctx.get("active_tid") and len(gq) > 0:
                last = gq[-1]
                tid, label = last.get("thread_id"), last.get("topic", "일반")
                self.topic.topic_ctx.update({"active_tid": tid, "active_label": label, "score": self.topic.TOPIC_SCORE_TRIGGER, "started_at": time.monotonic()})

    async def superchat_worker_coro(self):
        """Superchat queue consumer coroutine"""
        while True:
            try:
                msg = await self.superchat_q.get()
                print(f"💰 Handling superchat: {msg}")
                
                # 후원 메시지를 AI 응답 생성 파이프라인으로 전달
                superchat_state = {
                    "messages": [],
                    "type": "superchat", 
                    "categories": ["후원", "감사"], 
                    "best_chat": msg.get("content", ""),
                    "user_id": msg.get("user_id", "anonymous"),
                    "chat_date": msg.get("chat_date", datetime.now().strftime("%Y-%m-%d %H:%M:%S")),
                    "db_greeting_info": {"exists": False},
                    "__no_selection": False,
                    "assistant_emotion": "grateful",
                    "msg_id": None,
                    "metadata": msg.get("metadata", {})
                }
                
                # 후원 전용 응답 생성
                response = await self.responder.generate_final_response(superchat_state, source="superchat")
                
                # 응답이 생성되었다면 TTS 및 미디어 처리
                if response and response.get("assistant_text"):
                    print(f"✨ Generated superchat response: {response['assistant_text']}")
                    
                    # MediaPacket 생성 및 스트리밍 큐로 전송
                    if hasattr(self.responder, 'media_processor') and hasattr(self.responder, 'stream_session'):
                        try:
                            # 후원 응답용 미디어 패킷 생성
                            media_packet = await self.responder.media_processor.create_media_packet(
                                ai_response=response["assistant_text"],
                                streamer_config={
                                    'streamer_id': self.streamer_id,
                                    'tts_engine': 'elevenlabs',
                                    'elevenlabs_voice': 'aneunjin',
                                    'elevenlabs_model': 'eleven_multilingual_v2'
                                },
                                context={
                                    'type': 'superchat_response',
                                    'user_id': msg.get('user_id'),
                                    'amount': msg.get('metadata', {}).get('amount', 0)
                                }
                            )
                            
                            if media_packet:
                                # 스트리밍 세션에 미디어 패킷 추가
                                await self.responder.stream_session.enqueue_response(media_packet)
                                print(f"🎬 Superchat MediaPacket queued for streaming")
                            else:
                                print("❌ Failed to create MediaPacket for superchat")
                                
                        except Exception as e:
                            print(f"❌ Error creating superchat media: {e}")
                            import traceback
                            traceback.print_exc()
                    else:
                        print("⚠️ Media processor or stream session not available")
                else:
                    print("⚠️ No response generated for superchat")
                    
            except asyncio.CancelledError:
                print("Superchat worker task cancelled.")
                break
            except Exception as e:
                print(f"❌ Error handling superchat: {e}")
                import traceback
                traceback.print_exc()
            finally:
                if 'msg' in locals() and self.superchat_q.empty():
                    self.superchat_q.task_done()

    async def broadcast_queue_state(self, room_id: str):
        """큐 상태를 프론트엔드에 브로드캐스트"""
        if not self.streamer_id or not room_id:
            return
            
        try:
            from channels.layers import get_channel_layer
            
            channel_layer = get_channel_layer()
            room_group_name = f'streaming_chat_{room_id}'
            
            # 실제 큐 상태 정보 구성 (QueueManager + StreamSession 통합)
            detailed_info = self._build_real_queue_info()
            
            # 프론트엔드가 기대하는 상세한 큐 상태 정보 구성
            queue_info = {
                'type': 'queue_debug_update',
                'detailed_queue_info': detailed_info if detailed_info else {
                    'request_queue': {
                        'pending_requests': [
                            {
                                'id': i,
                                'content': msg.get('content', '')[:50] + '...' if len(msg.get('content', '')) > 50 else msg.get('content', ''),
                                'user_id': msg.get('user_id', 'unknown'),
                                'topic': msg.get('topic', '일반'),
                                'salience': msg.get('salience', 0.0),
                                'timestamp': msg.get('ts', 0)
                            }
                            for i, msg in enumerate(list(self.queue.general_queue)[-5:])  # 최근 5개만
                        ],
                        'current_processing': None,
                        'total_pending': len(self.queue.general_queue)
                    },
                    'response_queue': {
                        'pending_responses': [],
                        'current_playing': None,
                        'total_pending': self.superchat_q.qsize()
                    },
                    'recent_history': [],
                    'metrics': {
                        'total_processed': len(self.queue.general_queue),
                        'success_rate': 0.95,
                        'avg_response_time': 2.3,
                        'current_load': min(1.0, len(self.queue.general_queue) / 10.0)
                    },
                    'current_seq': 0
                },
                'session_info': {
                    'queue_length': len(self.queue.general_queue),
                    'superchat_queue_length': self.superchat_q.qsize(),
                    'current_topic': self.topic.topic_ctx.get("active_label", "없음"),
                    'is_processing': self.queue.is_busy(),
                    'agent_status': 'active'
                },
                'queue_status': {
                    'lastProcessedSeq': detailed_info.get('current_seq', 0),
                    'connectionStatus': 'connected',
                    'lastUpdate': datetime.now().isoformat()
                },
                'timestamp': datetime.now().isoformat()
            }
            
            await channel_layer.group_send(
                room_group_name,
                queue_info
            )
        except Exception as e:
            print(f"큐 상태 브로드캐스트 실패: {e}")

    def _build_real_queue_info(self):
        """실제 큐 상태 정보 구성 (QueueManager + StreamSession 통합)"""
        from datetime import datetime
        import time
        
        # QueueManager의 실제 general_queue 정보
        pending_requests = []
        with self.queue._q_lock:
            for index, msg in enumerate(list(self.queue.general_queue)[-10:]):  # 최근 10개
                pending_requests.append({
                    "position": index + 1,
                    "message": msg.get('content', '')[:50],
                    "username": msg.get('user_id', 'unknown'),
                    "user_id": msg.get('user_id'),
                    "topic": msg.get('topic', '일반'),
                    "salience": msg.get('salience', 0.0),
                    "timestamp": msg.get('ts', time.monotonic()),
                    "waiting_time": max(0, time.monotonic() - msg.get('ts', time.monotonic()))
                })
        
        # 현재 처리 중인 정보
        current_processing = None
        if self.queue.is_busy():
            current_processing = {
                "status": "processing",
                "topic": self.topic.topic_ctx.get("active_label", "일반"),
                "started_at": time.monotonic()
            }
        
        # StreamSession Response Queue 정보
        response_queue_info = {"length": 0, "pending_packets": []}
        if hasattr(self.responder, 'stream_session') and self.responder.stream_session:
            session = self.responder.stream_session
            response_queue_info["length"] = session.response_queue.qsize()
            
        # Superchat Queue 정보
        superchat_queue_length = self.superchat_q.qsize()
        
        return {
            "session_id": getattr(self.responder, 'stream_session', {}).session_id if hasattr(self.responder, 'stream_session') else "unknown",
            "timestamp": int(time.time() * 1000),
            
            # Request Queue 상태 (실제 QueueManager 데이터)
            "request_queue": {
                "length": len(self.queue.general_queue),
                "is_processing": self.queue.is_busy(),
                "current_processing": current_processing,
                "pending_requests": pending_requests,
            },
            
            # Response Queue 상태 (실제 StreamSession 데이터)
            "response_queue": {
                "length": response_queue_info["length"],
                "is_playing": False,  # 현재 재생 상태는 클라이언트에서 관리
                "current_playing": None,
                "pending_packets": response_queue_info["pending_packets"],
                "total_played": 0
            },
            
            # Superchat Queue 상태
            "superchat_queue": {
                "length": superchat_queue_length,
                "pending_superchats": []
            },
            
            # 기본 상태 정보
            "queue_length": len(self.queue.general_queue),
            "is_processing": self.queue.is_busy(),
            "current_seq": getattr(getattr(self.responder, 'stream_session', None), 'seq', 0),
            "uptime_ms": int(time.time() * 1000),
            
            # 메트릭
            "metrics": {
                "total_processed": len(self.queue.general_queue),
                "success_rate": 0.95,
                "avg_response_time": 3.2,
                "current_load": min(1.0, len(self.queue.general_queue) / 10.0),
                "current_topic": self.topic.topic_ctx.get("active_label", "없음")
            },
            
            # 최근 처리 이력 (임시)
            "recent_history": [
                {
                    "timestamp": int(time.time() * 1000) - (i * 30000),
                    "message": f"처리된 메시지 {i+1}",
                    "username": "user_example",
                    "status": "completed",
                    "processing_time": 2.5 + (i * 0.3)
                }
                for i in range(min(3, len(self.queue.general_queue)))
            ]
        }
