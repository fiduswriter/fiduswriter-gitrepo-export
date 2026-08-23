import {addAlert, findTarget, getJson, gettext, post} from "fwtoolkit"
import {ForgejoBookProcessor} from "./forgejo"
import {GitServerManagerDialog} from "./git_server_management"
import {GithubBookProcessor} from "./github"
import {GitlabBookProcessor} from "./gitlab"
import {repoSelectorTemplate} from "./templates"

export class GitrepoExporterBooksOverview {
    constructor(booksOverview) {
        this.booksOverview = booksOverview
        this.userRepos = {}
        this.userReposMultitype = false
        this.bookRepos = {}
        this.availableFormats = []
        this.finishedLoading = false
        this.openedBook = false
    }

    init() {
        this.addButton()
        this.addDialogPart()
        this.addDialogSaveMethod()
        this.bind()
        this.getUserRepos()
        this.getBookRepos()
    }

    bind() {
        window.document.body.addEventListener("click", event => {
            const el = {}
            switch (true) {
                case findTarget(event, "tbody.gitrepo-repository .reload", el):
                    this.resetUserRepos()
                    break
                case findTarget(event, ".forgejo-servers", el):
                    this.manageGitServers()
                    break
            }
        })
    }

    manageGitServers() {
        const manager = new GitServerManagerDialog(() => {
            this.resetUserRepos()
        })
        manager.open()
    }

    resetUserRepos() {
        this.finishedLoading = false
        const repoSelector = document.querySelector("tbody.gitrepo-repository")
        if (repoSelector) {
            repoSelector.innerHTML =
                '<tr><th></th><td><i class="fa fa-spinner fa-pulse"></i></td></tr>'
        }
        const render = () => {
            this.finishedLoading = true
            const repoSelector = document.querySelector(
                "tbody.gitrepo-repository"
            )
            if (repoSelector) {
                repoSelector.innerHTML = repoSelectorTemplate({
                    book: this.openedBook,
                    userRepos: this.userRepos,
                    bookRepos: this.bookRepos,
                    userReposMultitype: this.userReposMultitype,
                    availableFormats: this.availableFormats
                })
            }
        }
        Promise.all([this.getUserRepos(true), this.fetchFormats()])
            .then(render)
            .catch(render)
    }

    fetchFormats() {
        return getJson("/api/gitrepo_export/get_export_formats/").then(
            ({formats}) => {
                this.availableFormats = formats
            }
        )
    }

    getUserRepos(reload = false) {
        if (reload) {
            this.userRepos = {}
            this.userReposMultitype = false
            this._userReposPromise = null
        }
        if (this._userReposPromise && !reload) {
            return this._userReposPromise
        }
        this._userReposPromise = getJson(
            `/api/gitrepo_export/get_git_repos/${reload ? "reload/" : ""}`
        ).then(({repos}) => {
            const initialType = repos.length ? repos[0].type : ""
            repos.forEach(entry => {
                this.userRepos[entry.type + "-" + entry.id] = entry
                if (entry.type !== initialType) {
                    this.userReposMultitype = true
                }
            })
        })
        return this._userReposPromise
    }

    getBookRepos() {
        return getJson("/api/gitrepo_export/get_book_repos/").then(
            ({repos}) => {
                this.bookRepos = repos
            }
        )
    }

    getRepos(book) {
        const bookRepo = this.bookRepos[String(book.id)]
        if (!bookRepo) {
            addAlert(
                "error",
                `${gettext("There is no git repository registered for the book:")} ${book.title}`
            )
            return [false, false]
        }
        const userRepo =
            this.userRepos[bookRepo.repo_type + "-" + bookRepo.repo_id]
        if (!userRepo) {
            addAlert(
                "error",
                `${gettext("You do not have access to the repository:")} ${bookRepo.repo_name}`
            )
            return [bookRepo, false]
        }
        return [bookRepo, userRepo]
    }

    loadDialogData() {
        this.finishedLoading = false
        Promise.all([
            this.getUserRepos(),
            this.getBookRepos(),
            this.fetchFormats()
        ])
            .then(() => {
                this.finishedLoading = true
                const spinner = document.querySelector(
                    "tbody.gitrepo-repository .fa-spinner"
                )
                if (spinner) {
                    document.querySelector(
                        "tbody.gitrepo-repository"
                    ).innerHTML = repoSelectorTemplate({
                        book: this.openedBook,
                        userRepos: this.userRepos,
                        bookRepos: this.bookRepos,
                        userReposMultitype: this.userReposMultitype,
                        availableFormats: this.availableFormats
                    })
                }
            })
            .catch(() => {
                this.finishedLoading = true
                const spinner = document.querySelector(
                    "tbody.gitrepo-repository .fa-spinner"
                )
                if (spinner) {
                    document.querySelector(
                        "tbody.gitrepo-repository"
                    ).innerHTML = repoSelectorTemplate({
                        book: this.openedBook,
                        userRepos: this.userRepos,
                        bookRepos: this.bookRepos,
                        userReposMultitype: this.userReposMultitype,
                        availableFormats: this.availableFormats
                    })
                }
            })
    }

    addButton() {
        this.booksOverview.dtBulkModel.content.push({
            title: gettext("Export to Git Repository"),
            tooltip: gettext("Export selected to Git repository."),
            action: overview => {
                const ids = overview.getSelected()
                if (ids.length) {
                    overview.bookList
                        .filter(book => ids.includes(book.id))
                        .forEach(book => {
                            const [bookRepo, userRepo] = this.getRepos(book)
                            if (!userRepo) {
                                return
                            }
                            const processor = this._getProcessor(
                                overview,
                                book,
                                bookRepo,
                                userRepo
                            )
                            if (processor) {
                                processor.init()
                            }
                        })
                }
            },
            disabled: overview => !overview.getSelected().length,
            order: 9.5
        })
        this.booksOverview.mod.actions.exportMenu.content.push({
            title: gettext("Export to Git Repository"),
            tooltip: gettext("Export book to git repository."),
            action: ({saveBook, book, overview}) => {
                saveBook().then(() => {
                    const [bookRepo, userRepo] = this.getRepos(book)
                    if (!userRepo) {
                        return
                    }
                    const processor = this._getProcessor(
                        overview,
                        book,
                        bookRepo,
                        userRepo
                    )
                    if (processor) {
                        processor.init()
                    }
                })
            }
        })
    }

    _getProcessor(overview, book, bookRepo, userRepo) {
        switch (userRepo.type) {
            case "github":
                return new GithubBookProcessor(
                    overview.app,
                    overview,
                    book,
                    bookRepo,
                    userRepo,
                    this.availableFormats
                )
            case "gitlab":
                return new GitlabBookProcessor(
                    overview.app,
                    overview,
                    book,
                    bookRepo,
                    userRepo,
                    this.availableFormats
                )
            case "forgejo":
            case "gitea":
                return new ForgejoBookProcessor(
                    overview.app,
                    overview,
                    book,
                    bookRepo,
                    userRepo,
                    this.availableFormats
                )
            default:
                return null
        }
    }

    addDialogPart() {
        this.booksOverview.mod.actions.dialogParts.push({
            title: gettext("Git repository"),
            description: gettext("Git repository related settings"),
            template: ({book}) => {
                this.openedBook = book
                if (!this.finishedLoading) {
                    this.loadDialogData()
                }
                return `<table class="fw-dialog-table">
                    <tbody class="gitrepo-repository">
                        ${
                            this.finishedLoading
                                ? repoSelectorTemplate({
                                      book,
                                      userRepos: this.userRepos,
                                      bookRepos: this.bookRepos,
                                      userReposMultitype:
                                          this.userReposMultitype,
                                      availableFormats: this.availableFormats
                                  })
                                : '<tr><th></th><td><i class="fa fa-spinner fa-pulse"></i></td></tr>'
                        }
                    </tbody>
                </table>`
            }
        })
    }

    addDialogSaveMethod() {
        this.booksOverview.mod.actions.onSave.push(book => {
            const repoSelector = document.querySelector(
                "#book-settings-repository"
            )
            if (!repoSelector) {
                return
            }
            const selected = repoSelector.value.split("-")
            const repoType = selected[0]
            let repoId = parseInt(selected[1])
            const formatCheckboxes = document.querySelectorAll(".export-format")
            const targets = Array.from(formatCheckboxes)
                .filter(cb => cb.checked)
                .map(cb => cb.dataset.key)
            if (targets.length === 0) {
                repoId = 0
            }
            if (
                (repoId === 0 && this.bookRepos[String(book.id)]) ||
                (repoId > 0 &&
                    (!this.bookRepos[String(book.id)] ||
                        this.bookRepos[String(book.id)].repo_id !== repoId ||
                        JSON.stringify(
                            this.bookRepos[String(book.id)].targets
                        ) !== JSON.stringify(targets)))
            ) {
                const postData = {
                    book_id: book.id,
                    repo_type: repoType,
                    repo_id: repoId
                }
                if (repoId > 0) {
                    postData["repo_name"] =
                        this.userRepos[`${repoType}-${repoId}`].name
                    postData["targets"] = targets
                }
                return post(
                    "/api/gitrepo_export/update_book_repo/",
                    postData
                ).then(() => {
                    if (repoId === 0) {
                        delete this.bookRepos[String(book.id)]
                    } else {
                        this.bookRepos[String(book.id)] = {
                            repo_id: repoId,
                            repo_type: repoType,
                            repo_name:
                                this.userRepos[`${repoType}-${repoId}`].name,
                            targets
                        }
                    }
                })
            }
        })
    }
}
