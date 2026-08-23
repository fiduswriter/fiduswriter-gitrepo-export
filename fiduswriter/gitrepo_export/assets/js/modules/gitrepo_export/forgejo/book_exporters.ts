import {DOCXBookExporter} from "@fiduswriter/books-document/exporter/docx"
import {EpubBookExporter} from "@fiduswriter/books-document/exporter/epub"
import {HTMLBookExporter} from "@fiduswriter/books-document/exporter/html"
import {LatexBookExporter} from "@fiduswriter/books-document/exporter/latex"
import {ODTBookExporter} from "@fiduswriter/books-document/exporter/odt"
import {FidusBookGitExporter} from "../fidus_exporters"
import {PandocBookGitExporter} from "../pandoc_book_exporter"
import {commitFile, commitZipContents} from "./tools"

export class EpubBookForgejoExporter extends EpubBookExporter {
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
        return commitFile(this.repo, blob, "book.epub", this.commitMessage)
    }
}

export class HTMLBookForgejoExporter extends HTMLBookExporter {
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
        return commitZipContents(
            this.repo,
            this.textFiles,
            this.httpFiles,
            this.includeZips,
            "html/",
            this.commitMessage
        )
    }
}

export class LatexBookForgejoExporter extends LatexBookExporter {
    constructor(schema, book, user, docList, updated, repo) {
        super(schema, book, user, docList, updated)
        this.repo = repo
    }
    createZip() {
        return commitZipContents(
            this.repo,
            this.textFiles,
            this.httpFiles,
            [],
            "latex/",
            this.commitMessage
        )
    }
}

export class DOCXBookForgejoExporter extends DOCXBookExporter {
    constructor(schema, csl, book, user, docList, updated, repo) {
        super(schema, csl, book, user, docList, updated)
        this.repo = repo
    }
    download(blob) {
        return commitFile(this.repo, blob, "book.docx", this.commitMessage)
    }
}

export class ODTBookForgejoExporter extends ODTBookExporter {
    constructor(schema, csl, book, user, docList, updated, repo) {
        super(schema, csl, book, user, docList, updated)
        this.repo = repo
    }
    download(blob) {
        return commitFile(this.repo, blob, "book.odt", this.commitMessage)
    }
}

export class PandocBookForgejoExporter extends PandocBookGitExporter {
    returnFiles() {
        return commitZipContents(
            this.repo,
            this.textFiles,
            this.httpFiles,
            [],
            `${this.format}/`,
            this.commitMessage
        )
    }
}

export class FidusBookForgejoExporter extends FidusBookGitExporter {
    init() {
        return super
            .init()
            .then(blobMap =>
                commitFile(
                    this.repo,
                    blobMap["book.fidusbook"],
                    "book.fidusbook",
                    this.commitMessage
                )
            )
    }
}
