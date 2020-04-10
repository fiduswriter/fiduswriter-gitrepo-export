import {EpubBookExporter} from "../books/exporter/epub"
import {commitFile} from "./commit_file"
import {addAlert} from "../common"

export class EpubBookGithubExporter extends EpubBookExporter {
    constructor(schema, csl, bookStyles, book, user, docList, updated, repo) {
        super(schema, csl, bookStyles, book, user, docList, updated)
        this.repo = repo
    }

    download(blob) {
        return commitFile(
            this.repo,
            blob,
            'book.epub'
        ).then(
            ({status}) => {
                switch(status) {
                    case 200:
                        addAlert('info', gettext('Book updated successfully!'))
                        break
                    case 201:
                        addAlert('info', gettext('Book published successfully!'))
                        break
                    case 304:
                        addAlert('info', gettext('Book already up to date!'))
                        break
                    case 400:
                        addAlert('error', gettext('Could not publish book to Github.'))
                        break
                }

            }
        )

    }
}
