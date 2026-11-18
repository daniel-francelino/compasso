import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/shared/media/media.functions", () => ({ signMediaUrls: vi.fn() }));

const { pickFile } = await import("@/lib/shared/design/browser");

type FakeInput = {
  type: string;
  accept: string;
  hidden: boolean;
  files: File[] | null;
  onchange: (() => void) | null;
  oncancel: (() => void) | null;
  click: () => void;
  remove: () => void;
};

const setup = () => {
  const calls: string[] = [];
  const input: FakeInput = {
    type: "",
    accept: "",
    hidden: false,
    files: null,
    onchange: null,
    oncancel: null,
    click: () => calls.push("click"),
    remove: () => calls.push("remove"),
  };
  vi.stubGlobal("document", {
    createElement: () => input,
    body: { appendChild: () => calls.push("append") },
  });
  return { input, calls };
};

afterEach(() => vi.unstubAllGlobals());

describe("pickFile", () => {
  it("attaches the input before click, sets accept, and removes it after a choice", async () => {
    const { input, calls } = setup();
    const promise = pickFile(".a,.b");
    expect(calls).toEqual(["append", "click"]);
    expect(input.accept).toBe(".a,.b");
    const file = new File([new Uint8Array(1)], "x.png");
    input.files = [file];
    input.onchange?.();
    await expect(promise).resolves.toBe(file);
    expect(calls).toEqual(["append", "click", "remove"]);
  });

  it("removes the input and resolves null when the dialog is cancelled", async () => {
    const { input, calls } = setup();
    const promise = pickFile(".a");
    input.oncancel?.();
    await expect(promise).resolves.toBeNull();
    expect(calls).toEqual(["append", "click", "remove"]);
  });
});
