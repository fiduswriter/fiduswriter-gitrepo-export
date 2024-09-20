import re
import json

from httpx import AsyncClient, Request
from allauth.socialaccount.models import SocialToken

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


async def proxy(path, user, query_string, body, method):
    if not any(regex.match(path) for regex in ALLOWED_PATHS):
        raise Exception("Path not permitted.")
    social_token = await SocialToken.objects.aget(
        account__user=user, account__provider="github"
    )
    headers = get_headers(social_token.token)
    url = f"https://api.github.com/{path}"
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


def get_headers(token):
    return {
        "Authorization": f"token {token}",
        "User-Agent": "Fidus Writer",
        "Accept": "application/vnd.github.v3+json",
    }


def githubrepo2repodata(github_repo):
    return {
        "type": "github",
        "name": github_repo["full_name"],
        "id": github_repo["id"],
        "branch": github_repo["default_branch"],
    }


async def get_repos(github_token):
    headers = get_headers(github_token)
    repos = []
    page = 1
    last_page = False
    while not last_page:
        url = f"https://api.github.com/user/repos?page={page}&per_page=100"
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
