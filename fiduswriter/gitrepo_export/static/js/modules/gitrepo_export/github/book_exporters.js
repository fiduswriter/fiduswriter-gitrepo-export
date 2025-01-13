import {DOCXBookExporter} from "../../books/exporter/docx"
import {EpubBookExporter} from "../../books/exporter/epub"
import {HTMLBookExporter} from "../../books/exporter/html"
import {LatexBookExporter} from "../../books/exporter/latex"
import {ODTBookExporter} from "../../books/exporter/odt"
import {commitFile, commitZipContents} from "./tools"

export class EpubBookGithubExporter extends EpubBookExporter {
    constructor(schema, csl, bookStyles, book, user, docList, updated, repo) {
        super(schema, csl, bookStyles, book, user, docList, updated)
        this.repo = repo
    }

    download(blob) {
        return () =>
            commitFile(this.repo, blob, "book.epub").then(response => [
                response
            ])
    }
}

export class UnpackedEpubBookGithubExporter extends EpubBookExporter {
    constructor(schema, csl, bookStyles, book, user, docList, updated, repo) {
        super(schema, csl, bookStyles, book, user, docList, updated)
        this.repo = repo
    }

    createZip() {
        return () =>
            commitZipContents(
                this.repo,
                this.outputList,
                this.binaryFiles,
                this.includeZips,
                "epub/"
            )
    }
}

export class HTMLBookGithubExporter extends HTMLBookExporter {
    constructor(schema, csl, bookStyles, book, user, docList, updated, repo) {
        super(schema, csl, bookStyles, book, user, docList, updated)
        this.repo = repo
    }

    createZip() {
        return () =>
            commitZipContents(
                this.repo,
                this.outputList,
                this.binaryFiles,
                this.includeZips,
                "html/"
            )
    }
}

export class SingleFileHTMLBookGithubExporter extends HTMLBookExporter {
    constructor(schema, csl, bookStyles, book, user, docList, updated, repo) {
        super(schema, csl, bookStyles, book, user, docList, updated, false)
        this.repo = repo
    }

    createZip() {
        return () =>
            commitZipContents(
                this.repo,
                this.outputList,
                this.binaryFiles,
                this.includeZips,
                "uhtml/"
            )
    }
}

export class LatexBookGithubExporter extends LatexBookExporter {
    constructor(schema, book, user, docList, updated, repo) {
        super(schema, book, user, docList, updated)
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

export class DOCXBookGithubExporter extends DOCXBookExporter {
    constructor(schema, csl, book, user, docList, updated, repo) {
        super(schema, csl, book, user, docList, updated)
        this.repo = repo
    }

    download(blob) {
        return () =>
            commitFile(this.repo, blob, "book.docx").then(response => [
                response
            ])
    }
}

export class ODTBookGithubExporter extends ODTBookExporter {
    constructor(schema, csl, book, user, docList, updated, repo) {
        super(schema, csl, book, user, docList, updated)
        this.repo = repo
    }

    download(blob) {
        return () =>
            commitFile(this.repo, blob, "book.odt").then(response => [response])
    }
}
