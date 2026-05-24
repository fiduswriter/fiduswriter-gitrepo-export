import {DOCXExporter} from "../../exporter/docx"
import {EpubExporter} from "../../exporter/epub"
import {HTMLExporter} from "../../exporter/html"
import {LatexExporter} from "../../exporter/latex"
import {ODTExporter} from "../../exporter/odt"

export class EpubDocForgejoExporter extends EpubExporter {
    constructor(doc, bibDB, imageDB, csl, updated, documentStyles, repo) {
        super(doc, bibDB, imageDB, csl, updated, documentStyles)
        this.repo = repo
    }
    download(blob) {
        // Return the result for batch commit, do not commit here.
        return Promise.resolve({filename: "document.epub", blob})
    }
}

export class HTMLDocForgejoExporter extends HTMLExporter {
    constructor(doc, bibDB, imageDB, csl, updated, documentStyles, repo) {
        super(doc, bibDB, imageDB, csl, updated, documentStyles)
        this.repo = repo
    }
    createZip() {
        // Return the result for batch commit, do not commit here.
        // Place HTML files in a dedicated subfolder.
        return Promise.resolve({
            textFiles: this.textFiles.map(file => ({
                ...file,
                filename: `html/${file.filename}`
            })),
            httpFiles: this.httpFiles.map(file => ({
                ...file,
                filename: `html/${file.filename}`
            })),
            includeZips: this.includeZips.map(zipFile => ({
                ...zipFile,
                directory: zipFile.directory
                    ? `html/${zipFile.directory}`
                    : "html"
            }))
        })
    }
}

export class LatexDocForgejoExporter extends LatexExporter {
    constructor(doc, bibDB, imageDB, updated, repo) {
        super(doc, bibDB, imageDB, updated)
        this.repo = repo
    }
    createZip() {
        // Return the result for batch commit, do not commit here.
        // Place LaTeX files in a dedicated subfolder.
        return Promise.resolve({
            textFiles: this.textFiles.map(file => ({
                ...file,
                filename: `latex/${file.filename}`
            })),
            httpFiles: this.httpFiles.map(file => ({
                ...file,
                filename: `latex/${file.filename}`
            })),
            includeZips: []
        })
    }
}

export class DOCXDocForgejoExporter extends DOCXExporter {
    constructor(doc, templateUrl, bibDB, imageDB, csl, repo) {
        super(doc, templateUrl, bibDB, imageDB, csl)
        this.repo = repo
    }
    download(blob) {
        // Return the result for batch commit, do not commit here.
        return Promise.resolve({filename: "document.docx", blob})
    }
}

export class ODTDocForgejoExporter extends ODTExporter {
    constructor(doc, templateUrl, bibDB, imageDB, csl, repo) {
        super(doc, templateUrl, bibDB, imageDB, csl)
        this.repo = repo
    }
    download(blob) {
        // Return the result for batch commit, do not commit here.
        return Promise.resolve({filename: "document.odt", blob})
    }
}
