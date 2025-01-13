import {getCookie, getJson} from "../../../common"

export function commitTree(tree, commitMessage, repo) {
    let branch, parentSha
    const csrfToken = getCookie("csrftoken")
    return getJson(
        `/api/gitrepo_export/proxy_github/repos/${repo.name}`.replace(
            /\/\//,
            "/"
        )
    )
        .then(repoJson => {
            branch = repoJson.default_branch
            return getJson(
                `/api/gitrepo_export/proxy_github/repos/${repo.name}/git/refs/heads/${branch}`.replace(
                    /\/\//,
                    "/"
                )
            )
        })
        .then(refsJson => {
            parentSha = refsJson.object.sha
            return fetch(
                `/api/gitrepo_export/proxy_github/repos/${repo.name}/git/trees`.replace(
                    /\/\//,
                    "/"
                ),
                {
                    method: "POST",
                    headers: {
                        "X-CSRFToken": csrfToken
                    },
                    credentials: "include",
                    body: JSON.stringify({
                        tree,
                        base_tree: parentSha
                    })
                }
            )
        })
        .then(response => response.json())
        .then(treeJson =>
            fetch(
                `/api/gitrepo_export/proxy_github/repos/${repo.name}/git/commits`.replace(
                    /\/\//,
                    "/"
                ),
                {
                    method: "POST",
                    headers: {
                        "X-CSRFToken": csrfToken
                    },
                    credentials: "include",
                    body: JSON.stringify({
                        tree: treeJson.sha,
                        parents: [parentSha],
                        message: commitMessage
                    })
                }
            )
        )
        .then(response => response.json())
        .then(commitJson =>
            fetch(
                `/api/gitrepo_export/proxy_github/repos/${repo.name}/git/refs/heads/${branch}`.replace(
                    /\/\//,
                    "/"
                ),
                {
                    method: "PATCH",
                    headers: {
                        "X-CSRFToken": csrfToken
                    },
                    credentials: "include",
                    body: JSON.stringify({
                        sha: commitJson.sha
                    })
                }
            )
        )
}
