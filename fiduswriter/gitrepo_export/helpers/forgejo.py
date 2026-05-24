import json

from httpx import AsyncClient, Request

API_PREFIX = "/api/v1"


def forgejorepo2repodata(repo, instance_url, server_id):
    return {
        "type": "forgejo",
        "server_id": server_id,
        "instance_url": instance_url,
        "name": repo["full_name"],
        "id": repo["id"],
        "branch": repo.get("default_branch", "main"),
    }


async def get_repos(instance_url, token, server_id):
    headers = {"Authorization": f"Bearer {token}"}
    url = f"{instance_url}{API_PREFIX}/user/repos?type=all&per_page=100"
    request = Request("GET", url, headers=headers)
    async with AsyncClient(timeout=88) as client:
        response = await client.send(request)
    content = json.loads(response.text)
    if isinstance(content, list):
        return [
            forgejorepo2repodata(r, instance_url, server_id) for r in content
        ]
    return []


async def proxy(
    instance_url, token, path, query_string, body, method, content_type=None
):
    headers = {"Authorization": f"Bearer {token}"}
    if content_type:
        headers["Content-Type"] = content_type
    url = f"{instance_url}{API_PREFIX}/{path}"
    if query_string:
        url += "?" + query_string
    if method == "GET":
        body = None
    request = Request(method, url, headers=headers, content=body)
    async with AsyncClient(timeout=88) as client:
        response = await client.send(request)
    return response
