import {getJson} from "../../common"

export function commitTree(tree, repo) {
    let branch, parentSha
    return getJson(`/proxy/github_export/repos/${repo}`.replace(/\/\//, '/')).then(
        repoJson => {
            branch = repoJson.default_branch
            return getJson(`/proxy/github_export/repos/${repo}/git/refs/heads/${branch}`.replace(/\/\//, '/'))
        }).then(
        refsJson => {
            parentSha = refsJson.object.sha
            return fetch(
                `/proxy/github_export/repos/${repo}/git/trees`.replace(/\/\//, '/'),
                {
                    headers: {
                        Accept: "application/vnd.github.v3+json"
                    },
                    method: 'POST',
                    credentials: 'include',
                    body: JSON.stringify({
                        tree,
                        base_tree: parentSha
                    })
                }
            )
        }).then(
        response => response.json()
    ).then(
        treeJson => fetch(
            `/proxy/github_export/repos/${repo}/git/commits`.replace(/\/\//, '/'),
            {
                headers: {
                    Accept: "application/vnd.github.v3+json"
                },
                method: 'POST',
                credentials: 'include',
                body: JSON.stringify({
                    tree: treeJson.sha,
                    parents: [parentSha],
                    message: "UPDATED WITH FW"
                })
            }
        )
    ).then(
        response => response.json()
    ).then(
        commitJson => fetch(
            `/proxy/github_export/repos/${repo}/git/refs/heads/${branch}`.replace(/\/\//, '/'),
            {
                headers: {
                    Accept: "application/vnd.github.v3+json"
                },
                method: 'PATCH',
                credentials: 'include',
                body: JSON.stringify({
                    sha: commitJson.sha
                })
            }
        )
    )
}
