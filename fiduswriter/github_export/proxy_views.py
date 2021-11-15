import re
import json
from tornado.web import RequestHandler
from tornado.httpclient import AsyncHTTPClient, HTTPRequest, HTTPError
from base.django_handler_mixin import DjangoHandlerMixin
from allauth.socialaccount.models import SocialToken

from . import models

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


class Proxy(DjangoHandlerMixin, RequestHandler):
    async def get(self, path):
        user = self.get_current_user()
        social_token = SocialToken.objects.filter(
            account__user=user, account__provider="github"
        ).first()
        if (
            not any(regex.match(path) for regex in ALLOWED_PATHS)
            or not social_token
            or not user.is_authenticated
        ):
            self.set_status(401)
            self.finish()
            return
        headers = {
            "Authorization": "token {}".format(social_token.token),
            "User-Agent": "Fidus Writer",
            "Accept": "application/vnd.github.v3+json",
        }
        if path == "user/repos":
            await self.get_repos(path, user, social_token, headers)
            self.finish()
            return
        elif path == "user/repos/reload":
            await self.get_repos(
                path, user, social_token, headers, reload=True
            )
            self.finish()
            return
        query = self.request.query
        url = "https://api.github.com/{}".format(path)
        if query:
            url += "?" + query
        request = HTTPRequest(url, "GET", headers, request_timeout=120)
        http = AsyncHTTPClient()
        try:
            response = await http.fetch(request)
        except HTTPError as e:
            if e.response.code == 404:
                # We remove the 404 response so it will not show up as an
                # error in the browser
                self.write("[]")
            else:
                self.set_status(e.response.code)
                self.write(e.response.body)
        except Exception as e:
            self.set_status(500)
            self.write("Error: %s" % e)
        else:
            self.set_status(response.code)
            self.write(response.body)
        self.finish()

    async def get_repos(self, path, user, social_token, headers, reload=False):
        repo_info = models.RepoInfo.objects.filter(user=user).first()
        if repo_info:
            if reload:
                repo_info.delete()
            else:
                self.set_status(200)
                self.write(json.dumps(repo_info.content))
                return
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
                    self.write("[]")
                else:
                    self.set_status(e.response.code)
                    self.write(e.response.body)
                return
            except Exception as e:
                self.set_status(500)
                self.write("Error: %s" % e)
                return
            else:
                content = json.loads(response.body)
                repos += content
                if len(content) == 100:
                    page += 1
                else:
                    last_page = True
        repo_info, created = models.RepoInfo.objects.get_or_create(user=user)
        repo_info.content = repos
        repo_info.save()
        self.set_status(200)
        self.write(json.dumps(repo_info.content))

    async def post(self, path):
        user = self.get_current_user()
        social_token = SocialToken.objects.filter(
            account__user=user, account__provider="github"
        ).first()
        if (
            not any(regex.match(path) for regex in ALLOWED_PATHS)
            or not social_token
            or not user.is_authenticated
        ):
            self.set_status(401)
            self.finish()
            return
        headers = {
            "Authorization": "token {}".format(social_token.token),
            "User-Agent": "Fidus Writer",
            "Accept": "application/vnd.github.v3+json",
        }
        query = self.request.query
        url = "https://api.github.com/{}".format(path)
        if query:
            url += "?" + query
        request = HTTPRequest(
            url, "POST", headers, body=self.request.body, request_timeout=120
        )
        http = AsyncHTTPClient()
        try:
            response = await http.fetch(request)
        except Exception as e:
            self.set_status(500)
            self.write("Error: %s" % e)
        else:
            self.set_status(response.code)
            self.write(response.body)
        self.finish()

    async def patch(self, path):
        user = self.get_current_user()
        social_token = SocialToken.objects.filter(
            account__user=user, account__provider="github"
        ).first()
        if (
            not any(regex.match(path) for regex in ALLOWED_PATHS)
            or not social_token
            or not user.is_authenticated
        ):
            self.set_status(401)
            self.finish()
            return
        headers = {
            "Authorization": "token {}".format(social_token.token),
            "User-Agent": "Fidus Writer",
            "Accept": "application/vnd.github.v3+json",
        }
        query = self.request.query
        url = "https://api.github.com/{}".format(path)
        if query:
            url += "?" + query
        request = HTTPRequest(
            url, "PATCH", headers, body=self.request.body, request_timeout=120
        )
        http = AsyncHTTPClient()
        try:
            response = await http.fetch(request)
        except Exception as e:
            self.set_status(500)
            self.write("Error: %s" % e)
        else:
            self.set_status(response.code)
            self.write(response.body)
        self.finish()
