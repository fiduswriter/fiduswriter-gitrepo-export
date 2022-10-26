import {addAlert, Dialog, escapeText} from "../../common"
import {EpubBookGithubExporter, UnpackedEpubBookGithubExporter, HTMLBookGithubExporter, LatexBookGithubExporter, SingleFileHTMLBookGithubExporter} from "./book_exporters"
import {promiseChain, commitTree} from "./tools"

export class GithubBookProcessor {
    constructor(app, booksOverview, book, bookRepo, userRepo) {
        this.app = app
        this.booksOverview = booksOverview
        this.book = book
        this.bookRepo = bookRepo
        this.userRepo = userRepo
    }

    init() {
        return this.getCommitMessage().then(
            commitMessage => this.publishBook(commitMessage)
        ).catch(
            () => {}
        )
    }

    getCommitMessage() {
        return new Promise((resolve, reject) => {
            const buttons = [
                {
                    text: gettext("Submit"),
                    classes: "fw-dark",
                    click: () => {
                        const commitMessage = dialog.dialogEl.querySelector(".commit-message").value || gettext("Update from Fidus Writer")
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
                body: `<p>
            ${gettext("Updating")}: ${escapeText(this.book.title)}
            <input type="text" class="commit-message" placeholder="${gettext("Enter commit message")}" >
            </p>`,
                buttons
            })
            dialog.open()
        })
    }

    publishBook(commitMessage) {
        addAlert("info", gettext("Book publishing to GitHub initiated."))

        const commitInitiators = []

        if (this.bookRepo.export_epub) {
            const epubExporter = new EpubBookGithubExporter(
                this.booksOverview.schema,
                this.booksOverview.app.csl,
                this.booksOverview.styles,
                this.book,
                this.booksOverview.user,
                this.booksOverview.documentList,
                new Date(this.book.updated * 1000),
                this.userRepo
            )
            commitInitiators.push(
                epubExporter.init()
            )
        }

        if (this.bookRepo.export_unpacked_epub) {
            const unpackedEpubExporter = new UnpackedEpubBookGithubExporter(
                this.booksOverview.schema,
                this.booksOverview.app.csl,
                this.booksOverview.styles,
                this.book,
                this.booksOverview.user,
                this.booksOverview.documentList,
                new Date(this.book.updated * 1000),
                this.userRepo
            )
            commitInitiators.push(
                unpackedEpubExporter.init()
            )
        }

        if (this.bookRepo.export_html) {
            const htmlExporter = new HTMLBookGithubExporter(
                this.booksOverview.schema,
                this.booksOverview.app.csl,
                this.booksOverview.styles,
                this.book,
                this.booksOverview.user,
                this.booksOverview.documentList,
                new Date(this.book.updated * 1000),
                this.userRepo
            )
            commitInitiators.push(
                htmlExporter.init()
            )
        }

        if (this.bookRepo.export_unified_html) {
            const unifiedHtmlExporter = new SingleFileHTMLBookGithubExporter(
                this.booksOverview.schema,
                this.booksOverview.app.csl,
                this.booksOverview.styles,
                this.book,
                this.booksOverview.user,
                this.booksOverview.documentList,
                new Date(this.book.updated * 1000),
                this.userRepo
            )
            commitInitiators.push(
                unifiedHtmlExporter.init()
            )
        }

        if (this.bookRepo.export_latex) {
            const latexExporter = new LatexBookGithubExporter(
                this.booksOverview.schema,
                this.book,
                this.booksOverview.user,
                this.booksOverview.documentList,
                new Date(this.book.updated * 1000),
                this.userRepo
            )
            commitInitiators.push(
                latexExporter.init()
            )
        }
        return Promise.all(commitInitiators).then(commitFunctions => promiseChain(commitFunctions.flat()).then(
            responses => {
                const responseCodes = responses.flat()
                if (responseCodes.every(code => code === 304)) {
                    addAlert("info", gettext("Book already up to date in repository."))
                } else if (responseCodes.every(code => code === 400)) {
                    addAlert("error", gettext("Could not publish book to repository."))
                } else if (responseCodes.find(code => code === 400)) {
                    addAlert("error", gettext("Could not publish some parts of book to repository."))
                } else {
                    // The responses looks fine, but we are not done yet.
                    commitTree(responseCodes.filter(response => typeof(response) === "object"), commitMessage, this.userRepo).then(
                        () => addAlert("info", gettext("Book published to repository successfully!"))
                    )
                }
            }
        ))
    }
}
