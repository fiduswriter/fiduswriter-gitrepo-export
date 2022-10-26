import {getJson} from "../../../common"

export function commitTree(tree, commitMessage, repo) {
    let branch, parentSha
    return getJson(`/proxy/gitrepo_export/github/repos/${repo.name}`.replace(/\/\//, "/")).then(
        repoJson => {
            branch = repoJson.default_branch
            return getJson(`/proxy/gitrepo_export/github/repos/${repo.name}/git/refs/heads/${branch}`.replace(/\/\//, "/"))
        }).then(
        refsJson => {
            parentSha = refsJson.object.sha
            return fetch(
                `/proxy/gitrepo_export/github/repos/${repo.name}/git/trees`.replace(/\/\//, "/"),
                {
                    method: "POST",
                    credentials: "include",
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
            `/proxy/gitrepo_export/github/repos/${repo.name}/git/commits`.replace(/\/\//, "/"),
            {
                method: "POST",
                credentials: "include",
                body: JSON.stringify({
                    tree: treeJson.sha,
                    parents: [parentSha],
                    message: commitMessage
                })
            }
        )
    ).then(
        response => response.json()
    ).then(
        commitJson => fetch(
            `/proxy/gitrepo_export/github/repos/${repo.name}/git/refs/heads/${branch}`.replace(/\/\//, "/"),
            {
                method: "PATCH",
                credentials: "include",
                body: JSON.stringify({
                    sha: commitJson.sha
                })
            }
        )
    )
}
