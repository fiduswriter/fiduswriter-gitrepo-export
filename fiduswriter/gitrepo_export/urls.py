from django.conf.urls import url

from . import views

urlpatterns = [
    url("^get_book_repos/$", views.get_book_repos, name="get_book_repos"),
    url(
        "^update_book_repo/$", views.update_book_repo, name="update_book_repo"
    ),
]
