from django.contrib.auth.decorators import login_required
from django.views.decorators.http import (
    require_GET,
    require_POST,
    require_http_methods,
)
from django.http import JsonResponse, HttpResponseForbidden, HttpResponse
from django.apps import apps
from django.db.models import Q
from httpx import HTTPError
from allauth.socialaccount.models import SocialToken

from base.decorators import ajax_required

from . import models
from .formats import get_all_formats
from .helpers import github, gitlab, forgejo

books_installed = apps.is_installed("book")

if books_installed:
    from book.models import Book


def _serialize_book_repo(repo):
    return {
        "repo_id": repo.repo_id,
        "repo_name": repo.repo_name,
        "repo_type": repo.repo_type,
        "targets": repo.targets,
    }


@login_required
@ajax_required
@require_GET
def get_export_formats(request):
    return JsonResponse({"formats": get_all_formats()})


if books_installed:

    @login_required
    @ajax_required
    @require_GET
    def get_book_repos(request):
        response = {}
        book_repos = models.BookRepository.objects.filter(
            Q(book__owner=request.user)
            | Q(
                book__bookaccessright__holder_id=request.user.id,
                book__bookaccessright__holder_type__model="user",
            )
        ).distinct()
        response["repos"] = {}
        for repo in book_repos:
            response["repos"][repo.book.id] = _serialize_book_repo(repo)
        return JsonResponse(response)

    @login_required
    @ajax_required
    @require_POST
    def update_book_repo(request):
        book_id = request.JSON["book_id"]
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
        repo_id = request.JSON["repo_id"]
        if repo_id == 0:
            status = 200
        else:
            models.BookRepository.objects.create(
                book_id=book_id,
                repo_id=repo_id,
                repo_name=request.JSON["repo_name"],
                repo_type=request.JSON["repo_type"],
                targets=request.JSON.get("targets", []),
            )
            status = 201
        return HttpResponse(status=status)


@login_required
@ajax_required
@require_GET
def get_document_repos(request):
    repos = models.DocumentRepository.objects.filter(
        Q(document__owner=request.user)
        | Q(document__accessright__holder_id=request.user.id)
    ).distinct()
    return JsonResponse(
        {
            "repos": {
                repo.document.id: {
                    "repo_id": repo.repo_id,
                    "repo_name": repo.repo_name,
                    "repo_type": repo.repo_type,
                    "targets": repo.targets,
                }
                for repo in repos
            }
        }
    )


@login_required
@ajax_required
@require_POST
def update_document_repo(request):
    from document.models import Document

    doc_id = request.JSON["document_id"]
    doc = Document.objects.filter(id=doc_id).first()
    if not doc or (
        doc.owner != request.user
        and not doc.accessright_set.filter(
            holder_id=request.user.id,
            rights="write",
        ).exists()
    ):
        return HttpResponseForbidden()
    models.DocumentRepository.objects.filter(document_id=doc_id).delete()
    repo_id = request.JSON["repo_id"]
    if repo_id == 0:
        status = 200
    else:
        models.DocumentRepository.objects.create(
            document_id=doc_id,
            repo_id=repo_id,
            repo_name=request.JSON["repo_name"],
            repo_type=request.JSON["repo_type"],
            targets=request.JSON.get("targets", []),
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
        async for server in models.ForgejoServer.objects.filter(
            user=request_user, active=True
        ):
            repos += await forgejo.get_repos(
                server.instance_url, server.token, server.id
            )
    except HTTPError as e:
        if e.response.code == 404:
            pass
        else:
            return HttpResponse(e.response.text, status=e.response.status_code)
    except Exception as e:
        return HttpResponse("Error: %s" % e, status=500)
    repo_info, created = await models.RepoInfo.objects.aget_or_create(
        user=request_user
    )
    repo_info.content = repos
    await repo_info.asave()
    return JsonResponse({"repos": repos}, status=200)


@login_required
@require_http_methods(["GET", "POST", "PUT", "PATCH"])
async def proxy_github(request, path):
    request_user = await request.auser()
    try:
        response = await github.proxy(
            path,
            request_user,
            request.META["QUERY_STRING"],
            request.body,
            request.method,
            request.content_type,
        )
    except HTTPError as e:
        if e.response.code == 404:
            return HttpResponse("[]", status=200)
        else:
            return HttpResponse(e.response.text, status=e.response.status_code)
    except Exception as e:
        return HttpResponse("Error: %s" % e, status=500)
    else:
        return HttpResponse(response.text, status=response.status_code)


@login_required
@require_http_methods(["GET", "POST", "PUT", "PATCH"])
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
            request.content_type,
        )
    except HTTPError as e:
        if e.response.code == 404:
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


@login_required
@ajax_required
@require_http_methods(["GET", "POST", "DELETE"])
def manage_forgejo_servers(request):
    if request.method == "GET":
        servers = models.ForgejoServer.objects.filter(user=request.user)
        return JsonResponse(
            {
                "servers": [
                    {
                        "id": s.id,
                        "url": s.instance_url,
                        "name": s.name,
                        "active": s.active,
                    }
                    for s in servers
                ]
            }
        )
    elif request.method == "POST":
        instance_url = request.JSON["instance_url"].rstrip("/")
        name = request.JSON.get("name", "")
        token = request.JSON["token"]
        # Verify token against the actual endpoint we will use
        from httpx import AsyncClient, Request as HttpxRequest
        import asyncio

        verify_url = f"{instance_url}/api/v1/user/repos?limit=1"
        headers = {"Authorization": f"Bearer {token}"}
        verify_request = HttpxRequest("GET", verify_url, headers=headers)

        loop = asyncio.new_event_loop()
        try:

            async def verify():
                async with AsyncClient(timeout=30) as client:
                    response = await client.send(verify_request)
                return response

            response = loop.run_until_complete(verify())
        finally:
            loop.close()
        if response.status_code != 200:
            try:
                error_body = response.json()
                error_msg = error_body.get("message", "")
                if "scope" in error_msg.lower():
                    return HttpResponse(
                        "The token is missing required scopes. "
                        "Make sure the token has 'read:user' and 'repo' permissions.",
                        status=400,
                    )
            except Exception:
                pass
            return HttpResponse("Invalid token or instance URL", status=400)
        server = models.ForgejoServer.objects.create(
            user=request.user,
            instance_url=instance_url,
            name=name,
            token=token,
        )
        return JsonResponse(
            {
                "id": server.id,
                "url": server.instance_url,
                "name": server.name,
            }
        )
    elif request.method == "DELETE":
        server_id = request.JSON["server_id"]
        models.ForgejoServer.objects.filter(
            id=server_id, user=request.user
        ).delete()
        models.RepoInfo.objects.filter(user=request.user).delete()
        return HttpResponse(status=200)


@login_required
@require_GET
async def get_forgejo_repos(request, server_id):
    request_user = await request.auser()
    server = await models.ForgejoServer.objects.aget(
        id=server_id, user=request_user, active=True
    )
    repos = await forgejo.get_repos(
        server.instance_url, server.token, server.id
    )
    return JsonResponse({"repos": repos})


@login_required
@require_http_methods(["GET", "POST", "PUT", "PATCH"])
async def proxy_forgejo(request, server_id, path):
    request_user = await request.auser()
    server = await models.ForgejoServer.objects.aget(
        id=server_id, user=request_user, active=True
    )
    try:
        response = await forgejo.proxy(
            server.instance_url,
            server.token,
            path,
            request.META["QUERY_STRING"],
            request.body,
            request.method,
            request.content_type,
        )
    except HTTPError as e:
        if e.response.code == 404:
            return HttpResponse("[]", status=200)
        else:
            return HttpResponse(e.response.text, status=e.response.status_code)
    except Exception as e:
        return HttpResponse("Error: %s" % e, status=500)
    else:
        return HttpResponse(response.text, status=response.status_code)
