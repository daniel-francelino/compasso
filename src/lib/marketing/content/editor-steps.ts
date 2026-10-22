import { ClipboardList, FileText, SquarePen } from "lucide-react";
import type { StepItem } from "@/components/shared/admin/step-nav";
import type { ValueOf } from "@/lib/shared/utils";

export const EditorStep = {
  Planning: "planning",
  Briefing: "briefing",
  Content: "content",
} as const;
export type EditorStep = ValueOf<typeof EditorStep>;

export const editorSteps: readonly StepItem<EditorStep>[] = [
  { key: EditorStep.Planning, label: "Planejamento", icon: ClipboardList },
  { key: EditorStep.Briefing, label: "Briefing", icon: FileText },
  { key: EditorStep.Content, label: "Conteúdo", icon: SquarePen },
];
