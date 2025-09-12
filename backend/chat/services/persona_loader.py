# backend/chat/services/persona_loader.py
from channels.db import database_sync_to_async
from influencers.models import (
    Influencer,
    InfluencerCoreValue,
    CommunicationStyle,
    MoralCompass,
    PersonalityTrait
)

@database_sync_to_async
def load_persona_profile(streamer_name: str) -> dict:
    """
    스트리머의 이름(활동명)을 기반으로 DB에서 모든 페르소나 정보를 조회하고
    구조화된 딕셔너리로 반환합니다.
    """
    try:
        influencer = Influencer.objects.get(name=streamer_name)
    except Influencer.DoesNotExist:
        # 해당 스트리머가 없으면 빈 딕셔너리 반환
        return {}

    # 1. 기본 정보 조회
    persona = {
        "name": influencer.name,
        "age": influencer.age,
        "gender": influencer.gender,
        "mbti": influencer.mbti,
        "job": influencer.job,
        "audience_term": influencer.audience_term,
        "origin_story": influencer.origin_story,
    }

    # 2. 핵심 가치 (Core Values) - 우선순위 순으로 정렬하여 텍스트로 조합
    core_values = InfluencerCoreValue.objects.filter(influencer=influencer).order_by('priority').select_related('value')
    persona["core_values"] = ", ".join([cv.value.value_name for cv in core_values])

    # 3. 소통 스타일 (Communication Style) - OneToOne 관계
    try:
        style = CommunicationStyle.objects.get(influencer=influencer)
        persona["communication_style"] = {
            "tone": style.tone,
            "sentence_length": style.sentence_length,
            "question_style": style.question_style,
            "directness": f"{style.directness}점/5점",
            "empathy_expression": style.empathy_expression,
        }
    except CommunicationStyle.DoesNotExist:
        persona["communication_style"] = {}

    # 4. 도덕/윤리 좌표 (Moral Compass) - OneToOne 관계
    try:
        moral = MoralCompass.objects.get(influencer=influencer)
        persona["moral_compass"] = {
            "standard": moral.standard,
            "rule_adherence": moral.rule_adherence,
            "fairness": moral.fairness,
        }
    except MoralCompass.DoesNotExist:
        persona["moral_compass"] = {}

    # 5. 성격 기질 (Personality Trait) - OneToOne 관계
    try:
        trait = PersonalityTrait.objects.get(influencer=influencer)
        persona["personality_trait"] = {
            "energy_direction": trait.energy_direction,
            "emotional_processing": trait.emotional_processing,
            "judgment_decision": trait.judgment_decision,
            "interpersonal_attitude": trait.interpersonal_attitude,
            "openness": trait.openness,
            "conscientiousness": trait.conscientiousness,
            "emotional_stability": trait.emotional_stability,
            "social_sensitivity": trait.social_sensitivity,
            "risk_preference": trait.risk_preference,
            "time_orientation": trait.time_orientation,
        }
    except PersonalityTrait.DoesNotExist:
        persona["personality_trait"] = {}

    return persona
