import {FIDUSBOOK_VERSION} from "@fiduswriter/books-document/exporter/native"
import {getMissingChapterData} from "@fiduswriter/books-document/exporter/tools"
import {ShrinkFidus} from "@fiduswriter/document/exporter/native/shrink"
import {ZipFidus} from "@fiduswriter/document/exporter/native/zip"
import {addAlert, gettext} from "fwtoolkit"
import {ZipFileCreator} from "fwtoolkit/file/zip"

/**
 * Document exporter that creates a .fidus file for git commit.
 */
export class FidusDocGitExporter {
    constructor(doc, bibDB, imageDB, repo) {
        this.doc = doc
        this.bibDB = bibDB
        this.imageDB = imageDB
        this.repo = repo
    }

    init() {
        const shrinker = new ShrinkFidus(
            this.doc,
            this.imageDB,
            this.bibDB,
            true // silent
        )
        return shrinker
            .init()
            .then(({doc, shrunkImageDB, shrunkBibDB, httpIncludes}) => {
                const zipper = new ZipFidus(
                    this.doc.id,
                    doc,
                    shrunkImageDB,
                    shrunkBibDB,
                    httpIncludes,
                    true // includeTemplate
                )
                return zipper.init()
            })
            .then(blob => ({"document.fidus": blob}))
    }
}

/**
 * Book exporter that creates a .fidusbook file for git commit.
 * Re-uses the packing logic from NativeBookExporter but returns
 * the blob instead of triggering a browser download.
 */
export class FidusBookGitExporter {
    constructor(schema, book, user, documentList, updated, repo) {
        this.schema = schema
        this.book = book
        this.user = user
        this.documentList = documentList
        this.updated = updated
        this.repo = repo
    }

    init() {
        if (this.book.chapters.length === 0) {
            addAlert(
                "error",
                gettext("Book cannot be exported due to lack of chapters.")
            )
            return Promise.resolve(false)
        }
        return getMissingChapterData(
            this.book,
            this.documentList,
            this.schema
        ).then(() => this.exportContents())
    }

    exportContents() {
        const textFiles = []
        const httpFiles = []

        const sortedChapters = [...this.book.chapters].sort(
            (a, b) => a.number - b.number
        )

        const bookData = {
            title: this.book.title,
            path: this.book.path || "/",
            metadata: this.book.metadata || {},
            settings: this.book.settings || {},
            chapters: sortedChapters.map((chapter, index) => ({
                number: chapter.number,
                part: chapter.part || "",
                chapter_index: index
            }))
        }

        if (this.book.cover_image_data) {
            const coverImage = this.book.cover_image_data
            const imageUrl = coverImage.image.split("?")[0]
            const filename = imageUrl.split("/").pop()
            bookData.cover_image = {
                title: coverImage.title || "",
                checksum: coverImage.checksum || "",
                file_type: coverImage.file_type,
                image: `cover/${filename}`
            }
            httpFiles.push({url: imageUrl, filename: `cover/${filename}`})
        }

        const processChapter = index => {
            if (index >= sortedChapters.length) {
                return Promise.resolve()
            }
            const chapter = sortedChapters[index]
            const doc = this.documentList.find(d => d.id === chapter.text)
            if (!doc) {
                return processChapter(index + 1)
            }
            const shrinker = new ShrinkFidus(
                doc,
                {db: doc.images || {}},
                {db: doc.bibliography || {}},
                true // silent
            )
            return shrinker
                .init()
                .then(
                    ({
                        doc: shrunkDoc,
                        shrunkImageDB,
                        shrunkBibDB,
                        httpIncludes
                    }) => {
                        httpIncludes.forEach(include => {
                            include.filename = `chapters/${index}/${include.filename}`
                        })
                        textFiles.push(
                            {
                                filename: `chapters/${index}/document.json`,
                                contents: JSON.stringify(shrunkDoc)
                            },
                            {
                                filename: `chapters/${index}/images.json`,
                                contents: JSON.stringify(shrunkImageDB)
                            },
                            {
                                filename: `chapters/${index}/bibliography.json`,
                                contents: JSON.stringify(shrunkBibDB)
                            }
                        )
                        httpFiles.push(...httpIncludes)
                    }
                )
                .then(() => processChapter(index + 1))
        }

        return processChapter(0).then(() => {
            textFiles.push(
                {filename: "book.json", contents: JSON.stringify(bookData)},
                {filename: "filetype-version", contents: FIDUSBOOK_VERSION}
            )
            const zipper = new ZipFileCreator(
                textFiles,
                httpFiles,
                [],
                "application/fidusbook+zip",
                this.updated
            )
            return zipper.init().then(blob => ({"book.fidusbook": blob}))
        })
    }
}
