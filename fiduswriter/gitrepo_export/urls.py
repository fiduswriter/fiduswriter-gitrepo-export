from django.urls import re_path

from . import views

urlpatterns = [
    re_path("^get_book_repos/$", views.get_book_repos, name="get_book_repos"),
    re_path(
        "^update_book_repo/$", views.update_book_repo, name="update_book_repo"
    ),
]
