import {escapeText} from "../common"

export const repoSelectorTemplate = ({book, bookRepos, userRepos}) => {
    const bookRepo = bookRepos[book.id]
    return `<tr>
        <th>
            <h4 class="fw-tablerow-title">${gettext("Github repository")}</h4>
        </th>
        <td>
            <select class="entryForm" name="book-settings-repository"
                title="${gettext("Select github repository to export to")}"
                id="book-settings-repository"
                ${
                    book.rights === 'read' ?
                    'disabled="disabled"' :
                    ''
                }
            >
            ${
                bookRepo ?
                    `<option value="${bookRepo.github_repo_id}" selected>${escapeText(bookRepo.github_repo_full_name)}</option>
                    <option value="0"></option>` :
                    '<option value="0" selected></option>'
            }
            ${
                Object.entries(userRepos).sort((a, b) => a[1] > b[1] ? 1 : -1).map(([key, value]) =>
                    `<option value="${key}">${escapeText(value)}</option>`
                ).join('')
            }
            </select>
        </td>
    </tr>
    <tr>
        <th>
            <h4 class="fw-tablerow-title">${gettext("Export EPUB")}</h4>
        </th>
        <td>
            <input type="checkbox" id="book-settings-repository-epub" ${bookRepo && bookRepo.export_epub ? 'checked' : ''}>
        </td>
    </tr>
    <tr>
        <th>
            <h4 class="fw-tablerow-title">${gettext("Export unpacked EPUB")}</h4>
        </th>
        <td>
            <input type="checkbox" id="book-settings-repository-unpacked-epub" ${bookRepo && bookRepo.export_unpacked_epub ? 'checked' : ''}>
        </td>
    </tr>
    <tr>
        <th>
            <h4 class="fw-tablerow-title">${gettext("Export HTML")}</h4>
        </th>
        <td>
            <input type="checkbox" id="book-settings-repository-html" ${bookRepo && bookRepo.export_html ? 'checked' : ''}>
        </td>
    </tr>
    <tr>
        <th>
            <h4 class="fw-tablerow-title">${gettext("Export LaTeX")}</h4>
        </th>
        <td>
            <input type="checkbox" id="book-settings-repository-latex" ${bookRepo && bookRepo.export_latex ? 'checked' : ''}>
        </td>
    </tr>`
}
