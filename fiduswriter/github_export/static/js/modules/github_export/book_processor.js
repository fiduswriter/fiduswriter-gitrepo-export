import {addAlert} from "../common"
import {EpubBookGithubExporter, UnpackedEpubBookGithubExporter, HTMLBookGithubExporter, LatexBookGithubExporter} from "./book_exporters"
import {promiseChain} from "./tools"

export class GithubBookProcessor {
    constructor(app, booksOverview, booksOverviewExporter, books) {
        this.app = app
        this.booksOverview = booksOverview
        this.booksOverviewExporter = booksOverviewExporter
        this.books = books
    }

    init() {
        this.books.forEach(book => this.processBook(book))
    }

    processBook(book) {
        const bookRepo = this.booksOverviewExporter.bookRepos[book.id]
        if (!bookRepo) {
            addAlert('error', `${gettext('There is no github repository registered for the book:')} ${book.title}`)
            return
        }
        const userRepo = this.booksOverviewExporter.userRepos[bookRepo.github_repo_id]
        if (!userRepo) {
            addAlert('error', `${gettext('You do not have access to the repository:')} ${bookRepo.github_repo_full_name}`)
            return
        }
        addAlert('info', gettext('Book publishing to Github initiated.'))

        const commitInitiators = []

        if (bookRepo.export_epub) {
            const epubExporter = new EpubBookGithubExporter(
                this.booksOverview.schema,
                this.booksOverview.app.csl,
                this.booksOverview.styles,
                book,
                this.booksOverview.user,
                this.booksOverview.documentList,
                new Date(book.updated*1000),
                userRepo
            )
            commitInitiators.push(
                epubExporter.init()
            )
        }

        if (bookRepo.export_unpacked_epub) {
            const unpackedEpubExporter = new UnpackedEpubBookGithubExporter(
                this.booksOverview.schema,
                this.booksOverview.app.csl,
                this.booksOverview.styles,
                book,
                this.booksOverview.user,
                this.booksOverview.documentList,
                new Date(book.updated*1000),
                userRepo
            )
            commitInitiators.push(
                unpackedEpubExporter.init()
            )
        }

        if (bookRepo.export_html) {
            const htmlExporter = new HTMLBookGithubExporter(
                this.booksOverview.schema,
                this.booksOverview.app.csl,
                this.booksOverview.styles,
                book,
                this.booksOverview.user,
                this.booksOverview.documentList,
                new Date(book.updated*1000),
                userRepo
            )
            commitInitiators.push(
                htmlExporter.init()
            )
        }

        if (bookRepo.export_latex) {
            const latexExporter = new LatexBookGithubExporter(
                this.booksOverview.schema,
                book,
                this.booksOverview.user,
                this.booksOverview.documentList,
                new Date(book.updated*1000),
                userRepo
            )
            commitInitiators.push(
                latexExporter.init()
            )
        }

        return Promise.all(commitInitiators).then(commitFunctions => promiseChain(commitFunctions.flat()).then(
            responses => {
                const responseCodes = responses.flat()
                if (responseCodes.every(code => code === 304)) {
                    addAlert('info', gettext('Book already up to date in repository.'))
                } else if (responseCodes.every(code => code === 400)) {
                    addAlert('error', gettext('Could not publish book to repository.'))
                } else if (responseCodes.find(code => code === 400)) {
                    addAlert('error', gettext('Could not publish some parts of book to repository.'))
                } else if (responseCodes.every(code => code === 201)) {
                    addAlert('info', gettext('Book published to repository successfully!'))
                } else {
                    addAlert('info', gettext('Book updated in repository successfully!'))
                }
            }
        ))
    }
}
