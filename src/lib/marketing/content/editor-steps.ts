import { ClipboardList, SquarePen } from "lucide-react";
import type { StepItem } from "@/components/shared/admin/step-nav";
import type { ValueOf } from "@/lib/shared/utils";

export const EditorStep = {
  Planning: "planning",
  Content: "content",
} as const;
export type EditorStep = ValueOf<typeof EditorStep>;

export const editorSteps: readonly StepItem<EditorStep>[] = [
  { key: EditorStep.Planning, label: "Planejamento", icon: ClipboardList },
  { key: EditorStep.Content, label: "Conteúdo", icon: SquarePen },
];

const PLANNING_FIELD =
  /^(title|brandId|assigneeId|typeIds|publishDate|planSummary|planMedia|channels\.\d+\.(channelId|format))$/;

export const stepOfField = (field: string, hasRows: boolean): EditorStep => {
  if (field === "channels") return hasRows ? EditorStep.Content : EditorStep.Planning;
  return PLANNING_FIELD.test(field) ? EditorStep.Planning : EditorStep.Content;
};

export const stepsWithErrors = (
  fields: Record<string, string>,
  hasRows: boolean,
): Set<EditorStep> => new Set(Object.keys(fields).map((field) => stepOfField(field, hasRows)));

export const stepToShow = (
  fields: Record<string, string>,
  hasRows: boolean,
  current: EditorStep,
): EditorStep | null => {
  const invalid = stepsWithErrors(fields, hasRows);
  if (invalid.size === 0 || invalid.has(current)) return null;
  return editorSteps.find((step) => invalid.has(step.key))?.key ?? null;
};
