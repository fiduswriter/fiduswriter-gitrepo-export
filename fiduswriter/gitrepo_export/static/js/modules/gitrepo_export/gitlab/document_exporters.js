import {DOCXExporter} from "@fiduswriter/document/exporter/docx/index"
import {EpubExporter} from "@fiduswriter/document/exporter/epub/index"
import {HTMLExporter} from "@fiduswriter/document/exporter/html/index"
import {LatexExporter} from "@fiduswriter/document/exporter/latex/index"
import {ODTExporter} from "@fiduswriter/document/exporter/odt/index"
import {FidusDocGitExporter} from "../fidus_exporters"
import {PandocDocGitExporter} from "../pandoc_document_exporter"
import {zipToBlobs} from "./tools"

export class EpubDocGitlabExporter extends EpubExporter {
    constructor(doc, bibDB, imageDB, csl, updated, documentStyles, repo) {
        super(doc, bibDB, imageDB, csl, updated, documentStyles)
        this.repo = repo
    }

    download(blob) {
        return Promise.resolve({"document.epub": blob})
    }
}

export class HTMLDocGitlabExporter extends HTMLExporter {
    constructor(doc, bibDB, imageDB, csl, updated, documentStyles, repo) {
        super(doc, bibDB, imageDB, csl, updated, documentStyles)
        this.repo = repo
    }

    createZip() {
        return zipToBlobs(
            this.textFiles,
            this.httpFiles,
            this.includeZips,
            "html/"
        )
    }
}

export class LatexDocGitlabExporter extends LatexExporter {
    constructor(doc, bibDB, imageDB, updated, repo) {
        super(doc, bibDB, imageDB, updated)
        this.repo = repo
    }

    createZip() {
        return zipToBlobs(this.textFiles, this.httpFiles, [], "latex/")
    }
}

export class DOCXDocGitlabExporter extends DOCXExporter {
    constructor(doc, templateUrl, bibDB, imageDB, csl, repo) {
        super(doc, templateUrl, bibDB, imageDB, csl)
        this.repo = repo
    }

    download(blob) {
        return Promise.resolve({"document.docx": blob})
    }
}

export class ODTDocGitlabExporter extends ODTExporter {
    constructor(doc, templateUrl, bibDB, imageDB, csl, repo) {
        super(doc, templateUrl, bibDB, imageDB, csl)
        this.repo = repo
    }

    download(blob) {
        return Promise.resolve({"document.odt": blob})
    }
}

export class PandocDocGitlabExporter extends PandocDocGitExporter {
    returnSingleFile(blob) {
        return Promise.resolve({
            [`document.${this.fileExtension}`]: blob
        })
    }

    returnFiles() {
        return zipToBlobs(this.textFiles, this.httpFiles, [], `${this.format}/`)
    }
}

export class FidusDocGitlabExporter extends FidusDocGitExporter {}
