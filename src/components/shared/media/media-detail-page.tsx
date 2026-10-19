import { useQuery } from "@tanstack/react-query";
import { ShareDialog } from "@/components/shared/media/share-dialog";
import { IconButton } from "@/components/shared/admin/icon-button";
import { useRouter } from "@tanstack/react-router";
import { Download, Replace, Trash2, Undo2, Save, Globe, RefreshCw, Share2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { FormError } from "@/components/shared/admin/auth-shell";
import { ConfirmDialog } from "@/components/shared/admin/confirm-dialog";
import { RecordUnavailable } from "@/components/shared/admin/record-unavailable";
import { EmptyState } from "@/components/shared/admin/empty-state";
import { TextField } from "@/components/shared/admin/form-fields";
import { TagInputField } from "@/components/shared/admin/tag-input-field";
import { PageHeader } from "@/components/shared/admin/page-header";
import { SectionCard } from "@/components/shared/admin/section-card";
import { PageSkeleton } from "@/components/shared/admin/skeletons";
import { StatusBadge } from "@/components/shared/admin/status-badge";
import { UploadDialog } from "@/components/shared/media/upload-dialog";
import { Button } from "@/components/shared/ui/button";
import { useFormSubmit } from "@/hooks/shared/use-form-submit";
import { useServerAction } from "@/hooks/shared/use-server-action";
import { useUnsavedChanges } from "@/hooks/shared/use-unsaved-changes";
import { Action } from "@/lib/shared/auth/actions";
import { can } from "@/lib/shared/auth/permissions";
import { useAuth } from "@/lib/shared/auth/use-auth";
import { formatBytes, formatDateTime } from "@/lib/shared/format";
import { ShareKind } from "@/lib/shared/enums";
import { MediaKind } from "@/lib/shared/media/limits";
import {
  type MediaDetail,
  deleteMediaPermanently,
  getMedia,
  replaceMediaVersion,
  trashMedia,
  updateMedia,
} from "@/lib/shared/media/media.functions";
import { publishMedia, withdrawMedia } from "@/lib/shared/media/publish.functions";
import { updateMediaSchema } from "@/lib/shared/media/schemas";
import { QueryKey } from "@/lib/shared/query-keys";
import { unwrapResult } from "@/lib/shared/result-client";
import { AppRoute } from "@/lib/shared/routes";

function Preview({ detail }: { detail: MediaDetail }) {
  if (detail.previewUrl === null) {
    return (
      <EmptyState
        title="Sem pré-visualização"
        description="Use o botão de baixar para abrir o arquivo."
      />
    );
  }
  if (detail.asset.kind === MediaKind.Image) {
    return (
      <img
        src={detail.previewUrl}
        alt={detail.asset.name}
        className="max-h-[32rem] w-full rounded-md object-contain"
      />
    );
  }
  if (detail.asset.kind === MediaKind.Video) {
    return (
      <video
        src={detail.previewUrl}
        controls
        preload="metadata"
        className="max-h-[32rem] w-full rounded-md"
      />
    );
  }
  return (
    <iframe
      title={detail.asset.name}
      src={detail.previewUrl}
      className="h-[32rem] w-full rounded-md border border-border"
    />
  );
}

function MetadataForm({ detail, canEdit }: { detail: MediaDetail; canEdit: boolean }) {
  const { formRef, errors, error, busy, submit } = useFormSubmit();
  const { run } = useServerAction();
  const [name, setName] = useState(detail.asset.name);
  const [tags, setTags] = useState<string[]>(detail.asset.tags);
  const dirty = name !== detail.asset.name || tags.join("|") !== detail.asset.tags.join("|");
  useUnsavedChanges(dirty && !busy);

  return (
    <SectionCard
      as="form"
      ref={formRef}
      noValidate
      title="Dados do arquivo"
      onSubmit={(event) => {
        event.preventDefault();
        void submit(
          updateMediaSchema,
          {
            id: detail.asset.id,
            displayName: name,
            tags,
            expectedVersion: detail.asset.version,
          },
          (data) => run(() => updateMedia({ data }), { invalidate: [QueryKey.Media.all()] }),
          () => {
            toast.success("Dados salvos.");
          },
        );
      }}
    >
      <TextField
        id="media-name"
        label="Nome"
        required
        value={name}
        onValueChange={setName}
        maxLength={200}
        disabled={!canEdit}
        error={errors["displayName"]}
      />
      <TagInputField
        id="media-tags"
        label="Etiquetas"
        value={tags}
        onValueChange={setTags}
        maxItems={20}
        maxLength={40}
        disabled={!canEdit}
        error={errors["tags"]}
      />
      <FormError message={error} />
      {canEdit ? (
        <Button type="submit" loading={busy} disabled={busy || !dirty}>
          <Save aria-hidden="true" />
          Salvar
        </Button>
      ) : null}
    </SectionCard>
  );
}

export function MediaDetailPage({ assetId }: { assetId: string }) {
  const auth = useAuth();
  const router = useRouter();
  const { run, busy } = useServerAction();
  const [replacing, setReplacing] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [trashing, setTrashing] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const query = useQuery({
    queryKey: QueryKey.Media.detail(assetId),
    queryFn: async () => unwrapResult(await getMedia({ data: { id: assetId } })),
  });

  if (query.isPending) return <PageSkeleton />;
  if (query.isError) {
    return (
      <RecordUnavailable
        title="Arquivo não encontrado"
        message="Ele não existe ou você não tem acesso."
        backTo={AppRoute.Library}
        backLabel="Voltar para a biblioteca"
      />
    );
  }

  const detail = query.data;
  const canUpdate = can(auth, Action.Media.Update);
  const canDelete = can(auth, Action.Media.Delete);
  const canPublish = can(auth, Action.Media.Publish);
  const invalidate = [QueryKey.Media.all()];
  const refresh = () => query.refetch();
  const scope = detail.asset.scope;

  return (
    <div className="space-y-6">
      <PageHeader
        title={detail.asset.name}
        description={`${detail.asset.brandName ?? "Site"} · ${formatBytes(detail.asset.sizeBytes)}`}
        breadcrumbs={[
          { label: "Biblioteca de Mídia", to: AppRoute.Library },
          { label: detail.asset.name },
        ]}
        actions={
          <>
            {detail.downloadUrl ? (
              <Button asChild variant="outline">
                <a href={detail.downloadUrl}>
                  <Download aria-hidden="true" /> Baixar original
                </a>
              </Button>
            ) : null}
            {can(auth, Action.Media.Share) && !detail.asset.trashed ? (
              <IconButton
                variant="outline"
                label="Compartilhar"
                icon={Share2}
                onClick={() => setSharing(true)}
              />
            ) : null}
            {canUpdate && can(auth, Action.Media.Upload) && !detail.asset.trashed ? (
              <IconButton
                variant="outline"
                label="Nova versão"
                icon={Replace}
                onClick={() => setReplacing(true)}
              />
            ) : null}
            {canDelete ? (
              <IconButton
                variant="outline"
                destructive={!detail.asset.trashed}
                label={detail.asset.trashed ? "Restaurar da lixeira" : "Mover para a lixeira"}
                icon={detail.asset.trashed ? Undo2 : Trash2}
                onClick={() => setTrashing(true)}
              />
            ) : null}
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <SectionCard as="div" title="Pré-visualização">
          <Preview detail={detail} />
        </SectionCard>
        <div className="space-y-4">
          <MetadataForm key={detail.asset.version} detail={detail} canEdit={canUpdate} />
          <SectionCard as="div" title="Onde é usado">
            <p className="text-sm">
              {detail.usageCount === 0
                ? "Ainda não é usado em nenhum lugar."
                : `Usado em ${detail.usageCount} ${detail.usageCount === 1 ? "lugar" : "lugares"}.`}
            </p>
          </SectionCard>
        </div>
      </div>

      <SectionCard as="div" title="Versões">
        <ul className="divide-y divide-border">
          {detail.versions.map((version) => (
            <li
              key={version.id}
              className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm"
            >
              <span>
                Versão {version.versionNo} · {version.filename} · {formatBytes(version.sizeBytes)} ·{" "}
                {formatDateTime(version.createdAt)}
              </span>
              <span className="flex items-center gap-2">
                {version.current ? (
                  <StatusBadge tone="success" icon={Download}>
                    Atual
                  </StatusBadge>
                ) : null}
                {version.published ? (
                  <StatusBadge tone="info" icon={Download}>
                    Publicada no site
                  </StatusBadge>
                ) : null}
                {detail.asset.kind === MediaKind.Image &&
                canPublish &&
                version.status === "available" ? (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() =>
                      void run(
                        () =>
                          version.published
                            ? withdrawMedia({ data: { versionId: version.id } })
                            : publishMedia({ data: { versionId: version.id } }),
                        {
                          success: version.published
                            ? "A imagem saiu do espaço público."
                            : "A imagem foi publicada para o site.",
                          invalidate,
                        },
                      ).then(refresh)
                    }
                  >
                    <Globe aria-hidden="true" />
                    {version.published ? "Retirar do site" : "Publicar para o site"}
                  </Button>
                ) : null}
                {!version.current && canUpdate && version.status === "available" ? (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() =>
                      void run(
                        () =>
                          replaceMediaVersion({
                            data: { assetId: detail.asset.id, versionId: version.id },
                          }),
                        {
                          success: "Esta passou a ser a versão atual.",
                          invalidate,
                        },
                      ).then(refresh)
                    }
                  >
                    <RefreshCw aria-hidden="true" />
                    Usar esta versão
                  </Button>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
        <p className="text-xs text-muted-foreground">
          Conteúdos já criados continuam apontando para a versão que usavam.
        </p>
      </SectionCard>

      {detail.asset.trashed && canDelete ? (
        <SectionCard as="div" title="Excluir para sempre">
          <p className="text-sm text-muted-foreground">
            Só é possível se o arquivo não for usado em nenhum lugar nem estiver publicado.
          </p>
          <Button variant="outline" className="text-destructive" onClick={() => setDeleting(true)}>
            <Trash2 aria-hidden="true" /> Excluir definitivamente
          </Button>
        </SectionCard>
      ) : null}

      {replacing ? (
        <UploadDialog
          open
          single
          title="Enviar nova versão"
          scope={scope}
          brandId={detail.asset.brandId ?? undefined}
          assetId={detail.asset.id}
          onOpenChange={(open) => !open && setReplacing(false)}
          onFinished={() => void refresh()}
        />
      ) : null}

      <ShareDialog
        target={
          sharing ? { kind: ShareKind.Asset, id: detail.asset.id, name: detail.asset.name } : null
        }
        onClose={() => setSharing(false)}
      />

      <ConfirmDialog
        open={trashing}
        onOpenChange={setTrashing}
        title={detail.asset.trashed ? "Restaurar arquivo" : "Mover para a lixeira"}
        description={
          detail.asset.trashed
            ? "O arquivo volta para as seleções."
            : "O arquivo sai das novas seleções, mas continua onde já é usado."
        }
        confirmLabel={detail.asset.trashed ? "Restaurar" : "Mover para a lixeira"}
        busy={busy}
        onConfirm={async () => {
          const result = await run(
            () => trashMedia({ data: { id: detail.asset.id, trashed: !detail.asset.trashed } }),
            {
              success: detail.asset.trashed
                ? "Arquivo restaurado."
                : "Arquivo movido para a lixeira.",
              invalidate,
            },
          );
          if (result.ok) await refresh();
          return result.ok;
        }}
      />
      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        title="Excluir definitivamente"
        description="Todas as versões e cópias são apagadas do armazenamento. Esta ação não pode ser desfeita."
        confirmLabel="Excluir definitivamente"
        destructive
        busy={busy}
        onConfirm={async () => {
          const result = await run(
            () => deleteMediaPermanently({ data: { id: detail.asset.id } }),
            {
              success: "Arquivo excluído.",
              invalidate,
            },
          );
          if (result.ok) await router.navigate({ to: AppRoute.Library });
          return result.ok;
        }}
      />
    </div>
  );
}
