import {Dialog, addAlert, escapeText, gettext} from "fwtoolkit"
import {
    DOCXBookGithubExporter,
    EpubBookGithubExporter,
    FidusBookGithubExporter,
    HTMLBookGithubExporter,
    LatexBookGithubExporter,
    ODTBookGithubExporter,
    PandocBookGithubExporter,
    SingleFileHTMLBookGithubExporter,
    UnpackedEpubBookGithubExporter
} from "./book_exporters"
import {commitTree, promiseChain} from "./tools"

const EXPORTER_MAP = {
    fidus: FidusBookGithubExporter,
    epub: EpubBookGithubExporter,
    unpacked_epub: UnpackedEpubBookGithubExporter,
    html: HTMLBookGithubExporter,
    unified_html: SingleFileHTMLBookGithubExporter,
    latex: LatexBookGithubExporter,
    odt: ODTBookGithubExporter,
    docx: DOCXBookGithubExporter
}

export class GithubBookProcessor {
    constructor(
        app,
        booksOverview,
        book,
        bookRepo,
        userRepo,
        availableFormats
    ) {
        this.app = app
        this.booksOverview = booksOverview
        this.book = book
        this.bookRepo = bookRepo
        this.userRepo = userRepo
        this.availableFormats = availableFormats || []
    }

    init() {
        return this.getCommitMessage()
            .then(commitMessage => this.publishBook(commitMessage))
            .catch(() => {})
    }

    getCommitMessage() {
        return new Promise((resolve, reject) => {
            const buttons = [
                {
                    text: gettext("Submit"),
                    classes: "fw-dark",
                    click: () => {
                        const commitMessage =
                            dialog.dialogEl.querySelector(".commit-message")
                                .value || gettext("Update from Fidus Writer")
                        dialog.close()
                        resolve(commitMessage)
                    }
                },
                {
                    type: "cancel",
                    click: () => {
                        dialog.close()
                        reject()
                    }
                }
            ]
            const dialog = new Dialog({
                title: gettext("Commit message"),
                height: 150,
                body: `<p>${gettext("Updating")}: ${escapeText(this.book.title)}
                    <input type="text" class="commit-message" placeholder="${gettext("Enter commit message")}"></p>`,
                buttons
            })
            dialog.open()
        })
    }

    publishBook(commitMessage) {
        addAlert("info", gettext("Book publishing to GitHub initiated."))
        const commitInitiators = []
        const targets = this.bookRepo.targets || []

        targets.forEach(targetKey => {
            const ExporterClass = this._getExporterClass(targetKey)
            if (ExporterClass) {
                let exporter
                if (targetKey.startsWith("pandoc:")) {
                    const formatInfo = this.availableFormats.find(
                        f => f.key === targetKey
                    )
                    if (formatInfo) {
                        const format = targetKey.slice(7)
                        const options = {}
                        if (format === "rtf") {
                            options.fullFileExport = true
                        } else if (format === "typst") {
                            options.includeBibliography = true
                        }
                        exporter = new ExporterClass(
                            this.booksOverview.schema,
                            this.booksOverview.app.csl,
                            this.book,
                            this.booksOverview.user,
                            this.booksOverview.documentList,
                            new Date(this.book.updated * 1000),
                            format,
                            formatInfo.ext,
                            "application/octet-stream",
                            options,
                            this.userRepo
                        )
                    }
                } else if (targetKey === "latex") {
                    exporter = new ExporterClass(
                        this.booksOverview.schema,
                        this.book,
                        this.booksOverview.user,
                        this.booksOverview.documentList,
                        new Date(this.book.updated * 1000),
                        this.userRepo
                    )
                } else if (targetKey === "fidus") {
                    exporter = new ExporterClass(
                        this.booksOverview.schema,
                        this.book,
                        this.booksOverview.user,
                        this.booksOverview.documentList,
                        new Date(this.book.updated * 1000),
                        this.userRepo
                    )
                } else {
                    exporter = new ExporterClass(
                        this.booksOverview.schema,
                        this.booksOverview.app.csl,
                        this.booksOverview.styles,
                        this.book,
                        this.booksOverview.user,
                        this.booksOverview.documentList,
                        new Date(this.book.updated * 1000),
                        this.userRepo
                    )
                }
                if (exporter) {
                    commitInitiators.push(exporter.init())
                }
            }
        })
        return Promise.all(commitInitiators).then(commitFunctions =>
            promiseChain(commitFunctions.flat()).then(responses => {
                const responseCodes = responses.flat()
                if (responseCodes.every(code => code === 304)) {
                    addAlert(
                        "info",
                        gettext("Book already up to date in repository.")
                    )
                } else if (responseCodes.every(code => code === 400)) {
                    addAlert(
                        "error",
                        gettext("Could not publish book to repository.")
                    )
                } else if (responseCodes.find(code => code === 400)) {
                    addAlert(
                        "error",
                        gettext(
                            "Could not publish some parts of book to repository."
                        )
                    )
                } else {
                    commitTree(
                        responseCodes.filter(
                            response => typeof response === "object"
                        ),
                        commitMessage,
                        this.userRepo
                    ).then(() =>
                        addAlert(
                            "info",
                            gettext(
                                "Book published to repository successfully!"
                            )
                        )
                    )
                }
            })
        )
    }

    _getExporterClass(targetKey) {
        if (EXPORTER_MAP[targetKey]) {
            return EXPORTER_MAP[targetKey]
        }
        if (targetKey.startsWith("pandoc:")) {
            return this._getPandocExporterClass()
        }
        return null
    }

    _getPandocExporterClass() {
        return PandocBookGithubExporter
    }
}
