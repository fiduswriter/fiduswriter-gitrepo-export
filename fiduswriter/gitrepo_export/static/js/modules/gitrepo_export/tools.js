// Source https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/digest

export function gitHashObject(content, utf8 = true) {
    let contentArray
    if (utf8) {
        contentArray = new TextEncoder().encode(content)
    } else {
        contentArray = new Uint8Array(content.length)
        for (let i = 0; i < content.length; i++) {
            contentArray[i] = content.charCodeAt(i)
        }
    }
    const prefixArray = new TextEncoder().encode("blob " + contentArray.byteLength + "\0") // encode as (utf-8) Uint8Array

    // Join arrays
    const unifiedArray = new Uint8Array(prefixArray.byteLength + contentArray.byteLength)
    unifiedArray.set(new Uint8Array(prefixArray), 0)
    unifiedArray.set(new Uint8Array(contentArray), prefixArray.byteLength)

    return crypto.subtle.digest("SHA-1", unifiedArray).then(
        hashBuffer => {
            const hashArray = Array.from(new Uint8Array(hashBuffer)) // convert buffer to byte array
            const hashHex = hashArray.map(b => b.toString(16).padStart(2, "0")).join("") // convert bytes to hex string
            return hashHex
        }
    )
}

export function readBlobPromise(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result.split("base64,")[1])
        reader.onerror = reject
        reader.readAsDataURL(blob)
    })
}
