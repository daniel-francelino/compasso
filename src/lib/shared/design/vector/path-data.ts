import type { Result } from "@/lib/shared/server-utils";
import {
  type Matrix,
  applyToPoint,
  compose,
  isFiniteMatrix,
  scale,
  translate,
} from "@/lib/shared/design/vector/matrix";
import { pathBounds } from "@/lib/shared/design/vector/path-bounds";
import { parsePathData } from "@/lib/shared/design/vector/path-parse";
import {
  type PathCommand,
  type PathLimits,
  PATH_PRECISION,
  PathFailure,
  commandCoordinates,
  isCoordinate,
  pathFailure,
} from "@/lib/shared/design/vector/path-types";

export { arcToCommands } from "@/lib/shared/design/vector/path-arc";
export { pathBounds } from "@/lib/shared/design/vector/path-bounds";
export { parsePathData } from "@/lib/shared/design/vector/path-parse";
export {
  type Bounds,
  type PathCommand,
  type PathLimits,
  PathFailure,
  type PathFailureReason,
} from "@/lib/shared/design/vector/path-types";

const ALLOWED_LETTERS = "MLCQZ";

const isAllowedCode = (code: number): boolean => {
  if (code >= 48 && code <= 57) return true;
  if (code === 32 || code === 44 || code === 43 || code === 45 || code === 46) return true;
  if (code === 101 || code === 69) return true;
  return ALLOWED_LETTERS.includes(String.fromCharCode(code));
};

const isCommandLetter = (code: number): boolean =>
  ALLOWED_LETTERS.includes(String.fromCharCode(code));

export const validatePathData = (
  data: string,
  limits: PathLimits,
): Result<{ commands: number }> => {
  if (data.length === 0) return pathFailure(PathFailure.Empty);
  if (data.length > limits.maxData) return pathFailure(PathFailure.DataTooLong);
  if (data.charCodeAt(0) !== 77) return pathFailure(PathFailure.BadStart);
  let commands = 0;
  for (let index = 0; index < data.length; index += 1) {
    const code = data.charCodeAt(index);
    if (!isAllowedCode(code)) return pathFailure(PathFailure.BadCharacter);
    if (isCommandLetter(code)) commands += 1;
    if (commands > limits.maxCommands) return pathFailure(PathFailure.TooManyCommands);
  }
  return { ok: true, commands };
};

export const quantize = (value: number): number => {
  const rounded = Number(value.toFixed(PATH_PRECISION));
  return rounded === 0 ? 0 : rounded;
};

const quantizeCommand = (command: PathCommand): PathCommand => {
  switch (command.type) {
    case "Z":
      return command;
    case "M":
    case "L":
      return { type: command.type, x: quantize(command.x), y: quantize(command.y) };
    case "Q":
      return {
        type: "Q",
        x1: quantize(command.x1),
        y1: quantize(command.y1),
        x: quantize(command.x),
        y: quantize(command.y),
      };
    case "C":
      return {
        type: "C",
        x1: quantize(command.x1),
        y1: quantize(command.y1),
        x2: quantize(command.x2),
        y2: quantize(command.y2),
        x: quantize(command.x),
        y: quantize(command.y),
      };
  }
};

export const quantizeCommands = (commands: readonly PathCommand[]): PathCommand[] =>
  commands.map(quantizeCommand);

const checkCommands = (commands: readonly PathCommand[], limits: PathLimits): PathFailureOrNull => {
  if (commands.length === 0) return PathFailure.Empty;
  if (commands.length > limits.maxCommands) return PathFailure.TooManyCommands;
  if (commands[0]?.type !== "M") return PathFailure.BadStart;
  const bad = commands.some((command) =>
    commandCoordinates(command).some((value) => !isCoordinate(value, limits)),
  );
  return bad ? PathFailure.OutOfRange : null;
};

type PathFailureOrNull = (typeof PathFailure)[keyof typeof PathFailure] | null;

const writeCommand = (command: PathCommand): string => {
  const numbers = commandCoordinates(quantizeCommand(command));
  return `${command.type}${numbers.join(" ")}`;
};

export const serializePath = (
  commands: readonly PathCommand[],
  limits: PathLimits,
): Result<{ d: string }> => {
  const failed = checkCommands(commands, limits);
  if (failed !== null) return pathFailure(failed);
  const d = commands.map(writeCommand).join("");
  if (d.length > limits.maxData) return pathFailure(PathFailure.DataTooLong);
  return { ok: true, d };
};

export const normalizePathData = (
  source: string,
  limits: PathLimits,
): Result<{ commands: PathCommand[]; d: string }> => {
  const parsed = parsePathData(source, limits);
  if (!parsed.ok) return parsed;
  const commands = quantizeCommands(parsed.commands);
  const serialized = serializePath(commands, limits);
  if (!serialized.ok) return serialized;
  return { ok: true, commands, d: serialized.d };
};

export const readNormalizedPath = (
  data: string,
  limits: PathLimits,
): Result<{ commands: PathCommand[] }> => {
  const valid = validatePathData(data, limits);
  if (!valid.ok) return valid;
  return parsePathData(data, limits);
};

export const mergePaths = (
  parts: readonly (readonly PathCommand[])[],
  limits: PathLimits,
): Result<{ commands: PathCommand[] }> => {
  const commands = parts.flat();
  const failed = checkCommands(commands, limits);
  if (failed !== null) return pathFailure(failed);
  return { ok: true, commands };
};

const transformCommand = (command: PathCommand, m: Matrix): PathCommand => {
  switch (command.type) {
    case "Z":
      return command;
    case "M":
    case "L":
      return { type: command.type, ...applyToPoint(m, command) };
    case "Q": {
      const control = applyToPoint(m, { x: command.x1, y: command.y1 });
      const end = applyToPoint(m, command);
      return { type: "Q", x1: control.x, y1: control.y, x: end.x, y: end.y };
    }
    case "C": {
      const first = applyToPoint(m, { x: command.x1, y: command.y1 });
      const second = applyToPoint(m, { x: command.x2, y: command.y2 });
      const end = applyToPoint(m, command);
      return {
        type: "C",
        x1: first.x,
        y1: first.y,
        x2: second.x,
        y2: second.y,
        x: end.x,
        y: end.y,
      };
    }
  }
};

export const transformPath = (
  commands: readonly PathCommand[],
  m: Matrix,
  limits: PathLimits,
): Result<{ commands: PathCommand[] }> => {
  if (!isFiniteMatrix(m)) return pathFailure(PathFailure.OutOfRange);
  const moved = commands.map((command) => transformCommand(command, m));
  const bad = moved.some((command) =>
    commandCoordinates(command).some((value) => !isCoordinate(value, limits)),
  );
  if (bad) return pathFailure(PathFailure.OutOfRange);
  return { ok: true, commands: moved };
};

export type BoxLocal = { commands: PathCommand[]; width: number; height: number };

export const toBoxLocal = (
  commands: readonly PathCommand[],
  options: { scale: number; maxSize: number },
  limits: PathLimits,
): Result<BoxLocal> => {
  if (!Number.isFinite(options.scale) || options.scale <= 0) {
    return pathFailure(PathFailure.OutOfRange);
  }
  const measured = pathBounds(commands);
  if (!measured.ok) return measured;
  const { minX, minY } = measured.bounds;
  const m = compose(scale(options.scale), translate(-minX, -minY));
  const moved = transformPath(commands, m, limits);
  if (!moved.ok) return moved;
  const quantized = quantizeCommands(moved.commands);
  const fitted = pathBounds(quantized);
  if (!fitted.ok) return fitted;
  const width = fitted.bounds.maxX - fitted.bounds.minX;
  const height = fitted.bounds.maxY - fitted.bounds.minY;
  if (width > options.maxSize || height > options.maxSize) {
    return pathFailure(PathFailure.TooLarge);
  }
  return { ok: true, commands: quantized, width, height };
};
