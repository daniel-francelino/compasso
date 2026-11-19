export type Cursor = { source: string; index: number };

const CODE_0 = 48;
const CODE_1 = 49;
const CODE_9 = 57;
const CODE_PLUS = 43;
const CODE_MINUS = 45;
const CODE_DOT = 46;
const CODE_COMMA = 44;
const CODE_E_LOWER = 101;
const CODE_E_UPPER = 69;
const CODE_A_UPPER = 65;
const CODE_Z_UPPER = 90;
const CODE_A_LOWER = 97;
const CODE_Z_LOWER = 122;

const isDigit = (code: number): boolean => code >= CODE_0 && code <= CODE_9;

const isSign = (code: number): boolean => code === CODE_PLUS || code === CODE_MINUS;

export const isWhitespace = (code: number): boolean =>
  code === 32 || code === 9 || code === 10 || code === 13 || code === 12;

export const isLetter = (code: number): boolean =>
  (code >= CODE_A_UPPER && code <= CODE_Z_UPPER) || (code >= CODE_A_LOWER && code <= CODE_Z_LOWER);

export const isNumberStart = (code: number): boolean =>
  isDigit(code) || isSign(code) || code === CODE_DOT;

export const skipWhitespace = (cursor: Cursor): void => {
  while (
    cursor.index < cursor.source.length &&
    isWhitespace(cursor.source.charCodeAt(cursor.index))
  ) {
    cursor.index += 1;
  }
};

export const skipSeparator = (cursor: Cursor): boolean => {
  skipWhitespace(cursor);
  if (cursor.source.charCodeAt(cursor.index) !== CODE_COMMA) return false;
  cursor.index += 1;
  skipWhitespace(cursor);
  return true;
};

const skipDigits = (source: string, from: number): number => {
  let index = from;
  while (isDigit(source.charCodeAt(index))) index += 1;
  return index;
};

const exponentEnd = (source: string, from: number): number => {
  const code = source.charCodeAt(from);
  if (code !== CODE_E_LOWER && code !== CODE_E_UPPER) return from;
  const digitsFrom = isSign(source.charCodeAt(from + 1)) ? from + 2 : from + 1;
  const end = skipDigits(source, digitsFrom);
  return end > digitsFrom ? end : from;
};

export const readNumber = (cursor: Cursor): number | null => {
  const { source } = cursor;
  const start = cursor.index;
  let index = isSign(source.charCodeAt(start)) ? start + 1 : start;
  const integerEnd = skipDigits(source, index);
  let digits = integerEnd - index;
  index = integerEnd;
  if (source.charCodeAt(index) === CODE_DOT) {
    const fractionEnd = skipDigits(source, index + 1);
    digits += fractionEnd - index - 1;
    index = fractionEnd;
  }
  if (digits === 0) return null;
  index = exponentEnd(source, index);
  const value = Number(source.slice(start, index));
  if (!Number.isFinite(value)) return null;
  cursor.index = index;
  return value === 0 ? 0 : value;
};

export const readFlag = (cursor: Cursor): boolean | null => {
  const code = cursor.source.charCodeAt(cursor.index);
  if (code !== CODE_0 && code !== CODE_1) return null;
  cursor.index += 1;
  return code === CODE_1;
};
