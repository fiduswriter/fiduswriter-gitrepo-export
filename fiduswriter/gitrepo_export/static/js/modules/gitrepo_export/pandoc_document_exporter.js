import {get} from "../../common"
import {convert} from "pandoc-wasm"
import {PandocExporter} from "../../exporter/pandoc"

export class PandocDocGitExporter extends PandocExporter {
    constructor(
        format,
        fileExtension,
        mimeType,
        options,
        doc,
        bibDB,
        imageDB,
        csl,
        updated,
        repo
    ) {
        super(doc, bibDB, imageDB, csl, updated)
        this.format = format
        this.fileExtension = fileExtension
        this.mimeType = mimeType
        this.options = options || {}
        this.repo = repo
    }

    createExport() {
        return Promise.all(
            this.httpFiles.map(binaryFile =>
                get(binaryFile.url)
                    .then(response => response.blob())
                    .then(blob =>
                        Promise.resolve({
                            contents: blob,
                            filename: binaryFile.filename
                        })
                    )
            )
        )
            .then(binaryFiles => {
                const files = {}
                this.textFiles.forEach(file => {
                    files[file.filename] = file.contents
                })
                binaryFiles.forEach(file => {
                    files[file.filename] = file.contents
                })
                const options = {
                    from: "json",
                    to: this.format,
                    standalone: true
                }
                if (files["bibliography.bib"]) {
                    options.bibliography = "bibliography.bib"
                    options.citeproc = true
                }
                const content = JSON.stringify(this.conversion.json)
                return convert(options, content, files)
            })
            .then(({stdout: out}) => {
                if (this.options.fullFileExport) {
                    const blob =
                        out instanceof Blob
                            ? out
                            : new Blob([out], {type: this.mimeType})
                    return this.returnSingleFile(blob)
                }
                this.textFiles.push({
                    filename: `document.${this.fileExtension}`,
                    contents: out
                })
                if (!this.options.includeBibliography) {
                    this.textFiles = this.textFiles.filter(
                        file => file.filename !== "bibliography.bib"
                    )
                }
                return this.returnFiles()
            })
    }
}
