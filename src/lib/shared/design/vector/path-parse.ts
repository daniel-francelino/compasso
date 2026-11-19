import type { Result } from "@/lib/shared/server-utils";
import { arcToCommands } from "@/lib/shared/design/vector/path-arc";
import {
  type Cursor,
  isLetter,
  isNumberStart,
  readFlag,
  readNumber,
  skipSeparator,
  skipWhitespace,
} from "@/lib/shared/design/vector/path-scan";
import {
  type PathCommand,
  type PathFailureReason,
  type PathLimits,
  PathFailure,
  commandCoordinates,
  isCoordinate,
  maxSourceOf,
  pathFailure,
} from "@/lib/shared/design/vector/path-types";

type Point = { x: number; y: number };

type Flags = [boolean, boolean];

type State = {
  limits: PathLimits;
  cx: number;
  cy: number;
  sx: number;
  sy: number;
  prevCubic: Point | null;
  prevQuad: Point | null;
  closed: boolean;
  count: number;
  subpaths: PathCommand[][];
  current: PathCommand[];
};

const ARITY: Record<string, number> = {
  M: 2,
  L: 2,
  H: 1,
  V: 1,
  C: 6,
  S: 4,
  Q: 4,
  T: 2,
  A: 7,
  Z: 0,
};

const ARC_ARITY = 7;
const ARC_LARGE_FLAG = 3;
const ARC_SWEEP_FLAG = 4;

const hasDrawing = (commands: PathCommand[]): boolean =>
  commands.some((command) => command.type === "L" || command.type === "C" || command.type === "Q");

const flush = (state: State): void => {
  if (hasDrawing(state.current)) state.subpaths.push(state.current);
  state.current = [];
};

const push = (state: State, command: PathCommand): PathFailureReason | null => {
  state.count += 1;
  if (state.count > state.limits.maxCommands) return PathFailure.TooManyCommands;
  if (!commandCoordinates(command).every((value) => isCoordinate(value, state.limits))) {
    return PathFailure.OutOfRange;
  }
  state.current.push(command);
  return null;
};

const moveTo = (state: State, x: number, y: number): PathFailureReason | null => {
  flush(state);
  state.sx = x;
  state.sy = y;
  state.closed = false;
  return push(state, { type: "M", x, y });
};

const resumeAfterClose = (state: State): PathFailureReason | null => {
  if (!state.closed) return null;
  flush(state);
  state.closed = false;
  return push(state, { type: "M", x: state.sx, y: state.sy });
};

const draw = (state: State, commands: PathCommand[]): PathFailureReason | null => {
  const resumed = resumeAfterClose(state);
  if (resumed !== null) return resumed;
  for (const command of commands) {
    const failed = push(state, command);
    if (failed !== null) return failed;
  }
  return null;
};

const at = (args: number[], index: number): number => args[index] ?? 0;

const closePath = (state: State): PathFailureReason | null => {
  if (state.closed) return null;
  const failed = push(state, { type: "Z" });
  state.closed = true;
  state.cx = state.sx;
  state.cy = state.sy;
  state.prevCubic = null;
  state.prevQuad = null;
  return failed;
};

const reflect = (control: Point | null, state: State): Point =>
  control === null
    ? { x: state.cx, y: state.cy }
    : { x: 2 * state.cx - control.x, y: 2 * state.cy - control.y };

const applyCubic = (
  state: State,
  smooth: boolean,
  args: number[],
  ox: number,
  oy: number,
): PathFailureReason | null => {
  const first = smooth
    ? reflect(state.prevCubic, state)
    : { x: ox + at(args, 0), y: oy + at(args, 1) };
  const base = smooth ? 0 : 2;
  const x2 = ox + at(args, base);
  const y2 = oy + at(args, base + 1);
  const x = ox + at(args, base + 2);
  const y = oy + at(args, base + 3);
  const failed = draw(state, [{ type: "C", x1: first.x, y1: first.y, x2, y2, x, y }]);
  state.prevCubic = { x: x2, y: y2 };
  state.prevQuad = null;
  state.cx = x;
  state.cy = y;
  return failed;
};

const applyQuad = (
  state: State,
  smooth: boolean,
  args: number[],
  ox: number,
  oy: number,
): PathFailureReason | null => {
  const control = smooth
    ? reflect(state.prevQuad, state)
    : { x: ox + at(args, 0), y: oy + at(args, 1) };
  const base = smooth ? 0 : 2;
  const x = ox + at(args, base);
  const y = oy + at(args, base + 1);
  const failed = draw(state, [{ type: "Q", x1: control.x, y1: control.y, x, y }]);
  state.prevQuad = control;
  state.prevCubic = null;
  state.cx = x;
  state.cy = y;
  return failed;
};

const applyArc = (
  state: State,
  args: number[],
  flags: Flags,
  ox: number,
  oy: number,
): PathFailureReason | null => {
  const x = ox + at(args, 5);
  const y = oy + at(args, 6);
  const commands = arcToCommands({
    x0: state.cx,
    y0: state.cy,
    rx: at(args, 0),
    ry: at(args, 1),
    rotation: at(args, 2),
    largeArc: flags[0],
    sweep: flags[1],
    x,
    y,
  });
  const failed = draw(state, commands);
  state.prevCubic = null;
  state.prevQuad = null;
  state.cx = x;
  state.cy = y;
  return failed;
};

const applyLine = (state: State, x: number, y: number): PathFailureReason | null => {
  const failed = draw(state, [{ type: "L", x, y }]);
  state.prevCubic = null;
  state.prevQuad = null;
  state.cx = x;
  state.cy = y;
  return failed;
};

const applyMove = (state: State, x: number, y: number): PathFailureReason | null => {
  state.prevCubic = null;
  state.prevQuad = null;
  const failed = moveTo(state, x, y);
  state.cx = x;
  state.cy = y;
  return failed;
};

const applyCommand = (
  state: State,
  letter: string,
  args: number[],
  flags: Flags,
): PathFailureReason | null => {
  const upper = letter.toUpperCase();
  const relative = letter !== upper;
  const ox = relative ? state.cx : 0;
  const oy = relative ? state.cy : 0;
  switch (upper) {
    case "M":
      return applyMove(state, ox + at(args, 0), oy + at(args, 1));
    case "L":
      return applyLine(state, ox + at(args, 0), oy + at(args, 1));
    case "H":
      return applyLine(state, ox + at(args, 0), state.cy);
    case "V":
      return applyLine(state, state.cx, oy + at(args, 0));
    case "C":
    case "S":
      return applyCubic(state, upper === "S", args, ox, oy);
    case "Q":
    case "T":
      return applyQuad(state, upper === "T", args, ox, oy);
    default:
      return applyArc(state, args, flags, ox, oy);
  }
};

const readArguments = (
  cursor: Cursor,
  letter: string,
  args: number[],
  flags: Flags,
): PathFailureReason | null => {
  const arity = ARITY[letter.toUpperCase()] ?? 0;
  args.length = 0;
  for (let index = 0; index < arity; index += 1) {
    if (index > 0) skipSeparator(cursor);
    if (cursor.index >= cursor.source.length) return PathFailure.Truncated;
    const isFlag = arity === ARC_ARITY && (index === ARC_LARGE_FLAG || index === ARC_SWEEP_FLAG);
    const value = isFlag ? readFlag(cursor) : readNumber(cursor);
    if (value === null) return isFlag ? PathFailure.BadFlag : PathFailure.BadNumber;
    if (isFlag) flags[index - ARC_LARGE_FLAG] = value === true;
    args.push(typeof value === "boolean" ? Number(value) : value);
  }
  return null;
};

const nextCommand = (letter: string): string => {
  if (letter === "M") return "L";
  return letter === "m" ? "l" : letter;
};

const step = (
  state: State,
  cursor: Cursor,
  letter: string,
  args: number[],
  flags: Flags,
): PathFailureReason | null => {
  const failedRead = readArguments(cursor, letter, args, flags);
  if (failedRead !== null) return failedRead;
  const failed = applyCommand(state, letter, args, flags);
  if (failed !== null) return failed;
  const hadComma = skipSeparator(cursor);
  const atEnd = cursor.index >= cursor.source.length;
  if (hadComma && (atEnd || !isNumberStart(cursor.source.charCodeAt(cursor.index)))) {
    return PathFailure.BadStructure;
  }
  return null;
};

const checkLetter = (state: State, code: number): PathFailureReason | null => {
  const upper = String.fromCharCode(code).toUpperCase();
  if (!isLetter(code) || ARITY[upper] === undefined) return PathFailure.BadCharacter;
  if (state.count === 0 && upper !== "M") return PathFailure.BadStart;
  return null;
};

const finish = (state: State): Result<{ commands: PathCommand[] }> => {
  flush(state);
  const commands = state.subpaths.flat();
  if (commands.length === 0) return pathFailure(PathFailure.Empty);
  return { ok: true, commands };
};

type Run = {
  state: State;
  cursor: Cursor;
  args: number[];
  flags: Flags;
  letter: string;
};

const isClose = (letter: string): boolean => letter === "Z" || letter === "z";

const beginLetter = (run: Run, code: number): PathFailureReason | null => {
  const invalidLetter = checkLetter(run.state, code);
  if (invalidLetter !== null) return invalidLetter;
  run.letter = String.fromCharCode(code);
  run.cursor.index += 1;
  skipWhitespace(run.cursor);
  return isClose(run.letter) ? closePath(run.state) : null;
};

const advance = (run: Run): PathFailureReason | null => {
  const code = run.cursor.source.charCodeAt(run.cursor.index);
  const startsLetter = !isNumberStart(code);
  const began = startsLetter ? beginLetter(run, code) : null;
  if (began !== null || (startsLetter && isClose(run.letter))) return began;
  if (run.letter === "") return PathFailure.BadStart;
  if (isClose(run.letter)) return PathFailure.BadStructure;
  const failed = step(run.state, run.cursor, run.letter, run.args, run.flags);
  run.letter = nextCommand(run.letter);
  return failed;
};

export const parsePathData = (
  source: string,
  limits: PathLimits,
): Result<{ commands: PathCommand[] }> => {
  if (source.length > maxSourceOf(limits)) return pathFailure(PathFailure.SourceTooLong);
  const run: Run = {
    state: {
      limits,
      cx: 0,
      cy: 0,
      sx: 0,
      sy: 0,
      prevCubic: null,
      prevQuad: null,
      closed: false,
      count: 0,
      subpaths: [],
      current: [],
    },
    cursor: { source, index: 0 },
    args: [],
    flags: [false, false],
    letter: "",
  };
  skipWhitespace(run.cursor);
  while (run.cursor.index < source.length) {
    const failed = advance(run);
    if (failed !== null) return pathFailure(failed);
  }
  return finish(run.state);
};
