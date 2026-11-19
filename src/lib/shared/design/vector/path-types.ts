import { type Failure, invalid } from "@/lib/shared/server-utils";

export type PathCommand =
  | { type: "M"; x: number; y: number }
  | { type: "L"; x: number; y: number }
  | { type: "C"; x1: number; y1: number; x2: number; y2: number; x: number; y: number }
  | { type: "Q"; x1: number; y1: number; x: number; y: number }
  | { type: "Z" };

export type PathLimits = {
  maxData: number;
  maxCommands: number;
  maxSource?: number;
  maxCoordinate?: number;
};

export type Bounds = { minX: number; minY: number; maxX: number; maxY: number };

export const DEFAULT_MAX_SOURCE = 524288;
export const DEFAULT_MAX_COORDINATE = 1e7;
export const PATH_PRECISION = 3;

export const PathFailure = {
  Empty: "path_empty",
  SourceTooLong: "path_source_too_long",
  DataTooLong: "path_data_too_long",
  TooManyCommands: "path_too_many_commands",
  BadCharacter: "path_bad_character",
  BadNumber: "path_bad_number",
  BadFlag: "path_bad_flag",
  BadStart: "path_bad_start",
  BadStructure: "path_bad_structure",
  Truncated: "path_truncated",
  OutOfRange: "path_out_of_range",
  TooLarge: "path_too_large",
} as const;

export type PathFailureReason = (typeof PathFailure)[keyof typeof PathFailure];

export const pathFailure = (reason: PathFailureReason): Failure => invalid(reason);

export const maxCoordinateOf = (limits: PathLimits): number =>
  limits.maxCoordinate ?? DEFAULT_MAX_COORDINATE;

export const maxSourceOf = (limits: PathLimits): number => limits.maxSource ?? DEFAULT_MAX_SOURCE;

export const isCoordinate = (value: number, limits: PathLimits): boolean =>
  Number.isFinite(value) && Math.abs(value) <= maxCoordinateOf(limits);

export const commandCoordinates = (command: PathCommand): number[] => {
  switch (command.type) {
    case "Z":
      return [];
    case "M":
    case "L":
      return [command.x, command.y];
    case "Q":
      return [command.x1, command.y1, command.x, command.y];
    case "C":
      return [command.x1, command.y1, command.x2, command.y2, command.x, command.y];
  }
};
