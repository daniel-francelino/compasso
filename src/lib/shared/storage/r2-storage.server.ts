import { createHash } from "node:crypto";
import { Readable } from "node:stream";
import type { ReadableStream as WebReadableStream } from "node:stream/web";
import { AwsClient } from "aws4fetch";
import type { R2Config } from "@/lib/shared/env.server";
import { logError } from "@/lib/shared/logger";
import type { ServerStorage } from "@/lib/shared/storage/types";

const PUT_SECONDS = 600;
const LIST_PAGES = 100;

const unescapeXml = (text: string) =>
  text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");

const encodeKey = (key: string) => key.split("/").map(encodeURIComponent).join("/");

const dispositionOf = (name: string) => {
  const clean = name.replace(/[\r\n"\\/]/g, "_").slice(0, 200);
  const ascii = clean.replace(/[^\x20-\x7e]/g, "_");
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(clean)}`;
};

export const r2ServerStorage = (config: R2Config): ServerStorage => {
  const client = new AwsClient({
    accessKeyId: config.accessKeyId,
    secretAccessKey: config.secretAccessKey,
    service: "s3",
    region: "auto",
  });
  const base = `${config.endpoint}/${config.bucket}`;
  const urlOf = (path: string) => new URL(`${base}/${encodeKey(path)}`);
  const publicUrlOf = (path: string) =>
    new URL(`${config.endpoint}/${config.publicBucket ?? ""}/${encodeKey(path)}`);
  const noPublicBucket = { ok: false, message: "O bucket público não está configurado." } as const;

  const presign = async (
    method: "GET" | "PUT",
    path: string,
    seconds: number,
    extra: Record<string, string> = {},
    headers: Record<string, string> = {},
  ) => {
    const url = urlOf(path);
    url.searchParams.set("X-Amz-Expires", String(seconds));
    for (const [key, value] of Object.entries(extra)) url.searchParams.set(key, value);
    const signed = await client.sign(url.toString(), {
      method,
      headers,
      aws: { signQuery: true },
    });
    return signed.url;
  };

  return {
    async createUploadTarget(path) {
      try {
        const url = await presign("PUT", path, PUT_SECONDS);
        return { path, url };
      } catch (error) {
        logError("storage: upload target failed", error);
        return null;
      }
    },

    async signUrls(paths, seconds, downloadName) {
      const keys = [...new Set(paths.filter((key): key is string => !!key))];
      const urls = new Map<string, string>();
      const extra: Record<string, string> = downloadName
        ? { "response-content-disposition": dispositionOf(downloadName) }
        : {};
      await Promise.all(
        keys.map(async (key) => {
          try {
            urls.set(key, await presign("GET", key, seconds, extra));
          } catch (error) {
            logError("storage: signing failed", error);
          }
        }),
      );
      return urls;
    },

    async stat(path) {
      const response = await client.fetch(urlOf(path).toString(), { method: "HEAD" });
      if (!response.ok) return null;
      return {
        size: Number(response.headers.get("content-length") ?? 0),
        contentType: response.headers.get("content-type"),
      };
    },

    async readRange(path, start, end) {
      const response = await client.fetch(urlOf(path).toString(), {
        headers: { Range: `bytes=${start}-${end}` },
      });
      return response.ok ? new Uint8Array(await response.arrayBuffer()) : null;
    },

    async sha256(path) {
      const response = await client.fetch(urlOf(path).toString());
      if (!response.ok || response.body === null) return null;
      const hash = createHash("sha256");
      for await (const chunk of Readable.fromWeb(response.body as WebReadableStream<Uint8Array>)) {
        hash.update(chunk as Uint8Array);
      }
      return hash.digest("hex");
    },

    async list(prefix) {
      const objects: { key: string; size: number }[] = [];
      let token: string | null = null;
      for (let page = 0; page < LIST_PAGES; page += 1) {
        const url = new URL(base);
        url.searchParams.set("list-type", "2");
        url.searchParams.set("max-keys", "1000");
        if (prefix) url.searchParams.set("prefix", prefix);
        if (token) url.searchParams.set("continuation-token", token);
        const response = await client.fetch(url.toString());
        if (!response.ok) return null;
        const xml = await response.text();
        for (const block of xml.match(/<Contents>[\s\S]*?<\/Contents>/g) ?? []) {
          const key = /<Key>([\s\S]*?)<\/Key>/.exec(block)?.[1];
          const size = /<Size>(\d+)<\/Size>/.exec(block)?.[1];
          if (key !== undefined && size !== undefined) {
            objects.push({ key: unescapeXml(key), size: Number(size) });
          }
        }
        const next = /<NextContinuationToken>([\s\S]*?)<\/NextContinuationToken>/.exec(xml)?.[1];
        if (!/<IsTruncated>true<\/IsTruncated>/.test(xml) || !next) {
          return { objects, truncated: false };
        }
        token = unescapeXml(next);
      }
      return { objects, truncated: true };
    },

    async copyToPublic(fromKey, toKey) {
      if (config.publicBucket === undefined) return noPublicBucket;
      const response = await client.fetch(publicUrlOf(toKey).toString(), {
        method: "PUT",
        headers: {
          "x-amz-copy-source": `/${config.bucket}/${encodeKey(fromKey)}`,
          "x-amz-metadata-directive": "REPLACE",
          "content-type": "image/webp",
          "cache-control": "public, max-age=31536000, immutable",
        },
      });
      if (response.ok) return { ok: true };
      logError("storage: public copy failed", response.status);
      return { ok: false, message: "Não foi possível copiar a imagem para o espaço público." };
    },

    async removePublic(keys) {
      if (config.publicBucket === undefined) return noPublicBucket;
      const results = await Promise.all(
        keys.map(async (key) => {
          const response = await client.fetch(publicUrlOf(key).toString(), { method: "DELETE" });
          return response.ok || response.status === 404;
        }),
      );
      if (results.some((ok) => !ok)) {
        logError("storage: public removal failed");
        return { ok: false, message: "Não foi possível retirar a imagem do espaço público." };
      }
      return { ok: true };
    },

    async remove(paths) {
      const keys = paths.filter((key): key is string => !!key);
      const results = await Promise.all(
        keys.map(async (key) => {
          const response = await client.fetch(urlOf(key).toString(), { method: "DELETE" });
          return response.ok || response.status === 404;
        }),
      );
      if (results.some((ok) => !ok)) {
        logError("storage: removal failed");
        return { ok: false, message: "Não foi possível remover os arquivos do armazenamento." };
      }
      return { ok: true };
    },
  };
};
