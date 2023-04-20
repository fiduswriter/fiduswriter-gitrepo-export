import json

from httpx import AsyncClient, Request
from allauth.socialaccount.models import SocialToken
from allauth.socialaccount.providers.gitlab.views import GitLabOAuth2Adapter

GITLAB_BASE_URL = f"{GitLabOAuth2Adapter.provider_base_url}/api/v4/"


async def proxy(path, user, query_string, body, method):
    social_token = SocialToken.objects.get(
        account__user=user, account__provider="gitlab"
    )
    headers = get_headers(social_token.token)
    url = f"{GITLAB_BASE_URL}{path}"
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
        "Authorization": f"Bearer {token}",
        "User-Agent": "Fidus Writer",
        "Content-Type": "application/json",
    }


async def get_repo(id, user):
    social_token = SocialToken.objects.get(
        account__user=user, account__provider="gitlab"
    )
    headers = get_headers(social_token.token)
    files = []
    next_url = (
        f"{GITLAB_BASE_URL}projects/{id}/repository/tree"
        "?recursive=true&per_page=4&pagination=keyset"
    )
    while next_url:
        request = Request("GET", next_url, headers=headers)
        async with AsyncClient(
            timeout=88  # Firefox times out after 90 seconds, so we need to return before that.
        ) as client:
            response = await client.send(request)
        files += json.loads(response.text)
        next_url = False
        for link_info in response.headers["Link"].split(", "):
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


async def get_repos(gitlab_token):
    # TODO: API documentation unclear on whether pagination is required.
    headers = get_headers(gitlab_token)
    repos = []
    url = f"{GITLAB_BASE_URL}projects?min_access_level=30&simple=true"
    request = Request("GET", url, headers=headers)
    async with AsyncClient(
        timeout=88  # Firefox times out after 90 seconds, so we need to return before that.
    ) as client:
        response = await client.send(request)
    content = json.loads(response.text)
    if isinstance(content, list):
        repos += map(gitlabrepo2repodata, content)
    return repos
