# config/admin.py

from django.contrib.admin import AdminSite

class PublicAdminSite(AdminSite):
    def has_permission(self, request):
        # 이 관리자 사이트에 대한 모든 접근을 허용
        return True

public_admin_site = PublicAdminSite(name='public_admin')