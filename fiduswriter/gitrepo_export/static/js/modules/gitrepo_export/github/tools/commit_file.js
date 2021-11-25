import {getJson} from "../../../common"
import {gitHashObject} from "../../tools"

export function commitFile(repo, blob, filename, parentDir = '', repoDirCache = {}) {
    let sha
    const dirUrl = `/proxy/gitrepo_export/github/repos/${repo}/contents/${parentDir}`.replace(/\/\//, '/')
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
        return new Promise(resolve => {
            const reader = new FileReader()
            reader.readAsDataURL(blob)
            reader.onload = function() {
                commitData.content = reader.result.split('base64,')[1]
                resolve(commitData)
            }
        }).then(
            commitData => {
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
                    hashSha => {
                        sha = hashSha
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
        return fetch(`/proxy/gitrepo_export/github/repos/${repo}/git/blobs`.replace(/\/\//, '/'), {
            method: 'POST',
            credentials: 'include',
            body: JSON.stringify(commitData)
        }).then(
            response => {
                if (response.ok) {
                    return response.json().then(
                        json => {
                            const treeObject = {
                                path: `${parentDir}${filename}`,
                                sha: json.sha || sha,
                                mode: "100644",
                                type: "blob"
                            }
                            if (!treeObject.sha) {
                                const binaryString = atob(commitData.content)
                                return gitHashObject(
                                    binaryString,
                                    // UTF-8 files seem to have no type set.
                                    // Not sure if this is actually a viable way to distinguish between utf-8 and binary files.
                                    !blob.type.length
                                ).then(
                                    hashSha => {
                                        treeObject.sha = hashSha
                                        return treeObject
                                    }
                                )
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