import {Dialog, addAlert, escapeText, gettext} from "fwtoolkit"
import {
    DOCXBookForgejoExporter,
    EpubBookForgejoExporter,
    FidusBookForgejoExporter,
    HTMLBookForgejoExporter,
    LatexBookForgejoExporter,
    ODTBookForgejoExporter,
    PandocBookForgejoExporter
} from "./book_exporters"

const EXPORTER_MAP = {
    fidus: FidusBookForgejoExporter,
    epub: EpubBookForgejoExporter,
    html: HTMLBookForgejoExporter,
    latex: LatexBookForgejoExporter,
    odt: ODTBookForgejoExporter,
    docx: DOCXBookForgejoExporter
}

export class ForgejoBookProcessor {
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
        addAlert("info", gettext("Book publishing to Forgejo initiated."))
        const targets = this.bookRepo.targets || []

        const exportPromises = targets.map(targetKey => {
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
                    exporter.commitMessage = commitMessage
                    return exporter.init()
                }
            }
            return Promise.resolve()
        })

        return Promise.all(exportPromises).then(results => {
            if (results.some(r => r === 400)) {
                addAlert(
                    "error",
                    gettext(
                        "Could not publish some parts of book to repository."
                    )
                )
            } else {
                addAlert(
                    "info",
                    gettext("Book published to repository successfully!")
                )
            }
        })
    }

    _getExporterClass(targetKey) {
        if (EXPORTER_MAP[targetKey]) {
            return EXPORTER_MAP[targetKey]
        }
        if (targetKey.startsWith("pandoc:")) {
            return PandocBookForgejoExporter
        }
        return null
    }
}
