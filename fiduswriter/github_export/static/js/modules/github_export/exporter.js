import {getJson, addAlert} from "../common"
import {ProcessBook} from "./process_book"

export class GithubExporter {
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
        const exporter = new ProcessBook(
            this.booksOverview.schema,
            this.booksOverview.app.csl,
            this.booksOverview.styles,
            book,
            this.booksOverview.user,
            this.booksOverview.documentList,
            blob => this.commitBook(book, userRepo, blob)
        )
        exporter.init()
    }

    commitBook(book, repo, blob) {
        return getJson(
            `/proxy/github_export/repos/${repo}/contents/`
        ).then(json => {
            const epubEntry = Array.isArray(json) ? json.find(entry => entry.name === 'book.epub') : false
            const commitData = {
                message: gettext('Update from Fidus Writer'),
            }
            if (epubEntry) {
                commitData.sha = epubEntry.sha
            }
            return new Promise(resolve => {
                const reader = new FileReader()
                reader.readAsDataURL(blob)
                reader.onload = function() {
                    commitData.content = reader.result.split('base64,')[1]
                    resolve(commitData)
                }
            })

        }).then(commitData => {
            return fetch(`/proxy/github_export/repos/${repo}/contents/book.epub`, {
                method: 'PUT',
                credentials: 'include',
                body: JSON.stringify(commitData)
            }).then(
                () => addAlert('info', gettext('Book published to Github successfully!'))
            )
        }).catch(
            () => addAlert('error', gettext('Could not publish book to Github.'))
        )
    }
}
