import {get, getCookie, getJson} from "fwtoolkit"
import {readBlobPromise} from "../../tools"

function getRepoFileShas(repo, branch = "main") {
    const serverId = repo.server_id
    return getJson(
        `/api/gitrepo_export/proxy_forgejo/${serverId}/repos/${repo.name}/git/trees/${branch}?recursive=1`.replace(
            /\/\//,
            "/"
        )
    )
        .then(({tree}) => {
            const shaMap = {}
            if (Array.isArray(tree)) {
                tree.forEach(entry => {
                    if (entry.path && entry.sha && entry.type === "blob") {
                        shaMap[entry.path] = entry.sha
                    }
                })
            }
            return shaMap
        })
        .catch(() => ({}))
}

export function commitFile(
    repo,
    blob,
    filepath,
    message = "Update from Fidus Writer",
    branch = "main"
) {
    const csrfToken = getCookie("csrftoken")
    const serverId = repo.server_id
    return readBlobPromise(blob)
        .then(content => {
            const body = {
                content,
                message,
                branch
            }
            return getJson(
                `/api/gitrepo_export/proxy_forgejo/${serverId}/repos/${repo.name}/contents/${filepath}`.replace(
                    /\/\//,
                    "/"
                )
            )
                .then(existing => {
                    if (existing && existing.sha) {
                        body.sha = existing.sha
                    }
                })
                .catch(() => {})
                .then(() => {
                    const method = body.sha ? "PUT" : "POST"
                    return fetch(
                        `/api/gitrepo_export/proxy_forgejo/${serverId}/repos/${repo.name}/contents/${filepath}`.replace(
                            /\/\//,
                            "/"
                        ),
                        {
                            method,
                            headers: {
                                "X-CSRFToken": csrfToken,
                                "Content-Type": "application/json"
                            },
                            credentials: "include",
                            body: JSON.stringify(body)
                        }
                    )
                })
                .then(response => {
                    if (!response.ok) {
                        return 400
                    }
                    return response.json()
                })
        })
        .catch(() => 400)
}

export function commitFilesBatch(
    repo,
    files,
    message = "Update from Fidus Writer",
    branch = "main"
) {
    const csrfToken = getCookie("csrftoken")
    const serverId = repo.server_id
    const fileEntries = Object.entries(files)

    if (fileEntries.length === 0) {
        return Promise.resolve()
    }

    return Promise.all(
        fileEntries.map(([filepath, blob]) =>
            readBlobPromise(blob).then(content => ({filepath, content}))
        )
    )
        .then(fileContents =>
            getRepoFileShas(repo, branch).then(shaMap =>
                fileContents.map(({filepath, content}) => {
                    const sha = shaMap[filepath]
                    if (sha) {
                        return {
                            operation: "update",
                            path: filepath,
                            content,
                            sha
                        }
                    }
                    return {
                        operation: "create",
                        path: filepath,
                        content
                    }
                })
            )
        )
        .then(fileOperations => {
            const body = {
                branch,
                message,
                files: fileOperations
            }
            return fetch(
                `/api/gitrepo_export/proxy_forgejo/${serverId}/repos/${repo.name}/contents`.replace(
                    /\/\//,
                    "/"
                ),
                {
                    method: "POST",
                    headers: {
                        "X-CSRFToken": csrfToken,
                        "Content-Type": "application/json"
                    },
                    credentials: "include",
                    body: JSON.stringify(body)
                }
            ).then(response => {
                if (!response.ok) {
                    return 400
                }
                return response.json()
            })
        })
        .catch(() => 400)
}

export function commitZipContents(
    repo,
    outputList,
    binaryFiles,
    includeZips,
    parentDir = "",
    message = "Update from Fidus Writer",
    branch = "main"
) {
    const files = {}
    outputList.forEach(file => {
        files[`${parentDir}${file.filename}`] = new Blob([file.contents])
    })
    const binaryPromises = binaryFiles.map(file =>
        get(file.url)
            .then(response => response.blob())
            .then(blob => {
                files[`${parentDir}${file.filename}`] = blob
            })
    )
    const zipPromises = import("jszip").then(({default: JSZip}) => {
        return includeZips.map(zipFile =>
            get(zipFile.url)
                .then(response => response.blob())
                .then(blob => {
                    const zipfs = new JSZip()
                    return zipfs.loadAsync(blob).then(() => {
                        const zipFiles = []
                        zipfs.forEach(file => zipFiles.push(file))
                        return Promise.all(
                            zipFiles.map(filepath =>
                                zipfs.files[filepath].async("blob")
                            )
                        ).then(blobs =>
                            blobs.map((blob, index) => {
                                const filepath = zipFiles[index]
                                const dir = zipFile.directory
                                    ? `${zipFile.directory}/${filepath}`
                                    : filepath
                                files[`${parentDir}${dir}`] = blob
                            })
                        )
                    })
                })
        )
    })
    return Promise.all(binaryPromises.concat(zipPromises).flat()).then(() =>
        commitFilesBatch(repo, files, message, branch)
    )
}

export function commitTree(/*tree, commitMessage, repo*/) {
    // Tree-based commits are not yet implemented for Forgejo.
    // Forgejo uses the batch file-by-file content API (repoChangeFiles).
    return Promise.resolve()
}
