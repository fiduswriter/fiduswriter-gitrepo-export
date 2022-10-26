import {escapeText} from "../common"

const REPO_TYPES = {
    github: "GitHub",
    gitlab: "GitLab"
}

function repoName(name, type, userReposMultitype) {
    if (userReposMultitype) {
        return `${REPO_TYPES[type]}: ${escapeText(name)}`
    }
    return escapeText(name)
}


export const repoSelectorTemplate = ({book, bookRepos, userRepos, userReposMultitype}) => {
    const bookRepo = bookRepos[book.id]
    return `<tr>
        <th>
            <h4 class="fw-tablerow-title">${gettext("Git repository")}</h4>
        </th>
        <td>
            <select class="entryForm" name="book-settings-repository"
                title="${gettext("Select git repository to export to")}"
                id="book-settings-repository"
                ${
    book.rights === "read" ?
        "disabled=\"disabled\"" :
        ""
}
            >
            ${
    bookRepo ?
        `<option value="${bookRepo.repo_type}-${bookRepo.repo_id}" selected>${repoName(bookRepo.repo_name, bookRepo.repo_type, userReposMultitype)}</option>
                    <option value="-0"></option>` :
        "<option value=\"-0\" selected></option>"
}
            ${
    Object.entries(userRepos).sort((a, b) => a[1].name > b[1].name ? 1 : -1).map(([key, repo]) =>
        `<option value="${key}">${repoName(repo.name, repo.type, userReposMultitype)}</option>`
    ).join("")
}
            </select>
            <button type="button" class="ui-button ui-widget ui-state-default ui-corner-all ui-button-text-only fw-button fw-dark fw-small reload">
                ${gettext("Reload")}
            </button>
        </td>
    </tr>

    <tr>
        <th>
            <h4 class="fw-tablerow-title">${gettext("Export EPUB")}</h4>
        </th>
        <td>
            <input type="checkbox" id="book-settings-repository-epub" ${bookRepo && bookRepo.export_epub ? "checked" : ""}>
        </td>
    </tr>
    <tr>
        <th>
            <h4 class="fw-tablerow-title">${gettext("Export unpacked EPUB")}</h4>
        </th>
        <td>
            <input type="checkbox" id="book-settings-repository-unpacked-epub" ${bookRepo && bookRepo.export_unpacked_epub ? "checked" : ""}>
        </td>
    </tr>
    <tr>
        <th>
            <h4 class="fw-tablerow-title">${gettext("Export HTML")}</h4>
        </th>
        <td>
            <input type="checkbox" id="book-settings-repository-html" ${bookRepo && bookRepo.export_html ? "checked" : ""}>
        </td>
    </tr>
    <tr>
        <th>
            <h4 class="fw-tablerow-title">${gettext("Export Unified HTML")}</h4>
        </th>
        <td>
            <input type="checkbox" id="book-settings-repository-unified-html" ${bookRepo && bookRepo.export_unified_html ? "checked" : ""}>
        </td>
    </tr>
    <tr>
        <th>
            <h4 class="fw-tablerow-title">${gettext("Export LaTeX")}</h4>
        </th>
        <td>
            <input type="checkbox" id="book-settings-repository-latex" ${bookRepo && bookRepo.export_latex ? "checked" : ""}>
        </td>
    </tr>`
}
