import {commitFile} from "./commit_file"
import {promiseChain} from "./promise_chain"
import {get} from "../../../common"

export function commitZipContents(repo, outputList, binaryFiles, includeZips, parentDir = "") {
    const repoDirCache = {}
    const textCommitFunctions = outputList.map(file => {
        const blob = new Blob([file.contents])
        const filepathParts = file.filename.split("/")
        const filename = filepathParts.pop()
        const subDir = `${parentDir}${filepathParts.join("/")}/`.replace(/\/\//, "/")
        return () => commitFile(
            repo,
            blob,
            filename,
            subDir,
            repoDirCache
        )
    })
    const commitBinaries = binaryFiles.map(file => get(file.url).then(response => response.blob()).then(blob => {
        const filepathParts = file.filename.split("/")
        const filename = filepathParts.pop()
        const subDir = `${parentDir}${filepathParts.join("/")}/`.replace(/\/\//, "/")
        return () => commitFile(
            repo,
            blob,
            filename,
            subDir,
            repoDirCache
        )
    }))
    const commitZips = import("jszip").then(({default: JSZip}) => {
        return includeZips.map(
            zipFile => get(zipFile.url).then(response => response.blob()).then(blob => {
                const zipfs = new JSZip()
                return zipfs.loadAsync(blob).then(
                    () => {
                        const files = []
                        zipfs.forEach(file => files.push(file))
                        return Promise.all(files.map(filepath => zipfs.files[filepath].async("blob"))).then(
                            blobs => blobs.map((blob, index) => {
                                const filepath = files[index]
                                const filepathParts = filepath.split("/")
                                const filename = filepathParts.pop()
                                const dir = zipFile.directory ? [zipFile.directory].concat(filepathParts) : filepathParts
                                const subDir = `${parentDir}${dir.join("/")}/`.replace(/\/\//, "/")
                                return () => commitFile(
                                    repo,
                                    blob,
                                    filename,
                                    subDir,
                                    repoDirCache
                                )
                            })
                        )
                    }
                )
            })
        )
    })
    return Promise.resolve(commitZips).then(
        zips => Promise.all(commitBinaries).then((binaryCommitFunctions) => Promise.all(zips).then(
            zipCommitFunctions => textCommitFunctions.concat(binaryCommitFunctions).concat(zipCommitFunctions).flat()
        ))
    ).then(
        commitFunctions => promiseChain(commitFunctions)
    )
}
