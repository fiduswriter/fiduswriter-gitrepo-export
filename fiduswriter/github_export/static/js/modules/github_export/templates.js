import {escapeText} from "../common"

export const repoSelectorTemplate = ({book, bookRepos, userRepos}) =>
    `<select class="entryForm" name="book-settings-github-repository"
        title="${gettext("Select github repository to export to")}"
        id="book-settings-github-repository"
        ${
            book.rights === 'read' ?
            'disabled="disabled"' :
            ''
        }
    >
    ${
        bookRepos[book.id] ?
            `<option value="${bookRepos[book.id].github_repo_id}" selected>${escapeText(bookRepos[book.id].github_repo_full_name)}</option>
            <option value="0"></option>` :
            '<option value="0" selected></option>'
    }
    ${
        Object.entries(userRepos).sort((a, b) => a[1] > b[1] ? 1 : -1).map(([key, value]) =>
            `<option value="${key}">${escapeText(value)}</option>`
        ).join('')
    }
    </select>`
