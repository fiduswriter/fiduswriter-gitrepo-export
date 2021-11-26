from tornado.web import RequestHandler
from base.django_handler_mixin import DjangoHandlerMixin

from . import common_proxy
from . import github_proxy
from . import gitlab_proxy


class Proxy(DjangoHandlerMixin, RequestHandler):
    SUPPORTED_METHODS = ["GET", "POST", "PATCH"]

    async def prepare(self):
        user = self.get_current_user()
        path_parts = self.path_args[0].split("/")
        path_part = path_parts.pop(0) if len(path_parts) else None
        if not user.is_authenticated:
            self.set_status(401)
        elif path_part == "all":
            await common_proxy.prepare(self, path_parts, user)
        elif path_part == "github":
            await github_proxy.prepare(self, path_parts, user)
        elif path_part == "gitlab":
            await gitlab_proxy.prepare(self, path_parts, user)
        else:
            self.set_status(404)
        self.finish()
