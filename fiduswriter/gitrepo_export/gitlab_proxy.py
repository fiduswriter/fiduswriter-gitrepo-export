import json

from tornado.httpclient import AsyncHTTPClient, HTTPRequest, HTTPError
from allauth.socialaccount.models import SocialToken
from allauth.socialaccount.providers.gitlab.views import GitLabOAuth2Adapter

GITLAB_BASE_URL = f"{GitLabOAuth2Adapter.provider_base_url}/api/v4/"

ALLOWED_METHODS = ["GET", "POST", "PATCH"]


def get_headers(token):
    return {
        "Authorization": f"Bearer {token}",
        "User-Agent": "Fidus Writer",
        "Content-Type": "application/json",
    }


async def prepare(proxy_connector, path_parts, user):
    path = "/".join(path_parts)
    path_part = path_parts.pop(0) if len(path_parts) else None
    social_token = SocialToken.objects.filter(
        account__user=user, account__provider="gitlab"
    ).first()
    if not social_token:
        proxy_connector.set_status(401)
        return
    headers = get_headers(social_token.token)
    if path_part == "repo":
        await get_repo(proxy_connector, path_parts, user, headers)
        return
    method = proxy_connector.request.method
    query = proxy_connector.request.query
    url = f"{GITLAB_BASE_URL}{path}"
    if query:
        url += "?" + query
    if method == "GET":
        body = None
    else:
        body = proxy_connector.request.body
    request = HTTPRequest(url, method, headers, body=body, request_timeout=120)
    http = AsyncHTTPClient()
    try:
        response = await http.fetch(request)
    except HTTPError as e:
        if e.response.code == 404:
            # We remove the 404 response so it will not show up as an
            # error in the browser
            proxy_connector.write("[]")
        else:
            proxy_connector.set_status(e.response.code)
            proxy_connector.write(e.response.body)
    except Exception as e:
        proxy_connector.set_status(500)
        proxy_connector.write("Error: %s" % e)
    else:
        proxy_connector.set_status(response.code)
        proxy_connector.write(response.body)


async def get_repo(proxy_connector, path_parts, user, headers):
    id = path_parts.pop(0) if len(path_parts) else None
    files = []
    next_url = (
        f"{GITLAB_BASE_URL}projects/{id}/repository/tree"
        "?recursive=true&per_page=4&pagination=keyset"
    )
    while next_url:
        request = HTTPRequest(next_url, "GET", headers, request_timeout=120)
        http = AsyncHTTPClient()
        try:
            response = await http.fetch(request)
        except HTTPError as e:
            proxy_connector.set_status(e.response.code)
            proxy_connector.write(e.response.body)
            return
        except Exception as e:
            proxy_connector.set_status(500)
            proxy_connector.write("Error: %s" % e)
            return
        files += json.loads(response.body)
        next_url = False
        for link_info in response.headers["Link"].split(", "):
            link, rel = link_info.split("; ")
            if rel == 'rel="next"':
                next_url = link[1:-1]
    proxy_connector.write(json.dumps(files))


def gitlabrepo2repodata(gitlab_repo):
    return {
        "type": "gitlab",
        "name": gitlab_repo["path_with_namespace"],
        "id": gitlab_repo["id"],
        "branch": gitlab_repo["default_branch"],
    }


async def get_repos(proxy_connector, gitlab_token):
    # TODO: API documentation unclear on whether pagination is required.
    headers = get_headers(gitlab_token)
    repos = []
    url = f"{GITLAB_BASE_URL}projects?min_access_level=30&simple=true"
    request = HTTPRequest(url, "GET", headers, request_timeout=120)
    http = AsyncHTTPClient()
    try:
        response = await http.fetch(request)
    except HTTPError as e:
        if e.response.code == 404:
            # We remove the 404 response so it will not show up as an
            # error in the browser
            return []
        else:
            proxy_connector.set_status(e.response.code)
            proxy_connector.write(e.response.body)
        return []
    except Exception as e:
        proxy_connector.set_status(500)
        proxy_connector.write("Error: %s" % e)
        return []
    content = json.loads(response.body)
    repos += map(gitlabrepo2repodata, content)
    return repos
