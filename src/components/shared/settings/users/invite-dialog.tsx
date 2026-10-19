import { useQuery } from "@tanstack/react-query";
import { MailPlus } from "lucide-react";
import { useState } from "react";
import { BrandAvatar } from "@/components/shared/admin/brand-avatar";
import { InfoTip } from "@/components/shared/admin/info-tip";
import { FormError } from "@/components/shared/admin/auth-shell";
import { FormDialog } from "@/components/shared/admin/form-dialog";
import { SelectField, TextField } from "@/components/shared/admin/form-fields";
import { Checkbox } from "@/components/shared/ui/checkbox";
import { Label } from "@/components/shared/ui/label";
import { Switch } from "@/components/shared/ui/switch";
import type { InviteLink } from "@/components/shared/settings/users/invite-link-dialog";
import { useFormSubmit } from "@/hooks/shared/use-form-submit";
import { createInvitation } from "@/lib/shared/auth/invitations.functions";
import { listAssignableRoles } from "@/lib/shared/auth/roles.functions";
import { createInvitationSchema } from "@/lib/shared/auth/schemas";
import { listBrandOptions } from "@/lib/shared/brands/brand-options.functions";
import { QueryKey } from "@/lib/shared/query-keys";
import { unwrapResult } from "@/lib/shared/result-client";

type Grant = { brandId: string; canDecide: boolean };

export function InviteDialog({
  open,
  onOpenChange,
  initialEmail = "",
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialEmail?: string;
  onCreated: (invite: InviteLink) => void;
}) {
  const { formRef, errors, error, busy, submit } = useFormSubmit();
  const [email, setEmail] = useState(initialEmail);
  const [roleId, setRoleId] = useState("");
  const [grants, setGrants] = useState<Grant[]>([]);
  const [sendEmail, setSendEmail] = useState(false);

  const roles = useQuery({
    queryKey: QueryKey.Roles.assignable(),
    queryFn: async () => unwrapResult(await listAssignableRoles()).roles,
    enabled: open,
  });
  const brands = useQuery({
    queryKey: QueryKey.Brands.options(),
    queryFn: async () => unwrapResult(await listBrandOptions()).brands,
    enabled: open,
  });

  const role = roles.data?.find((item) => item.id === roleId);

  const toggleBrand = (brandId: string, checked: boolean) =>
    setGrants((current) =>
      checked
        ? [...current, { brandId, canDecide: false }]
        : current.filter((grant) => grant.brandId !== brandId),
    );

  const setDecide = (brandId: string, canDecide: boolean) =>
    setGrants((current) =>
      current.map((grant) => (grant.brandId === brandId ? { ...grant, canDecide } : grant)),
    );

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      icon={MailPlus}
      title="Convidar pessoa"
      description="Você escolhe o perfil e as marcas e recebe um link para entregar à pessoa. Ela define a própria senha. O link vale por 7 dias."
      submitLabel="Gerar link de acesso"
      busy={busy}
      form={{
        ref: formRef,
        noValidate: true,
        onSubmit: (event) => {
          event.preventDefault();
          void submit(
            createInvitationSchema,
            { email, roleId, grants, sendEmail },
            (data) => createInvitation({ data }),
            (result) => {
              onCreated({
                email,
                link: result.link,
                expiresAt: result.expiresAt,
                emailSent: result.emailSent,
              });
              onOpenChange(false);
            },
          );
        },
      }}
    >
      <TextField
        id="invite-email"
        label="E-mail"
        type="email"
        required
        value={email}
        onValueChange={setEmail}
        error={errors["email"]}
        autoComplete="off"
      />
      <SelectField
        id="invite-role"
        label="Perfil"
        required
        value={roleId}
        onValueChange={(value) => {
          setRoleId(value);
          setGrants([]);
        }}
        options={(roles.data ?? []).map((item) => ({
          value: item.id,
          label: item.portalOnly ? `${item.name} (portal do cliente)` : item.name,
        }))}
        placeholder={roles.isPending ? "Carregando…" : "Escolha o perfil"}
        error={errors["roleId"]}
      />
      {role ? (
        <div className="space-y-2" role="group" aria-labelledby="invite-brands-label">
          <p id="invite-brands-label" className="text-sm font-medium">
            {role.portalOnly ? "Marcas que a pessoa acompanha" : "Marcas"}
          </p>
          {brands.data?.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma marca disponível.</p>
          ) : null}
          <ul className="max-h-56 space-y-1 overflow-y-auto rounded-md border border-input p-2">
            {(brands.data ?? []).map((brand) => {
              const grant = grants.find((item) => item.brandId === brand.id);
              return (
                <li
                  key={brand.id}
                  className="flex flex-wrap items-center justify-between gap-2 py-1"
                >
                  <span className="flex items-center gap-2">
                    <Checkbox
                      id={`brand-${brand.id}`}
                      checked={grant !== undefined}
                      onCheckedChange={(checked) => toggleBrand(brand.id, checked === true)}
                    />
                    <Label htmlFor={`brand-${brand.id}`} className="flex items-center gap-2">
                      <BrandAvatar name={brand.name} logoUrl={brand.logoUrl} size="sm" />
                      <span>
                        {brand.name}
                        <span className="text-muted-foreground"> · {brand.clientName}</span>
                      </span>
                    </Label>
                  </span>
                  {grant && role.portalOnly ? (
                    <span className="flex items-center gap-2 text-sm">
                      <Checkbox
                        id={`decide-${brand.id}`}
                        checked={grant.canDecide}
                        onCheckedChange={(checked) => setDecide(brand.id, checked === true)}
                      />
                      <Label htmlFor={`decide-${brand.id}`}>Pode aprovar</Label>
                    </span>
                  ) : null}
                </li>
              );
            })}
          </ul>
          {errors["grants"] ? <p className="text-xs text-destructive">{errors["grants"]}</p> : null}
        </div>
      ) : null}
      <div className="flex items-center gap-3">
        <Switch id="invite-send-email" checked={sendEmail} onCheckedChange={setSendEmail} />
        <Label htmlFor="invite-send-email">Também enviar por e-mail</Label>
        <InfoTip label="Sobre o envio por e-mail">
          Desligado, nada é enviado: você copia o link e entrega por WhatsApp ou outro canal.
        </InfoTip>
      </div>
      <FormError message={error} />
    </FormDialog>
  );
}
