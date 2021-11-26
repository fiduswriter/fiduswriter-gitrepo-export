import re
import json

from tornado.httpclient import AsyncHTTPClient, HTTPRequest, HTTPError
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

ALLOWED_METHODS = ["GET", "POST", "PATCH"]


def get_headers(token):
    return {
        "Authorization": f"token {token}",
        "User-Agent": "Fidus Writer",
        "Accept": "application/vnd.github.v3+json",
    }


async def prepare(proxy_connector, path_parts, user):
    path = "/".join(path_parts)
    method = proxy_connector.request.method
    if not any(regex.match(path) for regex in ALLOWED_PATHS):
        proxy_connector.set_status(401)
        return
    if method not in ALLOWED_METHODS:
        proxy_connector.set_status(405)
        return
    social_token = SocialToken.objects.filter(
        account__user=user, account__provider="github"
    ).first()
    if not social_token:
        proxy_connector.set_status(401)
        return
    headers = get_headers(social_token.token)
    query = proxy_connector.request.query
    url = f"https://api.github.com/{path}"
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


def githubrepo2repodata(github_repo):
    return {
        "type": "github",
        "name": github_repo["full_name"],
        "id": github_repo["id"],
        "branch": github_repo["default_branch"],
    }


async def get_repos(proxy_connector, github_token):
    headers = get_headers(github_token)
    repos = []
    page = 1
    last_page = False
    while not last_page:
        url = f"https://api.github.com/user/repos?page={page}&per_page=100"
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
        else:
            content = json.loads(response.body)
            repos += map(githubrepo2repodata, content)
            if len(content) == 100:
                page += 1
            else:
                last_page = True
    return repos
