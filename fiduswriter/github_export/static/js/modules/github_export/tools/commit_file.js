import {getJson} from "../../common"

export function commitFile(repo, blob, filename, parentDir = '/', repoDirCache = {}) {
    const dirUrl = `/proxy/github_export/repos/${repo}/contents${parentDir}`.replace(/\/\//, '/')
    const getDirJsonPromise = repoDirCache[dirUrl] ?
        Promise.resolve(repoDirCache[dirUrl]) :
        getJson(dirUrl).then(
            json => {
                repoDirCache[dirUrl] = json
                return Promise.resolve(json)
            }
        )
    return Promise.resolve(getDirJsonPromise).catch(
        response => {
            if (response.status === 404) {
                return Promise.resolve([])
            }
            throw response
        }
    ).then(json => {
        const fileEntry = Array.isArray(json) ? json.find(entry => entry.name === filename) : false
        const commitData = {
            message: gettext('Update from Fidus Writer'),
        }
        if (fileEntry) {
            commitData.sha = fileEntry.sha
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
                const binaryString = atob(commitData.content)
                if (!fileEntry || fileEntry.size !== binaryString.length) {
                    return Promise.resolve(commitData)
                }
                // We haven't figured out how to calculate the correct sha1 value, so instead we download the original
                // file and compare (works up to 100 MB)
                return getJson(
                    `/proxy/github_export/repos/${repo}/git/blobs/${fileEntry.sha}`
                ).then(
                    json => {
                        if (btoa(atob(json.content || '')) === commitData.content) {
                            return Promise.resolve()
                        } else {
                            return Promise.resolve(commitData)
                        }
                    }
                )

            }
        )

    }).then(commitData => {
        if (!commitData) {
            return Promise.resolve(304)
        }
        return fetch(`/proxy/github_export/repos/${repo}/contents${parentDir}${filename}`.replace(/\/\//, '/'), {
            method: 'PUT',
            credentials: 'include',
            body: JSON.stringify(commitData)
        }).then(
            response => {
                if (response.ok) {
                    const status = commitData.sha ? 200 : 201
                    return Promise.resolve(status)
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
