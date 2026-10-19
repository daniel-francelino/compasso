import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Download,
  Eye,
  FileText,
  FolderOpen,
  Lock,
  LockKeyhole,
  RotateCw,
  TriangleAlert,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { PasswordField } from "@/components/shared/admin/auth-shell";
import { EmptyState } from "@/components/shared/admin/empty-state";
import { SectionCard } from "@/components/shared/admin/section-card";
import { Button } from "@/components/shared/ui/button";
import { Skeleton } from "@/components/shared/ui/skeleton";
import { PublicShareState } from "@/lib/shared/enums";
import { formatBytes } from "@/lib/shared/format";
import { publicShareStateMessages } from "@/lib/shared/labels";
import {
  type SharedFile,
  getSharedFileUrl,
  openSharedMedia,
  unlockSharedMedia,
} from "@/lib/shared/media/public-share.functions";
import { QueryKey } from "@/lib/shared/query-keys";
import { unwrapResult } from "@/lib/shared/result-client";

function PasswordGate({
  token,
  onUnlocked,
}: {
  token: string;
  onUnlocked: (grant: string | null) => void;
}) {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function submit() {
    if (busy || password === "") return;
    setBusy(true);
    setMessage(null);
    const result = await unlockSharedMedia({ data: { token, password } });
    setBusy(false);
    if (!result.ok) {
      setMessage(result.message);
      return;
    }
    if (result.state === PublicShareState.Ok) {
      onUnlocked(result.grant);
      return;
    }
    const failure =
      result.state === PublicShareState.Locked
        ? PublicShareState.Locked
        : PublicShareState.WrongPassword;
    setMessage(publicShareStateMessages[failure].description);
  }

  return (
    <SectionCard
      as="form"
      title="Este link tem senha"
      icon={LockKeyhole}
      className="mx-auto w-full max-w-sm"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <PasswordField
        id="share-password"
        label="Senha"
        autoComplete="off"
        required
        value={password}
        error={message ?? undefined}
        onChange={(event) => setPassword(event.target.value)}
      />
      <Button type="submit" className="w-full" disabled={busy || password === ""}>
        <Lock aria-hidden="true" />
        {busy ? "Verificando…" : "Abrir"}
      </Button>
    </SectionCard>
  );
}

function FileCard({
  file,
  token,
  grant,
  allowDownload,
}: {
  file: SharedFile;
  token: string;
  grant: string | null;
  allowDownload: boolean;
}) {
  const [busy, setBusy] = useState(false);

  async function open(download: boolean) {
    if (busy) return;
    setBusy(true);
    const result = await getSharedFileUrl({
      data: { token, grant, assetId: file.assetId, download },
    });
    setBusy(false);
    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    if (result.url === null) {
      toast.error("Não foi possível abrir este arquivo agora.");
      return;
    }
    window.open(result.url, "_blank", "noopener,noreferrer");
  }

  return (
    <li className="flex flex-col overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex aspect-[4/3] items-center justify-center bg-muted">
        {file.previewUrl ? (
          <img
            src={file.previewUrl}
            alt={file.title}
            loading="lazy"
            className="size-full object-cover"
          />
        ) : (
          <FileText className="size-10 text-muted-foreground" aria-hidden="true" />
        )}
      </div>
      <div className="flex flex-1 flex-col gap-3 p-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium" title={file.title}>
            {file.title}
          </p>
          <p className="text-xs text-muted-foreground">{formatBytes(file.sizeBytes)}</p>
        </div>
        <div className="mt-auto flex flex-wrap gap-2">
          <Button size="sm" variant="outline" disabled={busy} onClick={() => void open(false)}>
            <Eye aria-hidden="true" />
            Ver
          </Button>
          {allowDownload ? (
            <Button size="sm" disabled={busy} onClick={() => void open(true)}>
              <Download aria-hidden="true" />
              Baixar
            </Button>
          ) : null}
        </div>
      </div>
    </li>
  );
}

export function PublicSharePage({ token }: { token: string }) {
  const queryClient = useQueryClient();
  const [grant, setGrant] = useState<string | null>(null);
  const query = useQuery({
    queryKey: QueryKey.Share.open(token, grant),
    queryFn: async () => unwrapResult(await openSharedMedia({ data: { token, grant } })),
    retry: false,
  });
  const view = query.data;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-5xl items-center px-4 py-4 sm:px-6">
          <p className="heading-card">Compasso</p>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl space-y-6 px-4 py-8 sm:px-6">
        {query.isPending ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Skeleton className="h-56 w-full" />
            <Skeleton className="h-56 w-full" />
            <Skeleton className="h-56 w-full" />
          </div>
        ) : null}
        {query.isError ? (
          <EmptyState
            icon={TriangleAlert}
            title="Não foi possível abrir o link"
            description="Tente de novo em instantes."
            action={
              <Button onClick={() => void query.refetch()}>
                <RotateCw aria-hidden="true" />
                Tentar novamente
              </Button>
            }
          />
        ) : null}
        {view?.state === PublicShareState.PasswordRequired ? (
          <PasswordGate
            token={token}
            onUnlocked={(next) => {
              setGrant(next);
              void queryClient.invalidateQueries({ queryKey: QueryKey.Share.all() });
            }}
          />
        ) : null}
        {view &&
        view.state !== PublicShareState.Ok &&
        view.state !== PublicShareState.PasswordRequired ? (
          <EmptyState
            icon={TriangleAlert}
            title={publicShareStateMessages[view.state].title}
            description={publicShareStateMessages[view.state].description}
          />
        ) : null}
        {view?.state === PublicShareState.Ok ? (
          <>
            <div className="space-y-1">
              <h1 className="heading-page">{view.label}</h1>
              {view.message ? (
                <p className="whitespace-pre-wrap text-muted-foreground">{view.message}</p>
              ) : null}
            </div>
            {view.files.length === 0 ? (
              <EmptyState
                icon={FolderOpen}
                title="Nenhum arquivo disponível"
                description="Esta pasta não tem arquivos para mostrar agora."
              />
            ) : (
              <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {view.files.map((file) => (
                  <FileCard
                    key={file.assetId}
                    file={file}
                    token={token}
                    grant={grant}
                    allowDownload={view.allowDownload}
                  />
                ))}
              </ul>
            )}
          </>
        ) : null}
      </main>
    </div>
  );
}
