import {PandocConversionExporter} from "@fiduswriter/pandoc/exporter"

export class PandocDocGitExporter extends PandocConversionExporter {
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
        super(
            format,
            fileExtension,
            mimeType,
            options,
            doc,
            bibDB,
            imageDB,
            csl,
            updated
        )
        this.repo = repo
    }

    createExport() {
        return this.runPandocConversion().then(({stdout: out}) => {
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
