export const at = (values: ArrayLike<number>, index: number): number => values[index] ?? 0;

export const clamp = (value: number, min: number, max: number): number =>
  value < min ? min : value > max ? max : value;

export const clamp01 = (value: number): number => (value < 0 ? 0 : value > 1 ? 1 : value);

export const clampByte = (value: number): number =>
  value <= 0 ? 0 : value >= 255 ? 255 : Math.round(value);

export const LUMA_RED = 0.299;
export const LUMA_GREEN = 0.587;
export const LUMA_BLUE = 0.114;

export const createSeededRandom = (seed: number): (() => number) => {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};
