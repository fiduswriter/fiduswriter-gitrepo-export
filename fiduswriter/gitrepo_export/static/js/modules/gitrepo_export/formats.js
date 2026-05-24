export function getFormatExt(formatKey) {
    const parts = formatKey.split(":")
    if (parts.length === 1) {
        return parts[0]
    }
    return parts[1]
}

export function getFileName(slug, formatKey, ext) {
    const baseExt = getFormatExt(formatKey)
    if (!ext || ext === baseExt) {
        return `${slug}.${baseExt || ext}`
    }
    return `${slug}.${baseExt}.${ext}`
}
