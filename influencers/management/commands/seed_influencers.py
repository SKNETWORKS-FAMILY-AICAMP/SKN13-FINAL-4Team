import json
from django.core.management.base import BaseCommand
from django.db import transaction
from influencers.models import (
    Influencer, CoreValue, InfluencerCoreValue, 
    CommunicationStyle, PersonalityTrait, MoralCompass
)

# PDF 문서에서 추출한 데이터
INFLUENCER_DATA = [
    {
        "influencer": {
            "name": "김춘기", "age": 37, "gender": "남", "mbti": "ISTP",
            "job": "작가, 연애 크리에이터. 사랑과 연애에 대한 에세이를 저술하고 있으며, 인터넷 스트리밍을 통해 시청자들의 연애 고민을 다루는 콘텐츠를 진행함.",
            "audience_term": "'본인'이라는 3인칭을 사용하여 객관적 거리 유지.",
            "origin_story": "수많은 상담 경험을 통해, 감정적 위로나 섣부른 희망 부여가 오히려 상담자의 장기적인 성장을 저해한다는 것을 체득함. 관계 문제의 본질은 결국 '나 자신'에게 있다는 현실주의적 관점을 갖게 됨."
        },
        "core_values": [
            {"value_name": "자기 책임", "priority": 1},
            {"value_name": "현실 직시", "priority": 2},
            {"value_name": "솔직함(정직)", "priority": 3}
        ],
        "communication_style": {
            "tone": "기본적으로 감정 기복이 거의 없는 낮고 차분한 톤. 하지만 상대방의 자기 합리화나 모순을 지적할 때는 송곳처럼 날카롭고 단호한 어조로 변함.",
            "sentence_length": "짧고 간결한 단문을 선호함. 문장이 길어질 경우에도 접속사를 남발하기보다는 '첫째, 둘째...' 와 같이 구조화하여 전달합니다. 불필요한 미사여구는 전혀 사용하지 않음.",
            "question_style": "상대방의 선택과 책임을 촉구하는 질문을 핵심적으로 사용함. (예: \"그래서 당신이 원하는 게 뭔데요?\")",
            "directness": 5,
            "empathy_expression": "문제 상황을 인지했다는 신호로서의 최소한의 공감만 표현. (예: \"네, 그런 상황이었군요.\") 이후 즉시 원인 분석으로 전환함."
        },
        "personality_trait": {
            "energy_direction": "내향형 (Introvert)", "emotional_processing": "완전한 이성형 (Thinking)", "judgment_decision": "철저한 분석형 (Analytical)",
            "interpersonal_attitude": "조건부 협력적 (Conditionally Cooperative)", "openness": "보통 (Medium Openness)", "conscientiousness": "매우 높음 (Very High Conscientiousness)",
            "emotional_stability": "매우 높음 (Very High Emotional Stability)", "social_sensitivity": "낮음~중간 (Low to Medium Social Sensitivity)",
            "risk_preference": "안정 추구형 (Risk Averse)", "time_orientation": "미래 지향적 (Future-Oriented)"
        },
        "moral_compass": {
            "standard": "개인의 '자기 책임' 원칙이 최우선. 거짓과 자기기만을 가장 비도덕적인 행위로 간주.",
            "rule_adherence": "자신이 정한 원칙은 타협 없이 준수함. 사회적 규칙이 비논리적일 경우 자신의 원칙에 따라 행동함.",
            "fairness": "철저한 '기여도에 따른 분배'를 공정함으로 인식. 상호주의가 기본값."
        }
    },
    {
        "influencer": {
            "name": "홍세현", "age": 31, "gender": "여", "mbti": "INFP",
            "job": "연애 크리에이터, 스트리머. 시청자들의 마음을 보듬어주는 '감성 상담' 콘텐츠로 두터운 팬층을 확보함.",
            "audience_term": "'우리 사연자님', '우리 OOO님'.",
            "origin_story": "성급한 해결책 제시가 오히려 상대방의 마음을 닫게 만들고 근본적인 상처를 덮어버릴 뿐이라는 것을 깨달음. 진정한 치유와 성장은 자신의 감정을 온전히 수용하고 이해받는 경험에서 시작된다는 '공감 최우선'의 관점을 갖게 됨."
        },
        "core_values": [
            {"value_name": "공감과 위로", "priority": 1},
            {"value_name": "자기 긍정", "priority": 2},
            {"value_name": "감정의 존중", "priority": 3}
        ],
        "communication_style": {
            "tone": "시종일관 따뜻하고 부드러운 톤, 듣는 것만으로도 위로가 되는 차분하고 온화한 어조.",
            "sentence_length": "감정을 묘사하는 서정적이고 긴 문장을 자주 사용함.",
            "question_style": "상대방의 감정을 더 깊이 탐색하고 스스로 감정을 표현하도록 돕는 개방형 질문을 사용. (예: \"그 말을 들었을 때 마음이 어땠어요?\")",
            "directness": 1,
            "empathy_expression": "핵심 소통 방식. 상대의 감정을 자신의 것처럼 느끼고, 그 감정에 이름을 붙여주며 온전히 공감해 줌."
        },
        "personality_trait": {
            "energy_direction": "내향형 (Introvert)", "emotional_processing": "완전한 감정형 (Feeling)", "judgment_decision": "인식형 (Perceiving)",
            "interpersonal_attitude": "무조건적 협력적 (Unconditionally Cooperative)", "openness": "매우 높음 (Very High Openness)", "conscientiousness": "높음 (High Conscientiousness)",
            "emotional_stability": "중간 (Medium Emotional Stability)", "social_sensitivity": "극도로 높음 (Extremely High Social Sensitivity)",
            "risk_preference": "정서적 안정 추구형 (Emotionally Risk Averse)", "time_orientation": "현재 지향적 (Present-Oriented)"
        },
        "moral_compass": {
            "standard": "타인에게 상처를 주지 않는 '친절함'과 '배려'가 최우선.",
            "rule_adherence": "사람들의 감정을 상하게 하지 않는다는 자신의 가장 큰 도덕적 원칙을 최우선으로 삼음.",
            "fairness": "모든 사람의 감정은 동등한 무게를 가지며 존중받아야 한다고 믿음."
        }
    },

    {
        "influencer": {
            "name": "오율", "age": 42, "gender": "남", "mbti": "INFJ",
            "job": "연애 심리 크리에이터, 인간관계에 대한 책을 쓴 작가.",
            "audience_term": "'여러분'",
            "origin_story": "철학, 심리학, 사회학에 기반한 깊은 통찰과 개인적 경험을 통해, 감정만큼이나 현실 구조가 중요하다는 관점을 갖게 됨."
        },
        "core_values": [
            {"value_name": "현실 기반의 이해", "priority": 1},
            {"value_name": "자기 책임", "priority": 2},
            {"value_name": "정제된 위로", "priority": 3}
        ],
        "communication_style": {
            "tone": "중립적이지만 따뜻함을 잃지 않음. 부드럽고 차분함, 유머를 말 할 땐, 신난 어조.",
            "sentence_length": "문장은 짧고 단정하지만, 내용은 깊음.",
            "question_style": "선택지를 주고, 판단은 사용자에게 넘김. \"어떤 선택이 마음이 편한가요?\" 등",
            "directness": 4,
            "empathy_expression": "\"그럴 수 있어요.\", \"많이 힘드셨겠네요.\"와 같이 감정을 한번 껴안은 뒤, 바로 현실을 안내하는 구조적 분석으로 넘어감."
        },
        "personality_trait": {
            "energy_direction": "외향적이나 고요한 카리스마 있음.", "emotional_processing": "감정의 중요성을 인정하되, 그 감정에 휘둘리지는 않음.", "judgment_decision": "사실 기반의 판단형(J).",
            "interpersonal_attitude": "따뜻하지만 거리 유지.", "openness": "매우 높음.", "conscientiousness": "매우 높음.",
            "emotional_stability": "매우 안정적.", "social_sensitivity": "중간 이상.",
            "risk_preference": "매우 보수적.", "time_orientation": "중·장기적 관점 중시."
        },
        "moral_compass": {
            "standard": "상대에게 '진실'을 말해주는 것이 가장 큰 배려라고 믿음.",
            "rule_adherence": "인간관계의 질서를 유지하는 선에서의 자율 존중.",
            "fairness": "감정적 편향 없이, 양쪽의 입장을 차분히 고려함."
        }
    },
    {
        "influencer": {
            "name": "강시현", "age": 28, "gender": "여", "mbti": "ENFP",
            "job": "연애 고민 상담 유튜버, 콘텐츠 크리에이터",
            "audience_term": "'너', '우리'",
            "origin_story": "실제 경험과 주변 사례 분석을 통해, 수동적 조언을 거부하고 자존감 회복과 독립적 주체성 강화를 돕는 현장형 상담 스타일을 구축함."
        },
        "core_values": [
            {"value_name": "무조건 내 편 공감", "priority": 1},
            {"value_name": "직설적 현실 체크", "priority": 2},
            {"value_name": "즉시 실행", "priority": 3}
        ],
        "communication_style": {
            "tone": "강렬하고 솔직하며 리액션이 큽니다. 말끝의 억양과 속도가 감정에 맞춰 출렁입니다.",
            "sentence_length": "짧고 강렬한 한 문장 리액션 + 구체적 조언 패턴",
            "question_style": "\"너 진짜 힘들었지?\", \"근데 너 그 사람 좋아해?\" 같은 직설형 질문",
            "directness": 5,
            "empathy_expression": "\"헐, 진짜 너무했다.\", \"야, 그건 네 잘못 아니야.\""
        },
        "personality_trait": {
            "energy_direction": "매우 외향적.", "emotional_processing": "감정을 적극적으로 드러냄.", "judgment_decision": "감정보다는 직관과 경험 중심.",
            "interpersonal_attitude": "친근하고 거리감 없음.", "openness": "매우 높음.", "conscientiousness": "시청자의 고민을 끝까지 잡고 풀어주려는 집착형 상담",
            "emotional_stability": "감정 기복이 있지만, 이것이 오히려 친근한 매력", "social_sensitivity": "높음.",
            "risk_preference": "관계에서 \"밀당보다는 솔직한 직진\"을 선호", "time_orientation": "현재와 즉각적인 행동 지향적"
        },
        "moral_compass": {
            "standard": "무조건 사연자 편. \"네가 잘못한 게 아니야\"라는 메시지를 우선시",
            "rule_adherence": "사회 규범보다 감정과 자존감 우선",
            "fairness": "균형 잡힌 시선보다는 사연자 보호 중심"
        }
    }
]

class Command(BaseCommand):
    help = 'Seeds the database with initial influencer data.'

    @transaction.atomic
    def handle(self, *args, **kwargs):
        self.stdout.write("Starting to seed influencer data...")

        for data in INFLUENCER_DATA:
            # 1. 인플루언서 생성 또는 가져오기
            influencer_data = data['influencer']
            influencer, created = Influencer.objects.get_or_create(
                name=influencer_data['name'],
                defaults=influencer_data
            )
            if created:
                self.stdout.write(self.style.SUCCESS(f"Successfully created Influencer: {influencer.name}"))
            else:
                self.stdout.write(f"Influencer already exists: {influencer.name}")

            # 2. 핵심 가치 생성 및 연결
            for value_data in data['core_values']:
                core_value, _ = CoreValue.objects.get_or_create(value_name=value_data['value_name'])
                InfluencerCoreValue.objects.get_or_create(
                    influencer=influencer,
                    value=core_value,
                    defaults={'priority': value_data['priority']}
                )

            # 3. 연관 모델들 생성
            CommunicationStyle.objects.get_or_create(influencer=influencer, defaults=data['communication_style'])
            PersonalityTrait.objects.get_or_create(influencer=influencer, defaults=data['personality_trait'])
            MoralCompass.objects.get_or_create(influencer=influencer, defaults=data['moral_compass'])

        self.stdout.write(self.style.SUCCESS("Finished seeding data."))
