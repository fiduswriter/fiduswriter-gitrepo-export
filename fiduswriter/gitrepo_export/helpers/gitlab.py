import json

from httpx import AsyncClient, Request
from allauth.socialaccount.models import SocialToken
from allauth.socialaccount.providers.gitlab.views import GitLabOAuth2Adapter


class URLTranslator(GitLabOAuth2Adapter):
    def get_url(self, path):
        return self._build_url("/api/v4/" + path)


async def proxy(request, path, user, query_string, body, method):
    social_token = await SocialToken.objects.aget(
        account__user=user, account__provider="gitlab"
    )
    headers = get_headers(social_token.token)
    url_translator = URLTranslator(request)
    url = url_translator.get_url(path)
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


async def get_repo(request, id, user):
    social_token = SocialToken.objects.get(
        account__user=user, account__provider="gitlab"
    )
    headers = get_headers(social_token.token)
    files = []
    url_translator = URLTranslator(request)
    next_url = url_translator.get_url(
        f"projects/{id}/repository/tree"
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


async def get_repos(request, gitlab_token):
    # TODO: API documentation unclear on whether pagination is required.
    headers = get_headers(gitlab_token)
    repos = []
    url_translator = URLTranslator(request)
    url = url_translator.get_url("projects?min_access_level=30&simple=true")
    request = Request("GET", url, headers=headers)
    async with AsyncClient(
        timeout=88  # Firefox times out after 90 seconds, so we need to return before that.
    ) as client:
        response = await client.send(request)
    content = json.loads(response.text)
    if isinstance(content, list):
        repos += map(gitlabrepo2repodata, content)
    return repos
