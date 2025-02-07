export const sha1Blob = async (blob: Blob) => {
    const arrayBuffer = await blob.arrayBuffer()
    let hashBuffer: ArrayBuffer
    // console.log(crypto.subtle.digest)
    hashBuffer = await crypto.subtle.digest('SHA-1', arrayBuffer)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}


export function simpleHash(data: string) {
    var hash = 0
    for (var i = 0; i < data.length; i++) {
        var code = data.charCodeAt(i)
        hash = ((hash << 5) - hash) + code
        hash = hash & hash // Convert to 32bit integer
    }
    return Math.abs(hash)
}
