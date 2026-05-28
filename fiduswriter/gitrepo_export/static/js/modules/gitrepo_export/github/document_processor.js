import {Dialog, addAlert, escapeText, postJson} from "../../common"
import {getMissingDocumentListData} from "../../documents/tools"
import {
    DOCXDocGithubExporter,
    EpubDocGithubExporter,
    FidusDocGithubExporter,
    HTMLDocGithubExporter,
    LatexDocGithubExporter,
    ODTDocGithubExporter,
    PandocDocGithubExporter
} from "./document_exporters"
import {commitTree, promiseChain} from "./tools"

const EXPORTER_MAP = {
    fidus: FidusDocGithubExporter,
    epub: EpubDocGithubExporter,
    html: HTMLDocGithubExporter,
    latex: LatexDocGithubExporter,
    odt: ODTDocGithubExporter,
    docx: DOCXDocGithubExporter
}

export class GithubDocumentProcessor {
    constructor(overview, doc, docRepo, userRepo, availableFormats) {
        this.overview = overview
        this.doc = doc
        this.docRepo = docRepo
        this.userRepo = userRepo
        this.availableFormats = availableFormats || []
    }

    init() {
        return this.getCommitMessage()
            .then(commitMessage => this.publishDocument(commitMessage))
            .catch(error => {
                if (error) {
                    console.error(error)
                }
            })
    }

    getCommitMessage() {
        return new Promise((resolve, reject) => {
            const buttons = [
                {
                    text: gettext("Submit"),
                    classes: "fw-dark",
                    click: () => {
                        const commitMessage =
                            dialog.dialogEl.querySelector(".commit-message")
                                .value || gettext("Update from Fidus Writer")
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
                body: `<p>${gettext("Updating")}: ${escapeText(this.doc.title)}
                    <input type="text" class="commit-message" placeholder="${gettext("Enter commit message")}"></p>`,
                buttons
            })
            dialog.open()
        })
    }

    _getTemplateUrl(targetKey) {
        const templateId = parseInt(targetKey.split("-")[1], 10)
        return postJson("/api/document/get_template_for_doc/", {
            id: this.doc.id
        })
            .then(({json}) => {
                const template = json.export_templates.find(
                    t => t.pk === templateId
                )
                return template ? template.fields.template_file : null
            })
            .catch(() => null)
    }

    _createExporter(targetKey, templateUrl) {
        const baseKey = targetKey.replace(/-\d+$/, "")
        const ExporterClass = this._getExporterClass(targetKey)
        if (!ExporterClass) {
            return null
        }
        const bibDB = {db: this.doc.bibliography || {}}
        const imageDB = {db: this.doc.images || {}}
        const csl = this.overview.app.csl
        const updated = new Date(this.doc.updated * 1000)
        const repo = this.userRepo

        if (baseKey.startsWith("pandoc:")) {
            const formatInfo = this.availableFormats.find(
                f => f.key === targetKey
            )
            if (!formatInfo) {
                return null
            }
            const format = baseKey.slice(7)
            const options = {}
            if (format === "rtf") {
                options.fullFileExport = true
            } else if (format === "typst") {
                options.includeBibliography = true
            }
            return new ExporterClass(
                format,
                formatInfo.ext,
                "application/octet-stream",
                options,
                this.doc,
                bibDB,
                imageDB,
                csl,
                updated,
                repo
            )
        }

        switch (baseKey) {
            case "fidus":
                return new ExporterClass(this.doc, bibDB, imageDB, repo)
            case "html":
            case "epub":
                return new ExporterClass(
                    this.doc,
                    bibDB,
                    imageDB,
                    csl,
                    updated,
                    this.overview.documentStyles,
                    repo
                )
            case "latex":
                return new ExporterClass(
                    this.doc,
                    bibDB,
                    imageDB,
                    updated,
                    repo
                )
            case "docx":
            case "odt":
                return new ExporterClass(
                    this.doc,
                    templateUrl,
                    bibDB,
                    imageDB,
                    csl,
                    repo
                )
            default:
                return null
        }
    }

    publishDocument(commitMessage) {
        addAlert("info", gettext("Document publishing to GitHub initiated."))
        const targets = this.docRepo.targets || []

        return getMissingDocumentListData(
            [this.doc.id],
            this.overview.documentList,
            this.overview.schema
        )
            .then(() => {
                const nonTemplateTargets = targets.filter(
                    t => !t.startsWith("odt-") && !t.startsWith("docx-")
                )
                const templateTargets = targets.filter(
                    t => t.startsWith("odt-") || t.startsWith("docx-")
                )

                const nonTemplatePromises = nonTemplateTargets.map(
                    targetKey => {
                        const exporter = this._createExporter(targetKey)
                        return exporter ? exporter.init() : Promise.resolve()
                    }
                )

                if (!templateTargets.length) {
                    return Promise.all(nonTemplatePromises)
                }

                const templatePromises = templateTargets.map(targetKey =>
                    this._getTemplateUrl(targetKey).then(templateUrl => {
                        if (!templateUrl) {
                            addAlert(
                                "error",
                                interpolate(
                                    gettext(
                                        "No %s export template found for document."
                                    ),
                                    [targetKey.toUpperCase()]
                                )
                            )
                            return Promise.resolve()
                        }
                        const exporter = this._createExporter(
                            targetKey,
                            templateUrl
                        )
                        return exporter ? exporter.init() : Promise.resolve()
                    })
                )

                return Promise.all(nonTemplatePromises.concat(templatePromises))
            })
            .then(commitFunctions =>
                promiseChain(commitFunctions.flat()).then(responses => {
                    const responseCodes = responses.flat()
                    if (responseCodes.every(code => code === 304)) {
                        addAlert(
                            "info",
                            gettext(
                                "Document already up to date in repository."
                            )
                        )
                    } else if (responseCodes.every(code => code === 400)) {
                        addAlert(
                            "error",
                            gettext("Could not publish document to repository.")
                        )
                    } else if (responseCodes.find(code => code === 400)) {
                        addAlert(
                            "error",
                            gettext(
                                "Could not publish some parts of document to repository."
                            )
                        )
                    } else {
                        commitTree(
                            responseCodes.filter(
                                response => typeof response === "object"
                            ),
                            commitMessage,
                            this.userRepo
                        ).then(() =>
                            addAlert(
                                "info",
                                gettext(
                                    "Document published to repository successfully!"
                                )
                            )
                        )
                    }
                })
            )
    }

    _getExporterClass(targetKey) {
        const baseKey = targetKey.replace(/-\d+$/, "")
        if (EXPORTER_MAP[baseKey]) {
            return EXPORTER_MAP[baseKey]
        }
        if (baseKey.startsWith("pandoc:")) {
            return PandocDocGithubExporter
        }
        return null
    }
}
