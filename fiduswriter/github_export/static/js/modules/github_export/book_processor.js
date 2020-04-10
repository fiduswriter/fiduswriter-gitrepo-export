import {addAlert} from "../common"
import {EpubBookGithubExporter} from "./book_exporters"

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
        const exporter = new EpubBookGithubExporter(
            this.booksOverview.schema,
            this.booksOverview.app.csl,
            this.booksOverview.styles,
            book,
            this.booksOverview.user,
            this.booksOverview.documentList,
            new Date(book.updated*1000),
            userRepo
        )
        exporter.init()
    }
}
