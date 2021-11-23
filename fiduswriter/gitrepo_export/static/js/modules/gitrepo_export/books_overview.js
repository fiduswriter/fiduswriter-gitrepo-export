import {getJson, post, findTarget} from "../common"
import {repoSelectorTemplate} from "./templates"
import {GithubBookProcessor} from "./github"

export class GitrepoExporterBooksOverview {
    constructor(booksOverview) {
        this.booksOverview = booksOverview
        this.userRepos = {}
        this.bookRepos = {}
        this.finishedLoading = false
        this.openedBook = false
    }

    init() {
        const githubAccount = this.booksOverview.app.config.user.socialaccounts.find(account => account.provider === 'github')
        if (!githubAccount) {
            return
        }
        Promise.all([
            this.getUserRepos(),
            this.getBookRepos()
        ]).then(
            () => {
                this.finishedLoading = true
                const spinner = document.querySelector('tbody.gitrepo-repository .fa-spinner')
                if (spinner) {
                    document.querySelector('tbody.gitrepo-repository').innerHTML = repoSelectorTemplate({
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
        this.bind()
    }

    bind() {
        window.document.body.addEventListener('click', event => {
            const el = {}
            switch (true) {
            case findTarget(event, 'tbody.gitrepo-repository .reload', el):
                this.resetUserRepos()
                break
            default:
                break
            }
        })
    }

    resetUserRepos() {
        this.finishedLoading = false
        const repoSelector = document.querySelector('tbody.gitrepo-repository')
        if (repoSelector) {
            repoSelector.innerHTML = '<tr><th></th><td><i class="fa fa-spinner fa-pulse"></i></td></tr>'
        }

        this.getUserRepos(true).then(
            () => {
                this.finishedLoading = true
                const repoSelector = document.querySelector('tbody.gitrepo-repository')
                if (repoSelector) {
                    repoSelector.innerHTML = repoSelectorTemplate({
                        book: this.openedBook,
                        userRepos: this.userRepos,
                        bookRepos: this.bookRepos
                    })
                }
            }
        )
    }

    getUserRepos(reload = false) {
        if (reload) {
            this.userRepos = {}
        }
        return getJson(
            `/proxy/gitrepo_export/user/repos${reload ? '/reload' : ''}`
        ).then(
            json => json.forEach(entry => this.userRepos[entry.id] = entry.name)
        )
    }

    getBookRepos() {
        return getJson(`/api/gitrepo_export/get_book_repos/`).then(
            json => {
                this.bookRepos = json['book_repos']
            }
        )
    }

    addButton() {
        this.booksOverview.dtBulkModel.content.push({
            title: gettext('Export to Git Repository'),
            tooltip: gettext('Export selected to Git repository.'),
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
        this.booksOverview.mod.actions.exportMenu.content.push({
            title: gettext('Export to Git Repository'),
            tooltip: gettext('Export book to git repository.'),
            action: ({saveBook, book, overview}) => {
                saveBook().then(
                    () => {
                        const exporter = new GithubBookProcessor(
                            overview.app,
                            overview,
                            this,
                            [book]
                        )
                        exporter.init()
                    }
                )
            },
        })
    }

    addDialogPart() {
        this.booksOverview.mod.actions.dialogParts.push({
            title: gettext('Git repository'),
            description: gettext('Git repository related settings'),
            template: ({book}) => {
                this.openedBook = book
                return `<table class="fw-dialog-table">
                    <tbody class="gitrepo-repository">
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
                let repoId = parseInt(repoSelector.value)
                const exportEpub = document.querySelector('#book-settings-repository-epub').checked
                const exportUnpackedEpub = document.querySelector('#book-settings-repository-unpacked-epub').checked
                const exportHtml = document.querySelector('#book-settings-repository-html').checked
                const exportUnifiedHtml = document.querySelector('#book-settings-repository-unified-html').checked
                const exportLatex = document.querySelector('#book-settings-repository-latex').checked
                if (!exportEpub && !exportUnpackedEpub && !exportHtml && !exportUnifiedHtml && !exportLatex) {
                    // No export formats selected. Reset repository.
                    repoId = 0
                }
                if (
                    (repoId === 0 && this.bookRepos[book.id]) ||
                    (repoId > 0 &&
                        (
                            !this.bookRepos[book.id] ||
                            this.bookRepos[book.id].repo_id !== repoId ||
                            this.bookRepos[book.id].export_epub !== exportEpub ||
                            this.bookRepos[book.id].export_unpacked_epub !== exportUnpackedEpub ||
                            this.bookRepos[book.id].export_html !== exportHtml ||
                            this.bookRepos[book.id].export_unified_html !== exportUnifiedHtml ||
                            this.bookRepos[book.id].export_latex !== exportLatex
                        )
                    )
                ) {
                    const postData = {
                        book_id: book.id,
                        repo_id: repoId
                    }
                    if (repoId > 0) {
                        postData['repo_name'] = this.userRepos[repoId]
                        postData['export_epub'] = exportEpub
                        postData['export_unpacked_epub'] = exportUnpackedEpub
                        postData['export_html'] = exportHtml
                        postData['export_unified_html'] = exportUnifiedHtml
                        postData['export_latex'] = exportLatex
                    }
                    return post('/api/gitrepo_export/update_book_repo/', postData).then(
                        () => {
                            if (repoId === 0) {
                                delete this.bookRepos[book.id]
                            } else {
                                this.bookRepos[book.id] = {
                                    repo_id: repoId,
                                    repo_name: this.userRepos[repoId],
                                    export_epub: exportEpub,
                                    export_unpacked_epub: exportUnpackedEpub,
                                    export_html: exportHtml,
                                    export_unified_html: exportUnifiedHtml,
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
