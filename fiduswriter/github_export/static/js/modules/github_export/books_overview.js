import {getJson, post} from "../common"
import {repoSelectorTemplate} from "./templates"
import {GithubBookProcessor} from "./book_processor"

export class GithubExporterBooksOverview {
    constructor(booksOverview) {
        this.booksOverview = booksOverview
        this.userRepos = {}
        this.bookRepos = {}
        this.finishedLoading = false
        this.openedBook = false
    }

    init() {
        const githubAccount = this.booksOverview.app.config.user.socialaccounts.find(account => account.provider==='github')
        if (!githubAccount) {
            return
        }
        Promise.all([
            this.getUserRepos(),
            this.getBookRepos()
        ]).then(
            () => {
                this.finishedLoading = true
                const spinner = document.querySelector('tbody.github-repository .fa-spinner')
                if (spinner) {
                    document.querySelector('tbody.github-repository').innerHTML = repoSelectorTemplate({
                        book: this.openedBook,
                        userRepos: this.userRepos,
                        bookRepos: this.bookRepos
                    })
                }
            }
        )
        this.addButton()
        this.addDialogPart()
        this.addDialogSaveMethod()
    }

    getUserRepos(page=1) {
        return getJson(
            `/proxy/github_export/user/repos?page=${page}&per_page=100`
        ).then(json => {
            json.forEach(entry => this.userRepos[entry.id] = entry.full_name)
            if (json.length === 100) {
                return this.getUserRepos(page + 1)
            } else {
                return Promise.resolve()
            }
        }

        )
    }

    getBookRepos() {
        return getJson(`/api/github_export/get_book_repos/`).then(
            json => {
                this.bookRepos = json['book_repos']
            }
        )
    }

    addButton() {
        this.booksOverview.dtBulkModel.content.push({
            title: gettext('Export to Github'),
            tooltip: gettext('Export selected to Github.'),
            action: overview => {
                const ids = overview.getSelected()
                if (ids.length) {
                    const exporter = new GithubBookProcessor(
                        overview.app,
                        this.booksOverview,
                        this,
                        overview.bookList.filter(book => ids.includes(book.id))
                    )
                    exporter.init()
                }
            },
            disabled: overview => !overview.getSelected().length
        })
    }

    addDialogPart() {
        this.booksOverview.mod.actions.dialogParts.push({
            title: gettext('Github'),
            description: gettext('Github related settings'),
            template: ({book}) => {
                this.openedBook = book
                return `<table class="fw-dialog-table">
                    <tbody class="github-repository">
                    ${
                        this.finishedLoading ?
                            repoSelectorTemplate({book, userRepos: this.userRepos, bookRepos: this.bookRepos}) :
                            '<tr><th></th><td><i class="fa fa-spinner fa-pulse"></i></td></tr>'
                    }
                    </tbody>
                </table>`
            }

        })
    }

    addDialogSaveMethod() {
        this.booksOverview.mod.actions.onSave.push(
            book => {
                const repoSelector = document.querySelector('#book-settings-repository')
                if (!repoSelector) {
                    // Dialog may have been closed before the repoSelector was loaded
                    return
                }
                let githubRepoId = parseInt(repoSelector.value)
                const exportEpub = document.querySelector('#book-settings-repository-epub').checked
                const exportUnpackedEpub = document.querySelector('#book-settings-repository-unpacked-epub').checked
                const exportHtml = document.querySelector('#book-settings-repository-html').checked
                const exportLatex = document.querySelector('#book-settings-repository-latex').checked
                if (!exportEpub && !exportUnpackedEpub && !exportHtml && !exportLatex) {
                    // No export formats selected. Reset repository.
                    githubRepoId = 0
                }
                if (
                    (githubRepoId === 0 && this.bookRepos[book.id]) ||
                    (githubRepoId > 0 &&
                        (
                            !this.bookRepos[book.id] ||
                            this.bookRepos[book.id].github_repo_id !== githubRepoId ||
                            this.bookRepos[book.id].export_epub !== exportEpub ||
                            this.bookRepos[book.id].export_unpacked_epub !== exportUnpackedEpub ||
                            this.bookRepos[book.id].export_html !== exportHtml ||
                            this.bookRepos[book.id].export_latex !== exportLatex
                        )
                    )
                ) {
                    const postData = {
                        book_id: book.id,
                        github_repo_id: githubRepoId
                    }
                    if (githubRepoId > 0) {
                        postData['github_repo_full_name'] = this.userRepos[githubRepoId]
                        postData['export_epub'] = exportEpub
                        postData['export_unpacked_epub'] = exportUnpackedEpub
                        postData['export_html'] = exportHtml
                        postData['export_latex'] = exportLatex
                    }
                    post('/api/github_export/update_book_repo/', postData).then(
                        () => {
                            if (githubRepoId === 0) {
                                delete this.bookRepos[book.id]
                            } else {
                                this.bookRepos[book.id] = {
                                    github_repo_id: githubRepoId,
                                    github_repo_full_name: this.userRepos[githubRepoId],
                                    export_epub: exportEpub,
                                    export_unpacked_epub: exportUnpackedEpub,
                                    export_html: exportHtml,
                                    export_latex: exportLatex
                                }
                            }

                        }
                    )
                }
            }
        )
    }

}
