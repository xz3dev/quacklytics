export const calculateChecksum = async (blob: Blob) => {
  const arrayBuffer = await blob.arrayBuffer();
  let hashBuffer: ArrayBuffer;
  // console.log(crypto.subtle.digest)
  hashBuffer = await crypto.subtle.digest('SHA-1', arrayBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
};
