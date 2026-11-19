import { describe, expect, it } from "vitest";
import { FIXTURES } from "@/lib/shared/design/import/handlers/svg-vector-fixtures";
import { parseSvgVector } from "@/lib/shared/design/import/handlers/svg-vector";
import { SvgFallback } from "@/lib/shared/design/import/handlers/svg-vector-types";
import { expectValidShapes } from "@/lib/shared/design/import/handlers/svg-vector-check-fixtures";

const REASONS: readonly string[] = Object.values(SvgFallback);
const MUTATIONS = 400;
const TIME_BOUND_MS = 500;
const SEED = 20261119;
const BYTE_RANGE = 256;
const INTERESTING = ["<", ">", '"', "&", ";", "/", "#", "(", ")", "-", "e", "\u0000"];

const generator = (seed: number): (() => number) => {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const encode = (text: string): Uint8Array => new TextEncoder().encode(text);

const checked = (input: Uint8Array | string): void => {
  const started = performance.now();
  const result = parseSvgVector(input);
  expect(performance.now() - started).toBeLessThan(TIME_BOUND_MS);
  if (result.ok) {
    expectValidShapes(result);
    return;
  }
  const reason = (result as { reason: string }).reason;
  expect(REASONS).toContain(reason);
  expect(reason).not.toBe(SvgFallback.Internal);
};

describe("parseSvgVector fuzzing", () => {
  for (const [name, source] of Object.entries(FIXTURES)) {
    it(`accepts the unmodified ${name} fixture`, () => {
      expect(parseSvgVector(source).ok).toBe(true);
    });

    it(`survives random single byte mutations of ${name}`, () => {
      const random = generator(SEED);
      const bytes = encode(source);
      for (let run = 0; run < MUTATIONS; run += 1) {
        const mutated = bytes.slice();
        const position = Math.floor(random() * mutated.length);
        mutated[position] = Math.floor(random() * BYTE_RANGE);
        checked(mutated);
      }
    });

    it(`survives character substitutions in ${name}`, () => {
      const random = generator(SEED + 1);
      for (let run = 0; run < MUTATIONS; run += 1) {
        const position = Math.floor(random() * source.length);
        const piece = INTERESTING[Math.floor(random() * INTERESTING.length)] ?? "<";
        checked(`${source.slice(0, position)}${piece}${source.slice(position + 1)}`);
      }
    });

    it(`survives every truncation of ${name}`, () => {
      const bytes = encode(source);
      for (let length = 0; length < bytes.length; length += 1) {
        checked(bytes.slice(0, length));
      }
    });

    it(`survives deleted and duplicated spans of ${name}`, () => {
      const random = generator(SEED + 2);
      for (let run = 0; run < MUTATIONS; run += 1) {
        const from = Math.floor(random() * source.length);
        const to = Math.min(source.length, from + Math.floor(random() * 12));
        const mutated =
          run % 2 === 0
            ? source.slice(0, from) + source.slice(to)
            : source.slice(0, to) + source.slice(from);
        checked(mutated);
      }
    });
  }

  it("survives random bytes and unpaired text", () => {
    const random = generator(SEED + 3);
    for (let run = 0; run < MUTATIONS; run += 1) {
      const size = Math.floor(random() * 300);
      checked(Uint8Array.from({ length: size }, () => Math.floor(random() * BYTE_RANGE)));
    }
  });
});
