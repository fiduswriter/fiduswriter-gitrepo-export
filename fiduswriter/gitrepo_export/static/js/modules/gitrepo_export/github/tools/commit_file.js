import {getJson} from "../../../common"
import {gitHashObject, readBlobPromise} from "../../tools"

export function commitFile(repo, blob, filename, parentDir = "", repoDirCache = {}) {
    const dirUrl = `/proxy/gitrepo_export/github/repos/${repo.name}/contents/${parentDir}`.replace(/\/\//, "/")
    const getDirJsonPromise = repoDirCache[dirUrl] ?
        Promise.resolve(repoDirCache[dirUrl]) :
        getJson(dirUrl).then(
            json => {
                repoDirCache[dirUrl] = json
                return Promise.resolve(json)
            }
        )
    return Promise.resolve(getDirJsonPromise).then(json => {
        const fileEntry = Array.isArray(json) ? json.find(entry => entry.name === filename) : false
        const commitData = {
            encoding: "base64",
        }
        return readBlobPromise(blob).then(
            content => {
                commitData.content = content
                if (!fileEntry) {
                    return Promise.resolve(commitData)
                }
                const binaryString = atob(commitData.content)
                if (fileEntry.size !== binaryString.length) {
                    return Promise.resolve(commitData)
                }
                return gitHashObject(
                    binaryString,
                    // UTF-8 files seem to have no type set.
                    // Not sure if this is actually a viable way to distinguish between utf-8 and binary files.
                    !blob.type.length
                ).then(
                    sha => {
                        if (sha === fileEntry.sha) {
                            return Promise.resolve(304)
                        } else {
                            return Promise.resolve(commitData)
                        }
                    }
                )
            }
        )

    }).then(commitData => {
        if (!commitData || commitData === 304) {
            return Promise.resolve(304)
        }
        return fetch(`/proxy/gitrepo_export/github/repos/${repo.name}/git/blobs`.replace(/\/\//, "/"), {
            method: "POST",
            credentials: "include",
            body: JSON.stringify(commitData)
        }).then(
            response => {
                if (response.ok) {
                    return response.json().then(
                        json => {
                            const treeObject = {
                                path: `${parentDir}${filename}`,
                                sha: json.sha,
                                mode: "100644",
                                type: "blob"
                            }
                            return treeObject
                        }
                    )
                } else {
                    return Promise.resolve(400)
                }
            }
        )
    }).catch(
        _error => {
            return Promise.resolve(400)
        }
    )
}
