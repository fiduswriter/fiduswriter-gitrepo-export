import {escapeText, gettext} from "fwtoolkit"

const REPO_TYPES = {
    forgejo: "Forgejo",
    gitea: "Gitea",
    github: "GitHub",
    gitlab: "GitLab"
}

function repoName(name, type, userReposMultitype) {
    if (userReposMultitype) {
        return `${REPO_TYPES[type]}: ${escapeText(name)}`
    }
    return escapeText(name)
}

function noReposMessageTemplate() {
    return `<tr>
        <th></th>
        <td colspan="2">
            <p class="no-repos-message">
                ${gettext("No git repositories available.")}
                ${gettext("Add a git server (Forgejo, Gitea, GitHub or GitLab) using the button above.")}
            </p>
        </td>
    </tr>`
}

export const repoSelectorTemplate = ({
    book,
    bookRepos,
    userRepos,
    userReposMultitype,
    availableFormats
}) => {
    const bookRepo = bookRepos[String(book.id)]
    const hasRepos = Object.keys(userRepos).length > 0
    return `<tr>
        <th><h4 class="fw-tablerow-title">${gettext("Git repository")}</h4></th>
        <td>
            <div class="fw-select-container">
                <select class="entry-form dk fw-button fw-light fw-large" name="book-settings-repository"
                    title="${gettext("Select git repository to export to")}"
                    id="book-settings-repository"
                    ${book.rights === "read" ? 'disabled="disabled"' : ""}>
                ${
                    bookRepo
                        ? `<option value="${bookRepo.repo_type}-${bookRepo.repo_id}" selected>${repoName(bookRepo.repo_name, bookRepo.repo_type, userReposMultitype)}</option>
                        <option value="-0"></option>`
                        : '<option value="-0" selected></option>'
                }
                ${Object.entries(userRepos)
                    .sort((a, b) => (a[1].name > b[1].name ? 1 : -1))
                    .map(
                        ([key, repo]) =>
                            `<option value="${key}">${repoName(repo.name, repo.type, userReposMultitype)}</option>`
                    )
                    .join("")}
                </select>
                <div class="fw-select-arrow fa fa-caret-down"></div>
            </div>
        </td>
        <td>
        <button type="button" class="fw-dialog-titlebar-button ui-widget ui-state-default ui-corner-all ui-button-text-only fw-button fw-dark fw-small reload">
            ${gettext("Reload")}
        </button>
        <button type="button" class="fw-dialog-titlebar-button ui-widget ui-state-default ui-corner-all ui-button-text-only fw-button fw-dark fw-small forgejo-servers">
            ${gettext("Manage git repositories")}
        </button>
        </td>
    </tr>
    ${!hasRepos ? noReposMessageTemplate() : ""}
    ${hasRepos && availableFormats ? formatCheckboxRows(availableFormats, bookRepo ? bookRepo.targets : [], book) : ""}`
}

function formatCheckboxRows(availableFormats, selectedTargets, item) {
    if (!availableFormats || !availableFormats.length) {
        return ""
    }
    const isBook = item.chapters !== undefined
    const exportTemplates = item.export_templates || []
    const odtTemplates = exportTemplates.filter(t => t.file_type === "odt")
    const docxTemplates = exportTemplates.filter(t => t.file_type === "docx")

    let effectiveTargets = [...selectedTargets]
    // Migrate old bare "odt"/"docx" targets to first matching template
    if (!isBook) {
        if (effectiveTargets.includes("odt") && odtTemplates.length) {
            effectiveTargets = effectiveTargets.filter(t => t !== "odt")
            if (!effectiveTargets.some(t => t.startsWith("odt-"))) {
                effectiveTargets.push(`odt-${odtTemplates[0].id}`)
            }
        }
        if (effectiveTargets.includes("docx") && docxTemplates.length) {
            effectiveTargets = effectiveTargets.filter(t => t !== "docx")
            if (!effectiveTargets.some(t => t.startsWith("docx-"))) {
                effectiveTargets.push(`docx-${docxTemplates[0].id}`)
            }
        }
    }

    const staticFormats = availableFormats.filter(fmt => {
        if (fmt.key === "fidus" && isBook) {
            return false
        }
        if (fmt.key === "fidusbook" && !isBook) {
            return false
        }
        if (fmt.key === "odt" || fmt.key === "docx") {
            return false
        }
        return true
    })

    const rows = staticFormats.map(fmt => {
        const checked = effectiveTargets.includes(fmt.key)
        return `<tr>
            <th><h4 class="fw-tablerow-title">${escapeText(fmt.label)}</h4></th>
            <td><input type="checkbox" class="export-format"
                data-key="${fmt.key}" ${checked ? "checked" : ""}></td>
        </tr>`
    })

    if (isBook) {
        if (item.odt_template) {
            const checked = effectiveTargets.includes("odt")
            rows.push(`<tr>
                <th><h4 class="fw-tablerow-title">${escapeText("ODT")}</h4></th>
                <td><input type="checkbox" class="export-format"
                    data-key="odt" ${checked ? "checked" : ""}></td>
            </tr>`)
        }
        if (item.docx_template) {
            const checked = effectiveTargets.includes("docx")
            rows.push(`<tr>
                <th><h4 class="fw-tablerow-title">${escapeText("DOCX")}</h4></th>
                <td><input type="checkbox" class="export-format"
                    data-key="docx" ${checked ? "checked" : ""}></td>
            </tr>`)
        }
    } else {
        odtTemplates.forEach(t => {
            const key = `odt-${t.id}`
            const checked = effectiveTargets.includes(key)
            rows.push(`<tr>
                <th><h4 class="fw-tablerow-title">${escapeText(`ODT: ${t.title}`)}</h4></th>
                <td><input type="checkbox" class="export-format"
                    data-key="${key}" ${checked ? "checked" : ""}></td>
            </tr>`)
        })
        docxTemplates.forEach(t => {
            const key = `docx-${t.id}`
            const checked = effectiveTargets.includes(key)
            rows.push(`<tr>
                <th><h4 class="fw-tablerow-title">${escapeText(`DOCX: ${t.title}`)}</h4></th>
                <td><input type="checkbox" class="export-format"
                    data-key="${key}" ${checked ? "checked" : ""}></td>
            </tr>`)
        })
    }

    return rows.join("")
}

export const docRepoSettingsTemplate = ({
    doc,
    docRepos,
    userRepos,
    userReposMultitype,
    availableFormats
}) => {
    const docRepo = docRepos[String(doc.id)]
    const hasRepos = Object.keys(userRepos).length > 0
    return `<table class="fw-dialog-table">
        <tr>
            <th><h4 class="fw-tablerow-title">${gettext("Git repository")}</h4></th>
            <td>
                <div class="fw-select-container">
                    <select class="entry-form dk fw-button fw-light fw-large" name="doc-settings-repository"
                        title="${gettext("Select git repository to export to")}"
                        id="doc-settings-repository">
                    ${
                        docRepo
                            ? `<option value="${docRepo.repo_type}-${docRepo.repo_id}" selected>${repoName(docRepo.repo_name, docRepo.repo_type, userReposMultitype)}</option>
                            <option value="-0"></option>`
                            : '<option value="-0" selected></option>'
                    }
                    ${Object.entries(userRepos)
                        .sort((a, b) => (a[1].name > b[1].name ? 1 : -1))
                        .map(
                            ([key, repo]) =>
                                `<option value="${key}">${repoName(repo.name, repo.type, userReposMultitype)}</option>`
                        )
                        .join("")}
                    </select>
                    <div class="fw-select-arrow fa fa-caret-down"></div>
                </div>
            </td>
            <td>
            <button type="button" class="fw-dialog-titlebar-button ui-widget ui-state-default ui-corner-all ui-button-text-only fw-button fw-dark fw-small reload">
                ${gettext("Reload")}
            </button>
            <button type="button" class="fw-dialog-titlebar-button ui-widget ui-state-default ui-corner-all ui-button-text-only fw-button fw-dark fw-small forgejo-servers">
                ${gettext("Manage git repositories")}
            </button>
            </td>
        </tr>
        ${!hasRepos ? noReposMessageTemplate() : ""}
        ${hasRepos && availableFormats ? formatCheckboxRows(availableFormats, docRepo ? docRepo.targets : [], doc) : ""}
    </table>`
}
