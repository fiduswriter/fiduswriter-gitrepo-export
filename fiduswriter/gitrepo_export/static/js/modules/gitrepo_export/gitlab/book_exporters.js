import {DOCXBookExporter} from "../../books/exporter/docx"
import {EpubBookExporter} from "../../books/exporter/epub"
import {HTMLBookExporter} from "../../books/exporter/html"
import {LatexBookExporter} from "../../books/exporter/latex"
import {ODTBookExporter} from "../../books/exporter/odt"
import {zipToBlobs} from "./tools"

export class EpubBookGitlabExporter extends EpubBookExporter {
    constructor(schema, csl, bookStyles, book, user, docList, updated, repo) {
        super(schema, csl, bookStyles, book, user, docList, updated)
        this.repo = repo
    }

    download(blob) {
        return Promise.resolve({
            "book.epub": blob
        })
    }
}

export class UnpackedEpubBookGitlabExporter extends EpubBookExporter {
    constructor(schema, csl, bookStyles, book, user, docList, updated, repo) {
        super(schema, csl, bookStyles, book, user, docList, updated)
        this.repo = repo
    }

    createZip() {
        return zipToBlobs(
            this.outputList,
            this.binaryFiles,
            this.includeZips,
            "epub/"
        )
    }
}

export class HTMLBookGitlabExporter extends HTMLBookExporter {
    constructor(schema, csl, bookStyles, book, user, docList, updated, repo) {
        super(schema, csl, bookStyles, book, user, docList, updated)
        this.repo = repo
    }

    createZip() {
        return zipToBlobs(
            this.outputList,
            this.binaryFiles,
            this.includeZips,
            "html/"
        )
    }
}

export class SingleFileHTMLBookGitlabExporter extends HTMLBookExporter {
    constructor(schema, csl, bookStyles, book, user, docList, updated, repo) {
        super(schema, csl, bookStyles, book, user, docList, updated, false)
        this.repo = repo
    }

    createZip() {
        return zipToBlobs(
            this.outputList,
            this.binaryFiles,
            this.includeZips,
            "uhtml/"
        )
    }
}

export class LatexBookGitlabExporter extends LatexBookExporter {
    constructor(schema, book, user, docList, updated, repo) {
        super(schema, book, user, docList, updated)
        this.repo = repo
    }

    createZip() {
        return zipToBlobs(this.textFiles, this.httpFiles, [], "latex/")
    }
}

export class DOCXBookGitlabExporter extends DOCXBookExporter {
    constructor(schema, csl, book, user, docList, updated, repo) {
        super(schema, csl, book, user, docList, updated)
        this.repo = repo
    }

    download(blob) {
        return Promise.resolve({
            "book.docx": blob
        })
    }
}

export class ODTBookGitlabExporter extends ODTBookExporter {
    constructor(schema, csl, book, user, docList, updated, repo) {
        super(schema, csl, book, user, docList, updated)
        this.repo = repo
    }

    download(blob) {
        return Promise.resolve({
            "book.odt": blob
        })
    }
}
