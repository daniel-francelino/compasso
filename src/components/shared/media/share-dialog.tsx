import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Ban, Copy, Link2, Share2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/shared/admin/confirm-dialog";
import { FormDialog } from "@/components/shared/admin/form-dialog";
import {
  NumberField,
  SelectField,
  TextAreaField,
  TextField,
} from "@/components/shared/admin/form-fields";
import { IconButton } from "@/components/shared/admin/icon-button";
import { PasswordField } from "@/components/shared/admin/auth-shell";
import { InfoTip } from "@/components/shared/admin/info-tip";
import { StatusBadge } from "@/components/shared/admin/status-badge";
import { Checkbox } from "@/components/shared/ui/checkbox";
import { Label } from "@/components/shared/ui/label";
import { Skeleton } from "@/components/shared/ui/skeleton";
import { MediaShareStatus, ShareKind } from "@/lib/shared/enums";
import { formatDateTime } from "@/lib/shared/format";
import { mediaShareStatusLabels } from "@/lib/shared/labels";
import { createShareSchema } from "@/lib/shared/media/schemas";
import {
  type ShareRow,
  createMediaShare,
  listMediaShares,
  revokeMediaShare,
} from "@/lib/shared/media/sharing.functions";
import { QueryKey } from "@/lib/shared/query-keys";
import { unwrapResult } from "@/lib/shared/result-client";
import { zodFieldErrors } from "@/lib/shared/forms";
import { nowDate, plusDays, toIso } from "@/lib/shared/dates";

export type ShareTarget = { kind: ShareKind; id: string; name: string };

const NEVER = "never";
const expiryOptions = [
  { value: NEVER, label: "Sem validade" },
  { value: "1", label: "1 dia" },
  { value: "7", label: "7 dias" },
  { value: "30", label: "30 dias" },
  { value: "90", label: "90 dias" },
];

const linkOf = (token: string) => `${window.location.origin}/share/${token}`;

const statusTone = (status: MediaShareStatus) =>
  status === MediaShareStatus.Active ? "success" : "neutral";

function ShareList({ target }: { target: ShareTarget }) {
  const queryClient = useQueryClient();
  const [revoking, setRevoking] = useState<ShareRow | null>(null);
  const [busy, setBusy] = useState(false);
  const query = useQuery({
    queryKey: QueryKey.Media.shares(target.kind, target.id),
    queryFn: async () =>
      unwrapResult(await listMediaShares({ data: { kind: target.kind, targetId: target.id } }))
        .shares,
  });

  async function copy(row: ShareRow) {
    try {
      await navigator.clipboard.writeText(linkOf(row.token));
      toast.success("Link copiado.");
    } catch {
      toast.error("Não foi possível copiar. Selecione e copie o link manualmente.");
    }
  }

  async function revoke(row: ShareRow): Promise<boolean> {
    setBusy(true);
    const result = await revokeMediaShare({ data: { id: row.id } });
    setBusy(false);
    if (!result.ok) {
      toast.error(result.message);
      return false;
    }
    toast.success("Link encerrado.");
    await queryClient.invalidateQueries({ queryKey: QueryKey.Media.all() });
    return true;
  }

  if (query.isPending) return <Skeleton className="h-16 w-full" />;
  if (query.isError) {
    return <p className="text-sm text-destructive">{query.error.message}</p>;
  }
  if (query.data.length === 0) return null;

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">Links deste item</p>
      <ul className="divide-y divide-border rounded-md border border-border">
        {query.data.map((row) => (
          <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 p-3">
            <div className="min-w-0 space-y-1">
              <p className="truncate text-sm font-medium">{row.label}</p>
              <p className="text-xs text-muted-foreground">
                {row.views} visualizações · {row.downloadCount}
                {row.maxDownloads ? ` de ${row.maxDownloads}` : ""} downloads
                {row.expiresAt ? ` · até ${formatDateTime(row.expiresAt)}` : ""}
                {row.hasPassword ? " · com senha" : ""}
              </p>
            </div>
            <div className="flex items-center gap-1">
              <StatusBadge tone={statusTone(row.status)} icon={Link2}>
                {mediaShareStatusLabels[row.status]}
              </StatusBadge>
              {row.status === MediaShareStatus.Active ? (
                <>
                  <IconButton label="Copiar link" icon={Copy} onClick={() => void copy(row)} />
                  <IconButton
                    label="Encerrar link"
                    icon={Ban}
                    destructive
                    onClick={() => setRevoking(row)}
                  />
                </>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
      <ConfirmDialog
        open={revoking !== null}
        onOpenChange={(open) => !open && setRevoking(null)}
        title="Encerrar link"
        description={`Quem tiver o link «${revoking?.label ?? ""}» deixa de acessar agora. Não dá para reativar: crie outro se precisar.`}
        confirmLabel="Encerrar"
        destructive
        busy={busy}
        onConfirm={() => (revoking ? revoke(revoking) : false)}
      />
    </div>
  );
}

export function ShareDialog({
  target,
  onClose,
}: {
  target: ShareTarget | null;
  onClose: () => void;
}) {
  return target === null ? null : (
    <ShareDialogBody key={target.id} target={target} onClose={onClose} />
  );
}

function ShareDialogBody({ target, onClose }: { target: ShareTarget; onClose: () => void }) {
  const queryClient = useQueryClient();
  const isAsset = target.kind === ShareKind.Asset;
  const [label, setLabel] = useState(target.name.slice(0, 80));
  const [message, setMessage] = useState("");
  const [expiry, setExpiry] = useState(NEVER);
  const [password, setPassword] = useState("");
  const [maxDownloads, setMaxDownloads] = useState("");
  const [allowDownload, setAllowDownload] = useState(true);
  const [followLatest, setFollowLatest] = useState(false);
  const [includeSub, setIncludeSub] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (busy) return;
    const max = maxDownloads.trim() === "" ? null : Number(maxDownloads);
    const parsed = createShareSchema.safeParse({
      kind: target.kind,
      targetId: target.id,
      label,
      message: message === "" ? undefined : message,
      expiresAt: expiry === NEVER ? null : toIso(plusDays(nowDate(), Number(expiry))),
      maxDownloads: max,
      allowDownload,
      password: password === "" ? undefined : password,
      includeSubcollections: includeSub,
      followLatest,
    });
    if (!parsed.success) {
      setErrors(zodFieldErrors(parsed.error));
      return;
    }
    setErrors({});
    setBusy(true);
    const result = await createMediaShare({ data: parsed.data });
    setBusy(false);
    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    try {
      await navigator.clipboard.writeText(linkOf(result.token));
      toast.success("Link criado e copiado.");
    } catch {
      toast.success("Link criado. Copie na lista abaixo.");
    }
    setPassword("");
    await queryClient.invalidateQueries({ queryKey: QueryKey.Media.all() });
  }

  return (
    <FormDialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={`Compartilhar «${target.name}»`}
      icon={Share2}
      description="Quem tiver o link acessa sem entrar na Aura Creative. Você pode encerrar o link quando quiser."
      busy={busy}
      submitLabel="Criar link"
      submitIcon={Link2}
      cancelLabel="Fechar"
      onSubmit={submit}
      size="sm:max-w-xl"
    >
      <ShareList target={target} />
      <TextField
        id="share-label"
        label="Nome do link"
        required
        value={label}
        onValueChange={setLabel}
        maxLength={80}
        error={errors["label"]}
      />
      <TextAreaField
        id="share-message"
        label="Mensagem para quem receber"
        tip={{ label: "Ajuda sobre a mensagem", content: "Aparece no topo da página do link." }}
        value={message}
        onValueChange={setMessage}
        maxLength={500}
        rows={2}
        error={errors["message"]}
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <SelectField
          id="share-expiry"
          label="Validade"
          tip={{
            label: "Ajuda sobre a validade",
            content: "Depois dessa data o link para de abrir sozinho.",
          }}
          value={expiry}
          onValueChange={setExpiry}
          options={expiryOptions}
        />
        <NumberField
          id="share-max"
          label="Limite de downloads"
          hint="Quando o limite é atingido, o link deixa de permitir downloads. Deixe vazio para não limitar."
          value={maxDownloads}
          onValueChange={setMaxDownloads}
          placeholder="Sem limite"
          error={errors["maxDownloads"]}
        />
      </div>
      <PasswordField
        id="share-new-password"
        label="Senha (opcional)"
        hint="Pelo menos 8 caracteres. Quem abrir o link precisa digitar a senha. Depois de 5 erros, o acesso é bloqueado por 15 minutos."
        autoComplete="new-password"
        value={password}
        error={errors["password"]}
        onChange={(event) => setPassword(event.target.value)}
      />
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Checkbox
            id="share-download"
            checked={allowDownload}
            onCheckedChange={(checked) => setAllowDownload(checked === true)}
          />
          <Label htmlFor="share-download">Permitir download</Label>
          <InfoTip label="Ajuda sobre o download">
            Sem isso, quem recebe só consegue ver os arquivos.
          </InfoTip>
        </div>
        {isAsset ? (
          <div className="flex items-center gap-2">
            <Checkbox
              id="share-latest"
              checked={followLatest}
              onCheckedChange={(checked) => setFollowLatest(checked === true)}
            />
            <Label htmlFor="share-latest">Mostrar sempre a versão mais recente</Label>
            <InfoTip label="Ajuda sobre a versão">
              Se você enviar uma versão nova do arquivo, o link passa a mostrá-la.
            </InfoTip>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Checkbox
              id="share-sub"
              checked={includeSub}
              onCheckedChange={(checked) => setIncludeSub(checked === true)}
            />
            <Label htmlFor="share-sub">Incluir os arquivos das subpastas</Label>
          </div>
        )}
      </div>
    </FormDialog>
  );
}
