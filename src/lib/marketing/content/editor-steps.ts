import type { StepItem } from "@/components/shared/admin/step-nav";
import type { ValueOf } from "@/lib/shared/utils";

export const EditorStep = {
  Planning: "planning",
  Briefing: "briefing",
  Content: "content",
} as const;
export type EditorStep = ValueOf<typeof EditorStep>;

export const editorSteps: readonly StepItem<EditorStep>[] = [
  { key: EditorStep.Planning, label: "Planejamento" },
  { key: EditorStep.Briefing, label: "Briefing" },
  { key: EditorStep.Content, label: "Conteúdo" },
];
