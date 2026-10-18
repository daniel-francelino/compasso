import { createHash } from "node:crypto";
import { type Server, createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { r2ServerStorage } from "@/lib/shared/storage/r2-storage.server";

const objects = new Map<string, Buffer>();
let server: Server;
let endpoint = "";

beforeAll(async () => {
  server = createServer((request, response) => {
    const url = new URL(request.url ?? "/", "http://localhost");
    const parts = url.pathname.split("/").filter((part) => part !== "");
    const key = decodeURIComponent(parts.slice(1).join("/"));
    const chunks: Buffer[] = [];
    request.on("data", (chunk: Buffer) => chunks.push(chunk));
    request.on("end", () => {
      if (request.method === "PUT") {
        objects.set(key, Buffer.concat(chunks));
        response.writeHead(200).end();
        return;
      }
      if (request.method === "DELETE") {
        const existed = objects.delete(key);
        response.writeHead(existed ? 204 : 404).end();
        return;
      }
      if (request.method === "GET" && url.searchParams.get("list-type") === "2") {
        const prefix = url.searchParams.get("prefix") ?? "";
        const contents = [...objects.entries()]
          .filter(([name]) => name.startsWith(prefix))
          .map(
            ([name, body]) => `<Contents><Key>${name}</Key><Size>${body.length}</Size></Contents>`,
          )
          .join("");
        response
          .writeHead(200)
          .end(`<ListBucketResult><IsTruncated>false</IsTruncated>${contents}</ListBucketResult>`);
        return;
      }
      const body = objects.get(key);
      if (body === undefined) {
        response.writeHead(404).end();
        return;
      }
      if (request.method === "HEAD") {
        response
          .writeHead(200, { "content-length": String(body.length), "content-type": "image/png" })
          .end();
        return;
      }
      const range = /bytes=(\d+)-(\d+)/.exec(request.headers["range"] ?? "");
      if (range) {
        const slice = body.subarray(Number(range[1]), Number(range[2]) + 1);
        response.writeHead(206).end(slice);
        return;
      }
      response.writeHead(200).end(body);
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  endpoint = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(() => {
  server.close();
});

const storage = () =>
  r2ServerStorage({ endpoint, accessKeyId: "k", secretAccessKey: "s", bucket: "bucket" });

describe("r2 storage against a fake S3 server", () => {
  it("uploads through the presigned URL and reads it back with stat, range and checksum", async () => {
    const body = Buffer.from("hello compasso ".repeat(1000));
    const target = await storage().createUploadTarget("object-1");
    const put = await fetch(target?.url ?? "", { method: "PUT", body });
    expect(put.ok).toBe(true);

    expect(await storage().stat("object-1")).toEqual({
      size: body.length,
      contentType: "image/png",
    });
    const range = await storage().readRange("object-1", 0, 4);
    expect(Buffer.from(range ?? []).toString()).toBe("hello");
    expect(await storage().sha256("object-1")).toBe(
      createHash("sha256").update(body).digest("hex"),
    );
  });

  it("answers null for objects that do not exist", async () => {
    expect(await storage().stat("missing")).toBeNull();
    expect(await storage().readRange("missing", 0, 3)).toBeNull();
    expect(await storage().sha256("missing")).toBeNull();
  });

  it("lists and removes objects, treating a missing one as removed", async () => {
    objects.set("a-thumb", Buffer.from("x"));
    objects.set("b", Buffer.from("yy"));
    const listed = await storage().list("");
    expect(listed?.objects.map((object) => object.key)).toContain("a-thumb");
    expect(listed?.truncated).toBe(false);

    expect(await storage().remove(["a-thumb", "does-not-exist", null])).toEqual({ ok: true });
    expect(objects.has("a-thumb")).toBe(false);
  });
});
