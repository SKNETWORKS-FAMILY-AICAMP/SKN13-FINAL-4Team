from django.http import JsonResponse

def recommend_view(request):
    return JsonResponse({"message": "추천 결과입니다!"})
