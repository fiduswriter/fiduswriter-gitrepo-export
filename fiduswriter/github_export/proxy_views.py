import re
from tornado.web import RequestHandler
from tornado.httpclient import AsyncHTTPClient, HTTPRequest, HTTPError
from base.django_handler_mixin import DjangoHandlerMixin
from allauth.socialaccount.models import SocialToken


ALLOWED_PATHS = [
    re.compile(r"^repos/([\w\.\-@_]+)/([\w\.\-@_]+)/contents/"),
    re.compile(r"^user/repos$"),
    re.compile(r"^repos/([\w\.\-@_]+)/([\w\.\-@_]+)/git/blobs/([\w\d]+)$"),
    re.compile(r"^repos/([\w\.\-@_]+)/([\w\.\-@_]+)/git/refs/heads/([\w\d]+)$"),
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
        }
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
