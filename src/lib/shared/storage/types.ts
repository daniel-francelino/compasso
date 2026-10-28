export type UploadTarget = { path: string; url: string };

export type StorageResult = { ok: true } | { ok: false; message: string };

export type ObjectInfo = { size: number; contentType: string | null };

export interface ServerStorage {
  createUploadTarget(path: string): Promise<UploadTarget | null>;
  signUrls(
    paths: (string | null | undefined)[],
    seconds: number,
    downloadName?: string,
  ): Promise<Map<string, string>>;
  stat(path: string): Promise<ObjectInfo | null>;
  sha256(path: string): Promise<string | null>;
  readRange(path: string, start: number, end: number): Promise<Uint8Array | null>;
  list(
    prefix: string,
  ): Promise<{ objects: { key: string; size: number }[]; truncated: boolean } | null>;
  remove(paths: (string | null | undefined)[]): Promise<StorageResult>;
  copyToPublic(fromKey: string, toKey: string): Promise<StorageResult>;
  removePublic(keys: string[]): Promise<StorageResult>;
}

export type BrowserUploadResult = { ok: true } | { ok: false; status: number };

export interface BrowserStorage {
  upload(
    target: UploadTarget,
    body: Blob,
    contentType: string,
    onProgress?: (fraction: number) => void,
  ): Promise<BrowserUploadResult>;
}
