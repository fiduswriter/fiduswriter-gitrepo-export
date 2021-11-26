import json
from allauth.socialaccount.models import SocialToken

from . import models
from . import github_proxy
from . import gitlab_proxy

ALLOWED_METHODS = [
    "GET",
]


async def prepare(proxy_connector, path_parts, user):
    path_part = path_parts.pop(0) if len(path_parts) else None
    if path_part == "repos":
        await get_repos(proxy_connector, path_parts, user)


async def get_repos(proxy_connector, path_parts, user):
    if proxy_connector.request.method not in ALLOWED_METHODS:
        proxy_connector.set_status(405)
        return
    path_part = path_parts.pop(0) if len(path_parts) else None
    if path_part == "reload":
        reload = True
    else:
        reload = False
    social_tokens = {
        "github": SocialToken.objects.filter(
            account__user=user, account__provider="github"
        ).first(),
        "gitlab": SocialToken.objects.filter(
            account__user=user, account__provider="gitlab"
        ).first(),
    }

    if not social_tokens["github"] and not social_tokens["gitlab"]:
        proxy_connector.set_status(401)
        return
    repo_info = models.RepoInfo.objects.filter(user=user).first()
    if repo_info:
        if reload:
            repo_info.delete()
        else:
            proxy_connector.set_status(200)
            proxy_connector.write(json.dumps(repo_info.content))
            return
    repos = []
    if social_tokens["github"]:
        repos += await github_proxy.get_repos(
            proxy_connector, social_tokens["github"]
        )
    if social_tokens["gitlab"]:
        repos += await gitlab_proxy.get_repos(
            proxy_connector, social_tokens["gitlab"]
        )
    repo_info, created = models.RepoInfo.objects.get_or_create(user=user)
    repo_info.content = repos
    repo_info.save()
    proxy_connector.set_status(200)
    proxy_connector.write(json.dumps(repo_info.content))
