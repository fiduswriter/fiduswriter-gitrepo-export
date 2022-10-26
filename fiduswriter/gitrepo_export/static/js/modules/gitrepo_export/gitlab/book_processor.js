import {addAlert, Dialog, escapeText} from "../../common"
import {EpubBookGitlabExporter, UnpackedEpubBookGitlabExporter, HTMLBookGitlabExporter, LatexBookGitlabExporter, SingleFileHTMLBookGitlabExporter} from "./book_exporters"
import {commitFiles} from "./tools"

export class GitlabBookProcessor {
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
        addAlert("info", gettext("Book publishing to GitLab initiated."))

        const fileGetters = []

        if (this.bookRepo.export_epub) {
            const epubExporter = new EpubBookGitlabExporter(
                this.booksOverview.schema,
                this.booksOverview.app.csl,
                this.booksOverview.styles,
                this.book,
                this.booksOverview.user,
                this.booksOverview.documentList,
                new Date(this.book.updated * 1000),
                this.userRepo
            )
            fileGetters.push(
                epubExporter.init()
            )
        }

        if (this.bookRepo.export_unpacked_epub) {
            const unpackedEpubExporter = new UnpackedEpubBookGitlabExporter(
                this.booksOverview.schema,
                this.booksOverview.app.csl,
                this.booksOverview.styles,
                this.book,
                this.booksOverview.user,
                this.booksOverview.documentList,
                new Date(this.book.updated * 1000),
                this.userRepo
            )
            fileGetters.push(
                unpackedEpubExporter.init()
            )
        }

        if (this.bookRepo.export_html) {
            const htmlExporter = new HTMLBookGitlabExporter(
                this.booksOverview.schema,
                this.booksOverview.app.csl,
                this.booksOverview.styles,
                this.book,
                this.booksOverview.user,
                this.booksOverview.documentList,
                new Date(this.book.updated * 1000),
                this.userRepo
            )
            fileGetters.push(
                htmlExporter.init()
            )
        }

        if (this.bookRepo.export_unified_html) {
            const unifiedHtmlExporter = new SingleFileHTMLBookGitlabExporter(
                this.booksOverview.schema,
                this.booksOverview.app.csl,
                this.booksOverview.styles,
                this.book,
                this.booksOverview.user,
                this.booksOverview.documentList,
                new Date(this.book.updated * 1000),
                this.userRepo
            )
            fileGetters.push(
                unifiedHtmlExporter.init()
            )
        }

        if (this.bookRepo.export_latex) {
            const latexExporter = new LatexBookGitlabExporter(
                this.booksOverview.schema,
                this.book,
                this.booksOverview.user,
                this.booksOverview.documentList,
                new Date(this.book.updated * 1000),
                this.userRepo
            )
            fileGetters.push(
                latexExporter.init()
            )
        }
        return Promise.all(fileGetters).then(
            files => commitFiles(this.userRepo, commitMessage, Object.assign(...files))
        ).then(
            returnCode => {
                switch (returnCode) {
                case 201:
                    addAlert("info", gettext("Book published to repository successfully!"))
                    break
                case 304:
                    addAlert("info", gettext("Book already up to date in repository."))
                    break
                case 400:
                    addAlert("error", gettext("Could not publish book to repository."))
                    break
                }

            }
        )
    }
}
