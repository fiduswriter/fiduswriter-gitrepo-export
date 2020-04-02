from tornado.web import RequestHandler
from tornado.httpclient import AsyncHTTPClient, HTTPRequest
from base.django_handler_mixin import DjangoHandlerMixin
from allauth.socialaccount.models import SocialToken


class Proxy(DjangoHandlerMixin, RequestHandler):
    async def get(self, path):
        user = self.get_current_user()
        social_token = SocialToken.objects.filter(
            account__user=user,
            account__provider='github'
        ).first()
        if (
            not social_token or
            not user.is_authenticated
        ):
            self.set_status(401)
            self.finish()
            return
        headers = {
            'Authorization': 'token {}'.format(social_token.token),
            'User-Agent': 'Fidus Writer'
        }
        query = self.request.query
        url = 'https://api.github.com/{}'.format(path)
        if query:
            url += '?' + query
        request = HTTPRequest(
            url,
            'GET',
            headers
        )
        http = AsyncHTTPClient()
        response = await http.fetch(request, raise_error=False)
        self.set_status(response.code)
        self.write(response.body)
        self.finish()

    async def put(self, path):
        user = self.get_current_user()
        social_token = SocialToken.objects.filter(
            account__user=user,
            account__provider='github'
        ).first()
        if (
            not social_token or
            not user.is_authenticated
        ):
            self.set_status(401)
            self.finish()
            return
        headers = {
            'Authorization': 'token {}'.format(social_token.token),
            'User-Agent': 'Fidus Writer'
        }
        query = self.request.query
        url = 'https://api.github.com/{}'.format(path)
        if query:
            url += '?' + query
        request = HTTPRequest(
            url,
            'PUT',
            headers,
            body=self.request.body,
            request_timeout=40.0
        )
        http = AsyncHTTPClient()
        response = await http.fetch(request, raise_error=False)
        self.set_status(response.code)
        self.write(response.body)
        self.finish()
