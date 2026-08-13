import {getMissingDocumentListData} from "@fiduswriter/frontend/documents/tools"
import {
    Dialog,
    addAlert,
    escapeText,
    get,
    gettext,
    interpolate,
    postJson
} from "fwtoolkit"
import {
    DOCXDocForgejoExporter,
    EpubDocForgejoExporter,
    FidusDocForgejoExporter,
    HTMLDocForgejoExporter,
    LatexDocForgejoExporter,
    ODTDocForgejoExporter,
    PandocDocForgejoExporter
} from "./document_exporters"
import {commitFilesBatch} from "./tools"

const EXPORTER_MAP = {
    fidus: FidusDocForgejoExporter,
    epub: EpubDocForgejoExporter,
    html: HTMLDocForgejoExporter,
    latex: LatexDocForgejoExporter,
    odt: ODTDocForgejoExporter,
    docx: DOCXDocForgejoExporter
}

export class ForgejoDocumentProcessor {
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
        addAlert("info", gettext("Document publishing to Forgejo initiated."))
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
                        if (!exporter) {
                            return Promise.resolve()
                        }
                        return exporter.init()
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
                        if (!exporter) {
                            return Promise.resolve()
                        }
                        return exporter.init()
                    })
                )

                return Promise.all(nonTemplatePromises.concat(templatePromises))
            })
            .then(results => {
                const files = {}
                const httpFiles = []
                const includeZips = []

                results.forEach(result => {
                    if (!result) {
                        return
                    }
                    if (result.filename && result.blob) {
                        files[result.filename] = result.blob
                    } else if (result.textFiles) {
                        result.textFiles.forEach(file => {
                            files[file.filename] = new Blob([file.contents])
                        })
                        if (result.httpFiles) {
                            httpFiles.push(...result.httpFiles)
                        }
                        if (result.includeZips) {
                            includeZips.push(...result.includeZips)
                        }
                    }
                })

                const binaryPromises = httpFiles.map(file =>
                    get(file.url)
                        .then(response => response.blob())
                        .then(blob => {
                            files[file.filename] = blob
                        })
                )

                const zipPromises = includeZips.map(zipFile =>
                    get(zipFile.url)
                        .then(response => response.blob())
                        .then(blob =>
                            import("jszip").then(({default: JSZip}) => {
                                const zipfs = new JSZip()
                                return zipfs.loadAsync(blob).then(() => {
                                    const zipFileEntries = []
                                    zipfs.forEach(file =>
                                        zipFileEntries.push(file)
                                    )
                                    return Promise.all(
                                        zipFileEntries.map(filepath =>
                                            zipfs.files[filepath].async("blob")
                                        )
                                    ).then(blobs =>
                                        blobs.forEach((blob, index) => {
                                            const filepath =
                                                zipFileEntries[index]
                                            const dir = zipFile.directory
                                                ? `${zipFile.directory}/${filepath}`
                                                : filepath
                                            files[dir] = blob
                                        })
                                    )
                                })
                            })
                        )
                )

                return Promise.all(
                    binaryPromises.concat(zipPromises).flat()
                ).then(() =>
                    commitFilesBatch(this.userRepo, files, commitMessage)
                )
            })
            .then(result => {
                if (result === 400) {
                    addAlert(
                        "error",
                        gettext("Could not publish document to repository.")
                    )
                } else {
                    addAlert(
                        "info",
                        gettext(
                            "Document published to repository successfully!"
                        )
                    )
                }
            })
    }

    _getExporterClass(targetKey) {
        const baseKey = targetKey.replace(/-\d+$/, "")
        if (EXPORTER_MAP[baseKey]) {
            return EXPORTER_MAP[baseKey]
        }
        if (baseKey.startsWith("pandoc:")) {
            return PandocDocForgejoExporter
        }
        return null
    }
}
