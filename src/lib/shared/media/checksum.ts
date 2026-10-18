export const sha256Hex = (bytes: Uint8Array<ArrayBuffer>): Promise<string> =>
  crypto.subtle
    .digest("SHA-256", bytes)
    .then((digest) =>
      [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join(""),
    );
