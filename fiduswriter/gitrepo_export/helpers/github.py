import re
import json

from django.conf import settings
from httpx import AsyncClient, Request

ALLOWED_PATHS = [
    re.compile(r"^repos/([\w\.\-@_]+)/([\w\.\-@_]+)/contents/"),
    re.compile(r"^user/repos$"),
    re.compile(r"^user/repos/reload$"),
    re.compile(r"^repos/([\w\.\-@_]+)/([\w\.\-@_]+)/git/blobs/([\w\d]+)$"),
    re.compile(
        r"^repos/([\w\.\-@_]+)/([\w\.\-@_]+)/git/refs/heads/([\w\d]+)$"
    ),
    re.compile(r"^repos/([\w\.\-@_]+)/([\w\.\-@_]+)/git/blobs$"),
    re.compile(r"^repos/([\w\.\-@_]+)/([\w\.\-@_]+)$"),
    re.compile(r"^repos/([\w\.\-@_]+)/([\w\.\-@_]+)/git/commits$"),
    re.compile(r"^repos/([\w\.\-@_]+)/([\w\.\-@_]+)/git/trees$"),
]


def get_headers(token):
    return {
        "Authorization": f"Bearer {token}",
        "User-Agent": "Fidus Writer",
        "Accept": "application/vnd.github.v3+json",
    }


async def proxy(path, token, query_string, body, method, content_type=None):
    if not any(regex.match(path) for regex in ALLOWED_PATHS):
        raise Exception("Path not permitted.")
    headers = get_headers(token)
    if content_type:
        headers["Content-Type"] = content_type
    base_url = getattr(settings, "GITHUB_API_URL", "https://api.github.com")
    url = f"{base_url}/{path}"
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


def githubrepo2repodata(github_repo):
    return {
        "type": "github",
        "name": github_repo["full_name"],
        "id": github_repo["id"],
        "branch": github_repo["default_branch"],
    }


async def get_repos(token, base_url=None):
    if not base_url:
        base_url = getattr(
            settings, "GITHUB_API_URL", "https://api.github.com"
        )
    headers = get_headers(token)
    repos = []
    page = 1
    last_page = False
    while not last_page:
        url = f"{base_url}/user/repos?page={page}&per_page=100"
        request = Request("GET", url, headers=headers)
        async with AsyncClient(
            timeout=88  # Firefox times out after 90 seconds, so we need to return before that.
        ) as client:
            response = await client.send(request)
        content = json.loads(response.text)
        if isinstance(content, list):
            repos += map(githubrepo2repodata, content)
            if len(content) == 100:
                page += 1
            else:
                last_page = True
        else:
            last_page = True
    return repos
