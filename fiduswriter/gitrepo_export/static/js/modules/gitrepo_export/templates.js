import {escapeText} from "../common"

const REPO_TYPES = {
    github: "GitHub",
    gitlab: "GitLab",
    forgejo: "Forgejo"
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
                ${gettext("Connect your GitHub or GitLab account in the user profile preferences, or add a Forgejo server using the button above.")}
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
        <button type="button" class="ui-button ui-widget ui-state-default ui-corner-all ui-button-text-only fw-button fw-dark fw-small reload">
            ${gettext("Reload")}
        </button>
        <button type="button" class="ui-button ui-widget ui-state-default ui-corner-all ui-button-text-only fw-button fw-dark fw-small forgejo-servers">
            ${gettext("Forgejo")}
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
    return availableFormats
        .map(fmt => {
            const checked = selectedTargets.includes(fmt.key)
            const disabled =
                (fmt.key === "odt" && !item.odt_template) ||
                (fmt.key === "docx" && !item.docx_template)
            return `<tr>
            <th><h4 class="fw-tablerow-title">${escapeText(fmt.label)}</h4></th>
            <td><input type="checkbox" class="export-format"
                data-key="${fmt.key}" ${checked ? "checked" : ""}
                ${disabled ? "disabled" : ""}></td>
        </tr>`
        })
        .join("")
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
            <button type="button" class="ui-button ui-widget ui-state-default ui-corner-all ui-button-text-only fw-button fw-dark fw-small reload">
                ${gettext("Reload")}
            </button>
            <button type="button" class="ui-button ui-widget ui-state-default ui-corner-all ui-button-text-only fw-button fw-dark fw-small forgejo-servers">
                ${gettext("Forgejo")}
            </button>
            </td>
        </tr>
        ${!hasRepos ? noReposMessageTemplate() : ""}
        ${hasRepos && availableFormats ? formatCheckboxRows(availableFormats, docRepo ? docRepo.targets : [], doc) : ""}
    </table>`
}
