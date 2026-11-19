import type { ValueOf } from "@/lib/shared/utils";
import { SVG_VECTOR_LIMITS } from "@/lib/shared/design/import/limits";
import { type CodedFailure, codedFailure } from "@/lib/shared/design/import/refusal";
import type { PathPaint, PathStroke } from "@/lib/shared/design/schemas";
import type { DesignPathFillRule } from "@/lib/shared/design/types";
import type { Bounds } from "@/lib/shared/design/vector/path-data";

export const SvgFallback = {
  Unsupported: "svg_unsupported",
  Malformed: "svg_malformed",
  ParseLimit: "svg_parse_limit",
  VectorLimit: "svg_vector_limit",
  TooLarge: "svg_too_large",
  Timeout: "svg_timeout",
  Internal: "svg_internal_error",
} as const;
export type SvgFallback = ValueOf<typeof SvgFallback>;

export type SvgFailure = CodedFailure<SvgFallback>;

export const svgFailure = (reason: SvgFallback): SvgFailure => codedFailure(reason, reason);

export class SvgReject extends Error {
  readonly reason: SvgFallback;

  constructor(reason: SvgFallback) {
    super(reason);
    this.reason = reason;
  }
}

export const reject = (reason: SvgFallback): SvgReject => new SvgReject(reason);

export type SvgClock = () => number;

export type SvgVectorOptions = { now?: SvgClock; budgetMs?: number };

export type Deadline = { now: SvgClock; at: number };

const defaultClock: SvgClock = () => performance.now();

export const startDeadline = (options: SvgVectorOptions = {}): Deadline => {
  const now = options.now ?? defaultClock;
  return { now, at: now() + (options.budgetMs ?? SVG_VECTOR_LIMITS.timeBudgetMs) };
};

export const checkDeadline = (deadline: Deadline): void => {
  if (deadline.now() > deadline.at) throw reject(SvgFallback.Timeout);
};

export type XmlElement = {
  name: string;
  attrs: Map<string, string>;
  children: XmlElement[];
  text: string;
};

export type SvgVectorShape = {
  name: string | null;
  d: string;
  commandCount: number;
  fill: PathPaint | null;
  stroke: PathStroke | null;
  fillRule: DesignPathFillRule;
  opacity: number;
  bounds: Bounds;
};

export type SvgVectorDocument = {
  width: number;
  height: number;
  shapes: SvgVectorShape[];
  dataBytes: number;
};

export type SvgVectorResult = ({ ok: true } & SvgVectorDocument) | SvgFailure;

export type Budget = { deadline: Deadline; units: number };

export const startBudget = (deadline: Deadline): Budget => ({ deadline, units: 0 });

export const spend = (budget: Budget, units: number): void => {
  budget.units += units;
  if (budget.units > SVG_VECTOR_LIMITS.maxStyleWork) throw reject(SvgFallback.ParseLimit);
  checkDeadline(budget.deadline);
};
