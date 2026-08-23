import {addAlert, findTarget, getJson, gettext, post} from "fwtoolkit"
import {ForgejoDocumentProcessor} from "./forgejo"
import {GitServerManagerDialog} from "./git_server_management"
import {GithubDocumentProcessor} from "./github"
import {GitlabDocumentProcessor} from "./gitlab"
import {docRepoSettingsTemplate} from "./templates"

export class GitrepoExporterDocsOverview {
    constructor(docsOverview) {
        this.docsOverview = docsOverview
        this.userRepos = {}
        this.userReposMultitype = false
        this.docRepos = {}
        this.availableFormats = []
        this.finishedLoading = false
        this.openedDoc = false
    }

    init() {
        this.addButton()
        this.addDialogPart()
        this.addDialogSaveMethod()
        this.bind()
        this.getUserRepos()
        this.getDocRepos()
    }

    bind() {
        window.document.body.addEventListener("click", event => {
            const el = {}
            switch (true) {
                case findTarget(event, "#gitrepo-doc-settings .reload", el):
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
        Promise.all([this.getUserRepos(true), this.fetchFormats()])
            .then(() => {
                this.finishedLoading = true
                this.renderDocSettings()
            })
            .catch(() => {
                this.finishedLoading = true
                this.renderDocSettings()
            })
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

    getDocRepos() {
        return getJson("/api/gitrepo_export/get_document_repos/").then(
            ({repos}) => {
                this.docRepos = repos
            }
        )
    }

    getRepos(doc) {
        const docRepo = this.docRepos[String(doc.id)]
        if (!docRepo) {
            addAlert(
                "error",
                `${gettext("There is no git repository registered for the document:")} ${doc.title}`
            )
            return [false, false]
        }
        const userRepo =
            this.userRepos[docRepo.repo_type + "-" + docRepo.repo_id]
        if (!userRepo) {
            addAlert(
                "error",
                `${gettext("You do not have access to the repository.")}`
            )
            return [docRepo, false]
        }
        return [docRepo, userRepo]
    }

    loadDialogData() {
        this.finishedLoading = false
        Promise.all([
            this.getUserRepos(),
            this.getDocRepos(),
            this.fetchFormats()
        ])
            .then(() => {
                this.finishedLoading = true
                this.renderDocSettings()
            })
            .catch(() => {
                this.finishedLoading = true
                this.renderDocSettings()
            })
    }

    renderDocSettings() {
        const container = document.querySelector("#gitrepo-doc-settings")
        if (container && this.openedDoc) {
            container.innerHTML = docRepoSettingsTemplate({
                doc: this.openedDoc,
                userRepos: this.userRepos,
                docRepos: this.docRepos,
                userReposMultitype: this.userReposMultitype,
                availableFormats: this.availableFormats
            })
        }
    }

    addButton() {
        this.docsOverview.dtBulkModel.content.push({
            title: gettext("Export to Git Repository"),
            tooltip: gettext("Export selected documents to Git repository."),
            action: overview => {
                const ids = overview.getSelected()
                if (ids.length) {
                    overview.documentList
                        .filter(doc => ids.includes(doc.id))
                        .forEach(doc => {
                            const [docRepo, userRepo] = this.getRepos(doc)
                            if (!userRepo) {
                                return
                            }
                            const processor = this._getProcessor(
                                overview,
                                doc,
                                docRepo,
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
    }

    _getProcessor(overview, doc, docRepo, userRepo) {
        switch (userRepo.type) {
            case "github":
                return new GithubDocumentProcessor(
                    overview,
                    doc,
                    docRepo,
                    userRepo,
                    this.availableFormats
                )
            case "gitlab":
                return new GitlabDocumentProcessor(
                    overview,
                    doc,
                    docRepo,
                    userRepo,
                    this.availableFormats
                )
            case "forgejo":
            case "gitea":
                return new ForgejoDocumentProcessor(
                    overview,
                    doc,
                    docRepo,
                    userRepo,
                    this.availableFormats
                )
            default:
                return null
        }
    }

    addDialogPart() {
        this.docsOverview.mod.actions.dialogParts.push({
            title: gettext("Git repository"),
            description: gettext("Git repository related settings"),
            template: ({doc}) => {
                this.openedDoc = doc
                if (!this.finishedLoading) {
                    this.loadDialogData()
                }
                if (!this.finishedLoading) {
                    return `<div id="gitrepo-doc-settings"><table class="fw-dialog-table"><tr><th></th><td><i class="fa fa-spinner fa-pulse"></i></td></tr></table></div>`
                }
                return `<div id="gitrepo-doc-settings">${docRepoSettingsTemplate(
                    {
                        doc,
                        userRepos: this.userRepos,
                        docRepos: this.docRepos,
                        userReposMultitype: this.userReposMultitype,
                        availableFormats: this.availableFormats
                    }
                )}</div>`
            }
        })
    }

    addDialogSaveMethod() {
        this.docsOverview.mod.actions.onSave.push(doc => {
            const repoSelector = document.querySelector(
                "#doc-settings-repository"
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
                (repoId === 0 && this.docRepos[String(doc.id)]) ||
                (repoId > 0 &&
                    (!this.docRepos[String(doc.id)] ||
                        this.docRepos[String(doc.id)].repo_id !== repoId ||
                        JSON.stringify(
                            this.docRepos[String(doc.id)].targets
                        ) !== JSON.stringify(targets)))
            ) {
                const postData = {
                    document_id: doc.id,
                    repo_type: repoType,
                    repo_id: repoId
                }
                if (repoId > 0) {
                    postData["repo_name"] =
                        this.userRepos[`${repoType}-${repoId}`].name
                    postData["targets"] = targets
                }
                return post(
                    "/api/gitrepo_export/update_document_repo/",
                    postData
                ).then(() => {
                    if (repoId === 0) {
                        delete this.docRepos[String(doc.id)]
                    } else {
                        this.docRepos[String(doc.id)] = {
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
