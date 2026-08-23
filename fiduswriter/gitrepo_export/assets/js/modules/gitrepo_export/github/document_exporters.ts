import {DOCXExporter} from "@fiduswriter/document/exporter/docx/index"
import {EpubExporter} from "@fiduswriter/document/exporter/epub/index"
import {HTMLExporter} from "@fiduswriter/document/exporter/html/index"
import {LatexExporter} from "@fiduswriter/document/exporter/latex/index"
import {ODTExporter} from "@fiduswriter/document/exporter/odt/index"
import {FidusDocGitExporter} from "../fidus_exporters"
import {PandocDocGitExporter} from "../pandoc_document_exporter"
import {commitFile, commitZipContents} from "./tools"

export class EpubDocGithubExporter extends EpubExporter {
    constructor(doc, bibDB, imageDB, csl, updated, documentStyles, repo) {
        super(doc, bibDB, imageDB, csl, updated, documentStyles)
        this.repo = repo
    }
    download(blob) {
        return () =>
            commitFile(this.repo, blob, "document.epub").then(response => [
                response
            ])
    }
}

export class HTMLDocGithubExporter extends HTMLExporter {
    constructor(doc, bibDB, imageDB, csl, updated, documentStyles, repo) {
        super(doc, bibDB, imageDB, csl, updated, documentStyles)
        this.repo = repo
    }
    createZip() {
        return () =>
            commitZipContents(
                this.repo,
                this.textFiles,
                this.httpFiles,
                this.includeZips,
                "html/"
            )
    }
}

export class LatexDocGithubExporter extends LatexExporter {
    constructor(doc, bibDB, imageDB, updated, repo) {
        super(doc, bibDB, imageDB, updated)
        this.repo = repo
    }
    createZip() {
        return () =>
            commitZipContents(
                this.repo,
                this.textFiles,
                this.httpFiles,
                [],
                "latex/"
            )
    }
}

export class DOCXDocGithubExporter extends DOCXExporter {
    constructor(doc, templateUrl, bibDB, imageDB, csl, repo) {
        super(doc, templateUrl, bibDB, imageDB, csl)
        this.repo = repo
    }
    download(blob) {
        return () =>
            commitFile(this.repo, blob, "document.docx").then(response => [
                response
            ])
    }
}

export class ODTDocGithubExporter extends ODTExporter {
    constructor(doc, templateUrl, bibDB, imageDB, csl, repo) {
        super(doc, templateUrl, bibDB, imageDB, csl)
        this.repo = repo
    }
    download(blob) {
        return () =>
            commitFile(this.repo, blob, "document.odt").then(response => [
                response
            ])
    }
}

export class PandocDocGithubExporter extends PandocDocGitExporter {
    returnSingleFile(blob) {
        return () =>
            commitFile(this.repo, blob, `document.${this.fileExtension}`).then(
                response => [response]
            )
    }

    returnFiles() {
        return () =>
            commitZipContents(
                this.repo,
                this.textFiles,
                this.httpFiles,
                [],
                `${this.format}/`
            )
    }
}

export class FidusDocGithubExporter extends FidusDocGitExporter {
    init() {
        return super.init().then(blobMap => {
            const blob = blobMap["document.fidus"]
            return () =>
                commitFile(this.repo, blob, "document.fidus").then(response => [
                    response
                ])
        })
    }
}
