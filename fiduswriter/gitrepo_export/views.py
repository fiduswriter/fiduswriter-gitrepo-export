from django.contrib.auth.decorators import login_required
from django.views.decorators.http import (
    require_GET,
    require_POST,
    require_http_methods,
)
from django.http import JsonResponse, HttpResponseForbidden, HttpResponse
from httpx import HTTPError
from base.decorators import ajax_required
from django.db.models import Q
from allauth.socialaccount.models import SocialToken

from book.models import Book
from . import models

from .helpers import github, gitlab


@login_required
@ajax_required
@require_GET
def get_book_repos(request):
    response = {}
    status = 200
    book_repos = models.BookRepository.objects.filter(
        Q(book__owner=request.user)
        | Q(
            book__bookaccessright__holder_id=request.user.id,
            book__bookaccessright__holder_type__model="user",
        )
    ).distinct()
    response["repos"] = {}
    for repo in book_repos:
        response["repos"][repo.book.id] = {
            "repo_id": repo.repo_id,
            "repo_name": repo.repo_name,
            "repo_type": repo.repo_type,
            "export_epub": repo.export_epub,
            "export_unpacked_epub": repo.export_unpacked_epub,
            "export_html": repo.export_html,
            "export_unified_html": repo.export_unified_html,
            "export_latex": repo.export_latex,
            "export_odt": repo.export_odt,
            "export_docx": repo.export_docx,
        }
    return JsonResponse(response, status=status)


@login_required
@ajax_required
@require_POST
def update_book_repo(request):
    book_id = request.POST["book_id"]
    book = Book.objects.filter(id=book_id).first()
    if not book or (
        book.owner != request.user
        and not book.bookaccessright_set.filter(
            holder_id=request.user.id,
            holder_type__model="user",
            rights="write",
        ).exists()
    ):
        return HttpResponseForbidden()
    models.BookRepository.objects.filter(book_id=book_id).delete()
    repo_id = request.POST["repo_id"]
    if repo_id == 0:
        status = 200
    else:
        models.BookRepository.objects.create(
            book_id=book_id,
            repo_id=repo_id,
            repo_name=request.POST["repo_name"],
            repo_type=request.POST["repo_type"],
            export_epub=request.POST["export_epub"] == "true",
            export_unpacked_epub=request.POST["export_unpacked_epub"]
            == "true",
            export_html=request.POST["export_html"] == "true",
            export_unified_html=request.POST["export_unified_html"] == "true",
            export_latex=request.POST["export_latex"] == "true",
            export_docx=request.POST["export_docx"] == "true",
            export_odt=request.POST["export_odt"] == "true",
        )
        status = 201
    return HttpResponse(status=status)


@login_required
@require_GET
async def get_git_repos(request, reload=False):
    request_user = await request.auser()
    social_tokens = {
        "github": await SocialToken.objects.filter(
            account__user=request_user, account__provider="github"
        ).afirst(),
        "gitlab": await SocialToken.objects.filter(
            account__user=request_user, account__provider="gitlab"
        ).afirst(),
    }

    if not social_tokens["github"] and not social_tokens["gitlab"]:
        return HttpResponseForbidden()
    repo_info = await models.RepoInfo.objects.filter(
        user=request_user
    ).afirst()
    if repo_info:
        if reload:
            await repo_info.adelete()
        else:
            return JsonResponse({"repos": repo_info.content}, status=200)
    repos = []
    try:
        if social_tokens["github"]:
            repos += await github.get_repos(social_tokens["github"])
        if social_tokens["gitlab"]:
            repos += await gitlab.get_repos(request, social_tokens["gitlab"])
    except HTTPError as e:
        if e.response.code == 404:
            # We remove the 404 response so it will not show up as an
            # error in the browser
            pass
        else:
            return HttpResponse(e.response.text, status=e.response.status_code)
        return []
    except Exception as e:
        return HttpResponse("Error: %s" % e, status=500)
    repo_info, created = await models.RepoInfo.objects.aget_or_create(
        user=request_user
    )
    repo_info.content = repos
    await repo_info.asave()
    return JsonResponse({"repos": repos}, status=200)


@login_required
@require_http_methods(["GET", "POST", "PATCH"])
async def proxy_github(request, path):
    request_user = await request.auser()
    try:
        response = await github.proxy(
            path,
            request_user,
            request.META["QUERY_STRING"],
            request.body,
            request.method,
        )
    except HTTPError as e:
        if e.response.code == 404:
            # We remove the 404 response so it will not show up as an
            # error in the browser
            return HttpResponse("[]", status=200)
        else:
            return HttpResponse(e.response.text, status=e.response.status_code)
    except Exception as e:
        return HttpResponse("Error: %s" % e, status=500)
    else:
        return HttpResponse(response.text, status=response.status_code)


@login_required
@require_http_methods(["GET", "POST", "PATCH"])
async def proxy_gitlab(request, path):
    request_user = await request.auser()
    try:
        response = await gitlab.proxy(
            request,
            path,
            request_user,
            request.META["QUERY_STRING"],
            request.body,
            request.method,
        )
    except HTTPError as e:
        if e.response.code == 404:
            # We remove the 404 response so it will not show up as an
            # error in the browser
            return HttpResponse("[]", status=200)
        else:
            return HttpResponse(e.response.text, status=e.response.status_code)
    except Exception as e:
        return HttpResponse("Error: %s" % e, status=500)
    else:
        return HttpResponse(response.text, status=response.status_code)


@login_required
@require_GET
async def get_gitlab_repo(request, id):
    request_user = await request.auser()
    try:
        files = await gitlab.get_repo(request, id, request_user)
    except HTTPError as e:
        return HttpResponse(e.response.text, status=e.response.status_code)
    except Exception as e:
        return HttpResponse("Error: %s" % e, status=500)
    else:
        return JsonResponse({"files": files}, status=200)
