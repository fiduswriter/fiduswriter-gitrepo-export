import {getJson} from "../../../common"
import {readBlobPromise, gitHashObject} from "../../tools"

export function commitFiles(repo, commitMessage, files) {
    return getJson(`/proxy/gitrepo_export/gitlab/repo/${repo.id}/`).then(
        repoFileList => {
            const commitUrl = `/proxy/gitrepo_export/gitlab/projects/${repo.id}/repository/commits`
            const getActions = Object.entries(files).map(
                ([file_path, blob]) => readBlobPromise(blob).then(
                    content => {
                        const fileEntry = Array.isArray(repoFileList) ? repoFileList.find(
                            entry => (
                                entry.type === "blob" &&
                                entry.path === file_path
                            )
                        ) : false
                        if (!fileEntry) {
                            return {
                                action: "create",
                                encoding: "base64",
                                file_path,
                                content
                            }
                        }
                        return gitHashObject(
                            // Gitlab converts all line endings of text files to unix file line endings.
                            blob.type.length ?
                                atob(content) :
                                atob(content).replace(/\r\n/g, "\n"),
                            // UTF-8 files seem to have no type set.
                            // Not sure if this is actually a viable way to distinguish between utf-8 and binary files.
                            !blob.type.length
                        ).then(
                            sha => {
                                if (sha === fileEntry.id) {
                                    return false
                                } else {
                                    return {
                                        action: "update",
                                        encoding: "base64",
                                        file_path,
                                        content
                                    }
                                }
                            }
                        )

                    }
                )
            )
            return Promise.all(getActions).then(
                actions => {
                    actions = actions.filter(action => action) // Remove files that are not to be updated/added.
                    if (!actions.length) {
                        return 304
                    }
                    const commitData = {
                        branch: "main",
                        commit_message: commitMessage,
                        actions
                    }
                    return fetch(commitUrl, {
                        method: "POST",
                        credentials: "include",
                        body: JSON.stringify(commitData)
                    }).then(
                        () => 201
                    )
                }
            )
        }
    )
}
