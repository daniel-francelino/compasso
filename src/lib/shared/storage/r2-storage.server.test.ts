import { describe, expect, it } from "vitest";
import { r2ServerStorage } from "@/lib/shared/storage/r2-storage.server";

const storage = r2ServerStorage({
  endpoint: "https://account.r2.cloudflarestorage.com",
  accessKeyId: "test-access-key",
  secretAccessKey: "test-secret",
  bucket: "aura-private",
});

describe("r2 presigning (offline)", () => {
  it("signs an upload URL for the exact key (the content type is not bound: the server validates the real content)", async () => {
    const target = await storage.createUploadTarget("0b1c-key");
    expect(target).not.toBeNull();
    const url = new URL(target?.url ?? "");
    expect(url.pathname).toBe("/aura-private/0b1c-key");
    expect(url.searchParams.get("X-Amz-Signature")).toMatch(/^[0-9a-f]{64}$/);
    expect(url.searchParams.get("X-Amz-Expires")).toBe("600");
    expect(url.searchParams.get("X-Amz-SignedHeaders")).toBe("host");
  });

  it("signs read URLs with the requested lifetime and download name", async () => {
    const urls = await storage.signUrls(
      ["k1", "k1", null, undefined, "k2"],
      120,
      "Foto do café.jpg",
    );
    expect([...urls.keys()].sort()).toEqual(["k1", "k2"]);
    const url = new URL(urls.get("k1") ?? "");
    expect(url.searchParams.get("X-Amz-Expires")).toBe("120");
    expect(url.searchParams.get("response-content-disposition")).toContain("attachment");
    expect(url.searchParams.get("response-content-disposition")).toContain(
      "UTF-8''Foto%20do%20caf%C3%A9.jpg",
    );
  });

  it("never lets a file name break out of the header", async () => {
    const urls = await storage.signUrls(["k1"], 60, 'evil"\r\nSet-Cookie: x=1.jpg');
    const disposition =
      new URL(urls.get("k1") ?? "").searchParams.get("response-content-disposition") ?? "";
    expect(disposition).not.toContain("\r");
    expect(disposition).not.toContain("\n");
    expect(disposition.match(/"/g)?.length).toBe(2);
  });
});
