import {DOCXExporter} from "../../exporter/docx"
import {EpubExporter} from "../../exporter/epub"
import {HTMLExporter} from "../../exporter/html"
import {LatexExporter} from "../../exporter/latex"
import {ODTExporter} from "../../exporter/odt"
import {commitFile, commitZipContents} from "./tools"
import {PandocDocGitExporter} from "../pandoc_document_exporter"

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
                ""
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
            commitZipContents(this.repo, this.textFiles, this.httpFiles, [], "")
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
            commitFile(
                this.repo,
                blob,
                `document.${this.fileExtension}`
            ).then(response => [response])
    }

    returnFiles() {
        return () =>
            commitZipContents(
                this.repo,
                this.textFiles,
                this.httpFiles,
                [],
                ""
            )
    }
}
