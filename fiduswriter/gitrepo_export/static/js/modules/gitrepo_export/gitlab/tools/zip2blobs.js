import {get} from "../../../common"

export function zipToBlobs(outputList, binaryFiles, includeZips, parentDir = "") {
    const outputFiles = {}
    outputList.forEach(file => {
        outputFiles[`${parentDir}${file.filename}`] = new Blob([file.contents])
    })
    const commitBinaries = binaryFiles.map(file => get(file.url).then(response => response.blob()).then(blob => {
        outputFiles[`${parentDir}${file.filename}`] = blob
    }))
    const commitZips = import("jszip").then(({default: JSZip}) => {
        return includeZips.map(
            zipFile => get(zipFile.url).then(response => response.blob()).then(blob => {
                const zipfs = new JSZip()
                return zipfs.loadAsync(blob).then(
                    () => {
                        const files = []
                        zipfs.forEach(file => files.push(file))
                        return Promise.all(
                            files.map(
                                filepath => zipfs.files[filepath].async("blob")
                            )
                        ).then(
                            blobs => blobs.map((blob, index) => {
                                const filepath = files[index]
                                outputFiles[`${parentDir}${filepath}`] = blob
                            })
                        )
                    }
                )
            })
        )
    })
    return Promise.all(commitBinaries.concat(commitZips)).then(
        () => outputFiles
    )
}
