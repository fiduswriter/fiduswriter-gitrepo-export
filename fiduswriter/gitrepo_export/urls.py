from django.apps import apps
from django.urls import re_path

from . import views

urlpatterns = [
    re_path(
        "^get_export_formats/$",
        views.get_export_formats,
        name="get_export_formats",
    ),
    re_path(
        "^get_git_repos/reload/$",
        views.get_git_repos,
        {"reload": True},
        name="get_git_repos_reload",
    ),
    re_path("^get_git_repos/$", views.get_git_repos, name="get_git_repos"),
    re_path(
        "^get_document_repos/$",
        views.get_document_repos,
        name="get_document_repos",
    ),
    re_path(
        "^update_document_repo/$",
        views.update_document_repo,
        name="update_document_repo",
    ),
    re_path(
        "^manage_forgejo_servers/$",
        views.manage_forgejo_servers,
        name="manage_forgejo_servers",
    ),
    re_path(
        "^get_forgejo_repos/(?P<server_id>[0-9]+)/$",
        views.get_forgejo_repos,
        name="get_forgejo_repos",
    ),
    re_path(
        "^proxy_forgejo/(?P<server_id>[0-9]+)/(?P<path>.*)$",
        views.proxy_forgejo,
        name="proxy_forgejo",
    ),
    re_path(
        "^proxy_github/(?P<path>.*)$", views.proxy_github, name="proxy_github"
    ),
    re_path(
        "^proxy_gitlab/(?P<path>.*)$", views.proxy_gitlab, name="proxy_gitlab"
    ),
]

if apps.is_installed("book"):
    urlpatterns += [
        re_path(
            "^get_book_repos/$",
            views.get_book_repos,
            name="get_book_repos",
        ),
        re_path(
            "^update_book_repo/$",
            views.update_book_repo,
            name="update_book_repo",
        ),
        re_path(
            "^get_gitlab_repo/(?P<id>.*)/$",
            views.get_gitlab_repo,
            name="get_gitlab_repo",
        ),
    ]
