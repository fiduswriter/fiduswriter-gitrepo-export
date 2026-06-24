import {
    Dialog,
    addAlert,
    escapeText,
    findTarget,
    getJson,
    post
} from "fwtoolkit"
import {ForgejoDocumentProcessor} from "./forgejo/document_processor"
import {GitServerManagerDialog} from "./git_server_management"
import {GithubDocumentProcessor} from "./github/document_processor"
import {GitlabDocumentProcessor} from "./gitlab/document_processor"
import {docRepoSettingsTemplate} from "./templates"

function createOverviewFromEditor(editor) {
    const doc = editor.getDoc({changes: "acceptAllNoInsertions"})
    doc.bibliography = editor.mod.db.bibDB.db
    doc.images = editor.mod.db.imageDB.db
    return {
        documentList: [doc],
        schema: editor.schema,
        app: editor.app,
        documentStyles: editor.mod.documentTemplate.documentStyles
    }
}

export class EditorGitrepoExporter {
    constructor(editor) {
        this.editor = editor
        this.userRepos = {}
        this.userReposMultitype = false
        this.docRepo = null
        this.availableFormats = []
        this.finishedLoading = false
    }

    init() {
        this.fetchData()
        this.addExportMenuItem()
        this.addSettingsMenuItem()
    }

    fetchData() {
        this.finishedLoading = false
        return Promise.all([
            this.getUserRepos(),
            this.getDocRepo(),
            this.fetchFormats()
        ])
            .then(() => {
                this.finishedLoading = true
            })
            .catch(() => {
                this.finishedLoading = true
            })
    }

    getUserRepos() {
        if (this._userReposPromise) {
            return this._userReposPromise
        }
        this._userReposPromise = getJson(
            "/api/gitrepo_export/get_git_repos/"
        ).then(({repos}) => {
            this.userRepos = {}
            this.userReposMultitype = false
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

    getDocRepo() {
        const docId = this.editor.docInfo.id
        return getJson("/api/gitrepo_export/get_document_repos/").then(
            ({repos}) => {
                this.docRepo = repos[String(docId)] || null
            }
        )
    }

    fetchFormats() {
        return getJson("/api/gitrepo_export/get_export_formats/").then(
            ({formats}) => {
                this.availableFormats = formats
            }
        )
    }

    getUserRepo() {
        if (!this.docRepo) {
            return null
        }
        return (
            this.userRepos[
                this.docRepo.repo_type + "-" + this.docRepo.repo_id
            ] || null
        )
    }

    addExportMenuItem() {
        const fileMenu = this.editor.menu.headerbarModel.content.find(
            menu => menu.id === "file"
        )
        if (!fileMenu) {
            return
        }
        fileMenu.content.push({
            title: gettext("Export to Git Repository"),
            tooltip: gettext(
                "Export the current document to the configured git repository."
            ),
            action: () => this.exportDocument(),
            type: "action",
            order: 5.5
        })
        fileMenu.content.sort((a, b) => (a.order || 0) - (b.order || 0))
    }

    addSettingsMenuItem() {
        const settingsMenu = this.editor.menu.headerbarModel.content.find(
            menu => menu.id === "settings"
        )
        if (!settingsMenu) {
            return
        }
        settingsMenu.content.push({
            title: gettext("Git Repository"),
            tooltip: gettext(
                "Configure the git repository and export formats for this document."
            ),
            action: () => this.openSettingsDialog(),
            type: "action",
            order: 8
        })
        settingsMenu.content.sort((a, b) => (a.order || 0) - (b.order || 0))
    }

    exportDocument() {
        const doExport = () => {
            const userRepo = this.getUserRepo()
            if (!userRepo) {
                addAlert(
                    "error",
                    gettext(
                        "No git repository configured for this document. Configure it in Settings → Git Repository."
                    )
                )
                return
            }

            const doc = this.editor.getDoc({changes: "acceptAllNoInsertions"})
            doc.bibliography = this.editor.mod.db.bibDB.db
            doc.images = this.editor.mod.db.imageDB.db
            doc.export_templates =
                this.editor.mod.documentTemplate.exportTemplates

            const overview = createOverviewFromEditor(this.editor)

            let processor
            switch (userRepo.type) {
                case "github":
                    processor = new GithubDocumentProcessor(
                        overview,
                        doc,
                        this.docRepo,
                        userRepo,
                        this.availableFormats
                    )
                    break
                case "gitlab":
                    processor = new GitlabDocumentProcessor(
                        overview,
                        doc,
                        this.docRepo,
                        userRepo,
                        this.availableFormats
                    )
                    break
                case "forgejo":
                case "gitea":
                    processor = new ForgejoDocumentProcessor(
                        overview,
                        doc,
                        this.docRepo,
                        userRepo,
                        this.availableFormats
                    )
                    break
                default:
                    addAlert("error", gettext("Unknown repository type."))
                    return
            }

            if (processor) {
                processor.init()
            }
        }

        if (!this.finishedLoading) {
            this.fetchData().then(doExport)
        } else {
            doExport()
        }
    }

    openSettingsDialog() {
        const showDialog = () => {
            const doc = this.editor.getDoc({changes: "acceptAllNoInsertions"})
            doc.bibliography = this.editor.mod.db.bibDB.db
            doc.images = this.editor.mod.db.imageDB.db
            doc.export_templates =
                this.editor.mod.documentTemplate.exportTemplates
            const body = `<table class="fw-dialog-table">${docRepoSettingsTemplate(
                {
                    doc,
                    userRepos: this.userRepos,
                    docRepos: {
                        [String(doc.id)]: this.docRepo
                    },
                    userReposMultitype: this.userReposMultitype,
                    availableFormats: this.availableFormats
                }
            )}</table>`

            const dialog = new Dialog({
                width: 840,
                height: 520,
                title: `${gettext("Git Repository Settings")}: ${escapeText(
                    doc.title
                )}`,
                body,
                buttons: [
                    {
                        text: gettext("Submit"),
                        classes: "fw-dark",
                        click: () => {
                            const repoSelector = dialog.dialogEl.querySelector(
                                "#doc-settings-repository"
                            )
                            if (!repoSelector) {
                                dialog.close()
                                return Promise.resolve()
                            }
                            const selected = repoSelector.value.split("-")
                            const repoType = selected[0]
                            let repoId = parseInt(selected[1])
                            const formatCheckboxes =
                                dialog.dialogEl.querySelectorAll(
                                    ".export-format"
                                )
                            const targets = Array.from(formatCheckboxes)
                                .filter(cb => cb.checked)
                                .map(cb => cb.dataset.key)
                            if (targets.length === 0) {
                                repoId = 0
                            }
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
                                    this.docRepo = null
                                } else {
                                    this.docRepo = {
                                        repo_id: repoId,
                                        repo_type: repoType,
                                        repo_name:
                                            this.userRepos[
                                                `${repoType}-${repoId}`
                                            ].name,
                                        targets
                                    }
                                }
                                dialog.close()
                            })
                        }
                    },
                    {
                        type: "cancel"
                    }
                ]
            })
            dialog.open()
            dialog.dialogEl.addEventListener("click", event => {
                const el = {}
                if (findTarget(event, ".forgejo-servers", el)) {
                    const manager = new GitServerManagerDialog(() => {
                        this.fetchData()
                            .then(() => {
                                dialog.close()
                                this.openSettingsDialog()
                            })
                            .catch(() => {
                                dialog.close()
                                this.openSettingsDialog()
                            })
                    })
                    manager.open()
                } else if (findTarget(event, ".reload", el)) {
                    this.fetchData()
                        .then(() => {
                            dialog.close()
                            this.openSettingsDialog()
                        })
                        .catch(() => {
                            dialog.close()
                            this.openSettingsDialog()
                        })
                }
            })
        }

        if (!this.finishedLoading) {
            this.fetchData().then(showDialog).catch(showDialog)
        } else {
            showDialog()
        }
    }
}
