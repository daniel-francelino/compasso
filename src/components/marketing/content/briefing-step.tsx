import { ClipboardList } from "lucide-react";
import { ContentSettingsSection } from "@/components/marketing/content/content-settings-section";
import { SectionCard } from "@/components/shared/admin/section-card";
import type { ContentDraft } from "@/hooks/marketing/use-content-draft";
import type { StageState } from "@/lib/marketing/content/stage-state";

export function BriefingStep({
  draft,
  assignees,
  disabled,
  state,
  errors,
}: {
  draft: ContentDraft;
  assignees: { id: string; name: string }[];
  disabled: boolean;
  state: StageState;
  errors: Record<string, string>;
}) {
  return (
    <SectionCard title="Briefing" icon={ClipboardList}>
      <ContentSettingsSection
        draft={draft}
        assignees={assignees}
        disabled={disabled}
        objectiveLocked={state.planLocked}
        errors={errors}
        showBriefing
      />
    </SectionCard>
  );
}
