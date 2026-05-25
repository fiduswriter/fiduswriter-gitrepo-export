import {PandocBookExporter} from "../../pandoc/book_exporter"

export class PandocBookGitExporter extends PandocBookExporter {
    constructor(
        schema,
        csl,
        book,
        user,
        docList,
        updated,
        format,
        fileExtension,
        mimeType,
        options,
        repo
    ) {
        super(
            schema,
            csl,
            book,
            user,
            docList,
            updated,
            format,
            fileExtension,
            mimeType,
            options
        )
        this.repo = repo
    }

    createZip() {
        return this.returnFiles()
    }
}
