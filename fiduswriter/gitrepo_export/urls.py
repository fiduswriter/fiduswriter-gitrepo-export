from django.urls import re_path

from . import views

urlpatterns = [
    re_path("^get_book_repos/$", views.get_book_repos, name="get_book_repos"),
    re_path(
        "^update_book_repo/$", views.update_book_repo, name="update_book_repo"
    ),
    re_path(
        "^get_git_repos/reload/$",
        views.get_git_repos,
        {"reload": True},
        name="get_git_repos_reload",
    ),
    re_path("^get_git_repos/$", views.get_git_repos, name="get_git_repos"),
    re_path(
        "^get_gitlab_repo/(?P<id>.*)/$",
        views.get_gitlab_repo,
        name="get_gitlab_repo",
    ),
    re_path(
        "^proxy_github/(?P<path>.*)$", views.proxy_github, name="proxy_github"
    ),
    re_path(
        "^proxy_gitlab/(?P<path>.*)$", views.proxy_gitlab, name="proxy_gitlab"
    ),
]
