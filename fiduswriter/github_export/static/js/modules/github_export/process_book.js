import {EpubBookExporter} from "../books/exporter/epub"


export class ProcessBook extends EpubBookExporter {
    constructor(schema, csl, bookStyles, book, user, docList, callback) {
        super(schema, csl, bookStyles, book, user, docList)
        this.callback = callback
    }

    download(blob) {
        this.callback(blob)
    }
}
