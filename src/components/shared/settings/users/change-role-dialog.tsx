import { useQuery } from "@tanstack/react-query";
import { UserCog } from "lucide-react";
import { useState } from "react";
import { FormDialog } from "@/components/shared/admin/form-dialog";
import { SelectField } from "@/components/shared/admin/form-fields";
import { useServerAction } from "@/hooks/shared/use-server-action";
import { listAssignableRoles } from "@/lib/shared/auth/roles.functions";
import { setUserAccess, type UserRow } from "@/lib/shared/auth/users.functions";
import { QueryKey } from "@/lib/shared/query-keys";
import { unwrapResult } from "@/lib/shared/result-client";

export function ChangeRoleDialog({
  user,
  onOpenChange,
}: {
  user: UserRow | null;
  onOpenChange: (open: boolean) => void;
}) {
  const { run, busy } = useServerAction();
  const [roleId, setRoleId] = useState("");
  const roles = useQuery({
    queryKey: QueryKey.Roles.assignable(),
    queryFn: async () => unwrapResult(await listAssignableRoles()).roles,
    enabled: user !== null,
  });

  return (
    <FormDialog
      open={user !== null}
      onOpenChange={onOpenChange}
      icon={UserCog}
      title="Alterar perfil"
      description={user ? `Escolha o novo perfil de ${user.fullName}.` : undefined}
      submitLabel="Salvar"
      busy={busy}
      submitDisabled={roleId === ""}
      onSubmit={async () => {
        if (user === null) return;
        const result = await run(
          () => setUserAccess({ data: { profileId: user.id, status: user.status, roleId } }),
          { success: "Perfil alterado.", invalidate: [QueryKey.Users.all()] },
        );
        if (result.ok) onOpenChange(false);
      }}
    >
      <SelectField
        id="change-role"
        label="Perfil"
        value={roleId}
        onValueChange={setRoleId}
        options={(roles.data ?? []).map((item) => ({ value: item.id, label: item.name }))}
        placeholder={roles.isPending ? "Carregando…" : "Escolha o perfil"}
      />
    </FormDialog>
  );
}
