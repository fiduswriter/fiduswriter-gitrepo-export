from django.contrib.auth.decorators import login_required
from django.views.decorators.http import (
    require_GET,
    require_POST,
    require_http_methods,
)
from django.http import JsonResponse, HttpResponseForbidden, HttpResponse
from django.apps import apps
from django.db.models import Q
from django.conf import settings
from httpx import Client, HTTPError

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
    repo_info = await models.RepoInfo.objects.filter(
        user=request_user
    ).afirst()
    if repo_info:
        if reload:
            await repo_info.adelete()
        else:
            return JsonResponse({"repos": repo_info.content}, status=200)
    repos = []
    async for server in models.GitServer.objects.filter(
        user=request_user, active=True
    ):
        try:
            if server.server_type == "github":
                base_url = getattr(
                    settings, "GITHUB_API_URL", "https://api.github.com"
                )
                new_repos = await github.get_repos(server.token, base_url)
                for r in new_repos:
                    r["server_id"] = server.id
                repos += new_repos
            elif server.server_type == "gitlab":
                base_url = server.instance_url or None
                new_repos = await gitlab.get_repos(server.token, base_url)
                for r in new_repos:
                    r["server_id"] = server.id
                repos += new_repos
            elif server.server_type in ("forgejo", "gitea"):
                repos += await forgejo.get_repos(
                    server.instance_url, server.token, server.id
                )
        except HTTPError as e:
            if e.response.status_code != 404:
                # Skip failed servers rather than aborting entirely.
                continue
        except Exception:
            continue
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
    server = await models.GitServer.objects.filter(
        user=request_user, server_type="github", active=True
    ).afirst()
    if not server:
        return HttpResponse("No GitHub server configured.", status=400)
    try:
        response = await github.proxy(
            path,
            server.token,
            request.META["QUERY_STRING"],
            request.body,
            request.method,
            request.content_type,
        )
    except HTTPError as e:
        if e.response.status_code == 404:
            return HttpResponse("[]", status=200)
        else:
            return HttpResponse(e.response.text, status=e.response.status_code)
    except Exception as e:
        return HttpResponse("Error: %s" % e, status=500)
    else:
        return HttpResponse(response.text, status=response.status_code)


@login_required
@require_http_methods(["GET", "POST", "PUT", "PATCH"])
async def proxy_gitlab(request, server_id, path):
    request_user = await request.auser()
    server = await models.GitServer.objects.filter(
        id=server_id, user=request_user, server_type="gitlab", active=True
    ).afirst()
    if not server:
        return HttpResponse("No GitLab server configured.", status=400)
    try:
        response = await gitlab.proxy(
            server.token,
            server.instance_url,
            path,
            request.META["QUERY_STRING"],
            request.body,
            request.method,
            request.content_type,
        )
    except HTTPError as e:
        if e.response.status_code == 404 and request.method == "GET":
            return HttpResponse("[]", status=200)
        return HttpResponse(e.response.text, status=e.response.status_code)
    except Exception as e:
        return HttpResponse("Error: %s" % e, status=500)
    else:
        return HttpResponse(response.text, status=response.status_code)


@login_required
@require_GET
async def get_gitlab_repo(request, server_id, id):
    request_user = await request.auser()
    server = await models.GitServer.objects.filter(
        id=server_id, user=request_user, server_type="gitlab", active=True
    ).afirst()
    if not server:
        return HttpResponse("No GitLab server configured.", status=400)
    try:
        files = await gitlab.get_repo(id, server.token, server.instance_url)
    except HTTPError as e:
        if e.response.status_code == 404:
            return JsonResponse({"files": []}, status=200)
        return HttpResponse(e.response.text, status=e.response.status_code)
    except Exception as e:
        return HttpResponse("Error: %s" % e, status=500)
    else:
        return JsonResponse({"files": files}, status=200)


@login_required
@ajax_required
@require_http_methods(["GET", "POST", "DELETE"])
def manage_git_servers(request):
    if request.method == "GET":
        servers = models.GitServer.objects.filter(user=request.user)
        return JsonResponse(
            {
                "servers": [
                    {
                        "id": s.id,
                        "type": s.server_type,
                        "url": s.instance_url,
                        "name": s.name,
                        "active": s.active,
                    }
                    for s in servers
                ]
            }
        )
    elif request.method == "POST":
        server_type = request.JSON["server_type"]
        instance_url = request.JSON.get("instance_url", "").rstrip("/")
        name = request.JSON.get("name", "")
        token = request.JSON["token"]

        if server_type == "github":
            base_url = getattr(
                settings, "GITHUB_API_URL", "https://api.github.com"
            )
            verify_url = f"{base_url}/user/repos?per_page=1"
            headers = {"Authorization": f"Bearer {token}"}
        elif server_type == "gitlab":
            base_url = instance_url or "https://gitlab.com"
            verify_url = (
                f"{base_url}/api/v4/projects?min_access_level=30&per_page=1"
            )
            headers = {"Authorization": f"Bearer {token}"}
        elif server_type in ("forgejo", "gitea"):
            if not instance_url:
                return HttpResponse(
                    "Instance URL is required for Forgejo/Gitea.", status=400
                )
            verify_url = f"{instance_url}/api/v1/user/repos?limit=1"
            headers = {"Authorization": f"Bearer {token}"}
        else:
            return HttpResponse("Invalid server type.", status=400)

        try:
            with Client(timeout=30) as client:
                response = client.get(verify_url, headers=headers)
        except HTTPError as e:
            return HttpResponse(f"Could not reach server: {e}", status=400)

        if response.status_code != 200:
            try:
                error_body = response.json()
                error_msg = error_body.get("message", "")
                if "scope" in error_msg.lower():
                    return HttpResponse(
                        "The token is missing required scopes.",
                        status=400,
                    )
            except Exception:
                pass
            return HttpResponse(
                f"Invalid token or instance URL. Server responded with {response.status_code}: {response.text[:200]}",
                status=400,
            )

        server = models.GitServer.objects.create(
            user=request.user,
            server_type=server_type,
            instance_url=instance_url,
            name=name,
            token=token,
        )
        return JsonResponse(
            {
                "id": server.id,
                "type": server.server_type,
                "url": server.instance_url,
                "name": server.name,
            }
        )
    elif request.method == "DELETE":
        server_id = request.JSON["server_id"]
        models.GitServer.objects.filter(
            id=server_id, user=request.user
        ).delete()
        models.RepoInfo.objects.filter(user=request.user).delete()
        return HttpResponse(status=200)


@login_required
@require_GET
async def get_forgejo_repos(request, server_id):
    request_user = await request.auser()
    server = await models.GitServer.objects.aget(
        id=server_id,
        user=request_user,
        active=True,
        server_type__in=("forgejo", "gitea"),
    )
    repos = await forgejo.get_repos(
        server.instance_url, server.token, server.id
    )
    return JsonResponse({"repos": repos})


@login_required
@require_http_methods(["GET", "POST", "PUT", "PATCH"])
async def proxy_forgejo(request, server_id, path):
    request_user = await request.auser()
    server = await models.GitServer.objects.aget(
        id=server_id,
        user=request_user,
        active=True,
        server_type__in=("forgejo", "gitea"),
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
        if e.response.status_code == 404:
            return HttpResponse("[]", status=200)
        else:
            return HttpResponse(e.response.text, status=e.response.status_code)
    except Exception as e:
        return HttpResponse("Error: %s" % e, status=500)
    else:
        return HttpResponse(response.text, status=response.status_code)
