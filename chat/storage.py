import os
from django.core.files.storage import FileSystemStorage

class OverwriteStorage(FileSystemStorage):
    """
    파일을 덮어쓰는 커스텀 파일 저장소 클래스.
    동일한 이름의 파일이 존재하면, 기존 파일을 삭제하고 새로 저장합니다.
    """
    def get_available_name(self, name, max_length=None):
        if self.exists(name):
            # os.path.join을 사용하여 OS에 맞는 파일 경로를 생성하고 삭제합니다.
            os.remove(os.path.join(self.location, name))
        return name