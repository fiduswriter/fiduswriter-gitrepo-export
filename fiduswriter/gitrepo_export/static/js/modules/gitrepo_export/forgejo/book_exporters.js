import {DOCXBookExporter} from "../../books/exporter/docx"
import {EpubBookExporter} from "../../books/exporter/epub"
import {HTMLBookExporter} from "../../books/exporter/html"
import {LatexBookExporter} from "../../books/exporter/latex"
import {ODTBookExporter} from "../../books/exporter/odt"
import {commitFile, commitZipContents} from "./tools"
import {PandocBookGitExporter} from "../pandoc_book_exporter"

export class EpubBookForgejoExporter extends EpubBookExporter {
    constructor(schema, csl, bookStyles, book, user, docList, updated, repo) {
        super(schema, csl, bookStyles, book, user, docList, updated)
        this.repo = repo
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
    createZip() {
        return commitZipContents(
            this.repo,
            this.outputList,
            this.binaryFiles,
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
