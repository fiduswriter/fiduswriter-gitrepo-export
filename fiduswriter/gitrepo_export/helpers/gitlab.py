import json

from django.conf import settings
from httpx import AsyncClient, Request


def get_headers(token):
    return {
        "Authorization": f"Bearer {token}",
        "User-Agent": "Fidus Writer",
        "Content-Type": "application/json",
    }


def _get_base_url(instance_url=None):
    return instance_url or getattr(
        settings, "GITLAB_API_URL", "https://gitlab.com"
    )


async def proxy(
    token, instance_url, path, query_string, body, method, content_type=None
):
    headers = get_headers(token)
    if content_type:
        headers["Content-Type"] = content_type
    base_url = _get_base_url(instance_url)
    url = f"{base_url}/api/v4/{path}"
    if query_string:
        url += "?" + query_string
    if method == "GET":
        body = None
    request = Request(method, url, headers=headers, content=body)
    async with AsyncClient(
        timeout=88  # Firefox times out after 90 seconds, so we need to return before that.
    ) as client:
        response = await client.send(request)
    return response


async def get_repo(id, token, instance_url=None):
    headers = get_headers(token)
    base_url = _get_base_url(instance_url)
    files = []
    next_url = f"{base_url}/api/v4/projects/{id}/repository/tree?recursive=true&per_page=4&pagination=keyset"
    while next_url:
        request = Request("GET", next_url, headers=headers)
        async with AsyncClient(
            timeout=88  # Firefox times out after 90 seconds, so we need to return before that.
        ) as client:
            response = await client.send(request)
        response.raise_for_status()
        files += json.loads(response.text)
        next_url = False
        link_header = response.headers.get("Link", "")
        if link_header:
            for link_info in link_header.split(", "):
                link, rel = link_info.split("; ")
                if rel == 'rel="next"':
                    next_url = link[1:-1]
    return files


def gitlabrepo2repodata(gitlab_repo):
    return {
        "type": "gitlab",
        "name": gitlab_repo["path_with_namespace"],
        "id": gitlab_repo["id"],
        "branch": gitlab_repo["default_branch"],
    }


async def get_repos(token, instance_url=None):
    headers = get_headers(token)
    base_url = _get_base_url(instance_url)
    url = f"{base_url}/api/v4/projects?min_access_level=30&simple=true"
    request = Request("GET", url, headers=headers)
    async with AsyncClient(
        timeout=88  # Firefox times out after 90 seconds, so we need to return before that.
    ) as client:
        response = await client.send(request)
    content = json.loads(response.text)
    repos = []
    if isinstance(content, list):
        repos += map(gitlabrepo2repodata, content)
    return repos
