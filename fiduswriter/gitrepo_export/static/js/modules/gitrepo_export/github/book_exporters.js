import {DOCXBookExporter} from "@fiduswriter/books-document/exporter/docx"
import {EpubBookExporter} from "@fiduswriter/books-document/exporter/epub"
import {HTMLBookExporter} from "@fiduswriter/books-document/exporter/html"
import {LatexBookExporter} from "@fiduswriter/books-document/exporter/latex"
import {ODTBookExporter} from "@fiduswriter/books-document/exporter/odt"
import {FidusBookGitExporter} from "../fidus_exporters"
import {PandocBookGitExporter} from "../pandoc_book_exporter"
import {commitFile, commitZipContents} from "./tools"

export class EpubBookGithubExporter extends EpubBookExporter {
    constructor(schema, csl, bookStyles, book, user, docList, updated, repo) {
        super(schema, csl, bookStyles, book, user, docList, updated)
        this.repo = repo
    }
    async init() {
        const originalCreateZip = this.createZip.bind(this)
        let cachedResult
        this.createZip = () => {
            if (cachedResult === undefined) {
                cachedResult = originalCreateZip()
            }
            return cachedResult
        }
        const result = await super.init()
        if (result === false) {
            return false
        }
        return cachedResult
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
    async init() {
        const originalCreateZip = this.createZip.bind(this)
        let cachedResult
        this.createZip = () => {
            if (cachedResult === undefined) {
                cachedResult = originalCreateZip()
            }
            return cachedResult
        }
        const result = await super.init()
        if (result === false) {
            return false
        }
        return cachedResult
    }
    createZip() {
        return () =>
            commitZipContents(
                this.repo,
                this.textFiles,
                this.httpFiles,
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
    async init() {
        const originalCreateZip = this.createZip.bind(this)
        let cachedResult
        this.createZip = () => {
            if (cachedResult === undefined) {
                cachedResult = originalCreateZip()
            }
            return cachedResult
        }
        const result = await super.init()
        if (result === false) {
            return false
        }
        return cachedResult
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

export class SingleFileHTMLBookGithubExporter extends HTMLBookExporter {
    constructor(schema, csl, bookStyles, book, user, docList, updated, repo) {
        super(schema, csl, bookStyles, book, user, docList, updated, false)
        this.repo = repo
    }
    async init() {
        const originalCreateZip = this.createZip.bind(this)
        let cachedResult
        this.createZip = () => {
            if (cachedResult === undefined) {
                cachedResult = originalCreateZip()
            }
            return cachedResult
        }
        const result = await super.init()
        if (result === false) {
            return false
        }
        return cachedResult
    }
    createZip() {
        return () =>
            commitZipContents(
                this.repo,
                this.textFiles,
                this.httpFiles,
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

export class PandocBookGithubExporter extends PandocBookGitExporter {
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

export class FidusBookGithubExporter extends FidusBookGitExporter {
    init() {
        return super.init().then(blobMap => {
            const blob = blobMap["book.fidusbook"]
            return () =>
                commitFile(this.repo, blob, "book.fidusbook").then(response => [
                    response
                ])
        })
    }
}
