import { SelectField } from "@/components/shared/admin/form-fields";
import { PersonAvatar } from "@/components/shared/admin/person-avatar";
import type { ContentDraft } from "@/hooks/marketing/use-content-draft";
import { useAvatarUrls } from "@/hooks/shared/use-avatar-urls";

const NONE = "none";

export function ContentAssigneeField({
  draft,
  assignees,
  disabled,
  error,
}: {
  draft: ContentDraft;
  assignees: { id: string; name: string }[];
  disabled: boolean;
  error: string | undefined;
}) {
  const { values, set } = draft;
  const avatars = useAvatarUrls(assignees.map((person) => person.id));
  return (
    <SelectField
      id="content-assignee"
      label="Responsável"
      value={values.assigneeId ?? NONE}
      disabled={disabled || values.brandId === ""}
      emptyText={assignees.length === 0 ? "Nenhuma pessoa disponível" : undefined}
      onValueChange={(value) => set("assigneeId", value === NONE ? null : value)}
      options={[
        { value: NONE, label: "Sem responsável" },
        ...assignees.map((person) => ({
          value: person.id,
          label: person.name,
          icon: <PersonAvatar name={person.name} url={avatars[person.id]} size="xs" />,
        })),
      ]}
      error={error}
    />
  );
}
