import { Plug, PlugZap, RefreshCw } from "lucide-react";
import { useState } from "react";
import { ConfirmDialog } from "@/components/shared/admin/confirm-dialog";
import { ConnectionBadge } from "@/components/marketing/channels/connection-badge";
import { Button } from "@/components/shared/ui/button";
import { Label } from "@/components/shared/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/shared/ui/sheet";
import { Switch } from "@/components/shared/ui/switch";
import { useServerAction } from "@/hooks/shared/use-server-action";
import type { ChannelRow } from "@/lib/marketing/channels/channels.functions";
import type { ChannelConnection } from "@/lib/marketing/channels/connection-schemas";
import {
  disconnectChannel,
  saveConnectionSettings,
  startInstagramConnection,
} from "@/lib/marketing/channels/connection.functions";
import { dbErrorMessage } from "@/lib/shared/auth/errors";
import { ConnectionStatus } from "@/lib/shared/enums";
import { formatDateTime, formatNumber } from "@/lib/shared/format";
import { testChannelConnection } from "@/lib/shared/jobs/connection-test.functions";
import { QueryKey } from "@/lib/shared/query-keys";
import { INSTAGRAM_SCOPES, instagramScopeLabels } from "@/lib/shared/social/scopes";

const needsReconnect = (status: ConnectionStatus): boolean =>
  status === ConnectionStatus.Expired || status === ConnectionStatus.Revoked;

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium text-foreground">{children}</dd>
    </div>
  );
}

export function ChannelConnectionSheet({
  brandId,
  channel,
  connection,
  canConnect,
  onClose,
}: {
  brandId: string;
  channel: ChannelRow;
  connection: ChannelConnection | undefined;
  canConnect: boolean;
  onClose: () => void;
}) {
  const { run, busy } = useServerAction();
  const [disconnecting, setDisconnecting] = useState(false);
  const invalidate = [QueryKey.Channels.connections(brandId)];

  const connect = async () => {
    const result = await run(() => startInstagramConnection({ data: { channelId: channel.id } }));
    if (result.ok) window.location.assign(result.url);
  };

  const test = () =>
    run(() => testChannelConnection({ data: { brandId, channelId: channel.id } }), {
      success: "A conexão está funcionando.",
      invalidate,
    });

  const toggle = (patch: { autoPublishDefault?: boolean; collectMetrics?: boolean }) => {
    if (connection === undefined) return;
    void run(
      () =>
        saveConnectionSettings({
          data: {
            channelId: channel.id,
            autoPublishDefault: patch.autoPublishDefault ?? connection.autoPublishDefault,
            collectMetrics: patch.collectMetrics ?? connection.collectMetrics,
            expectedVersion: connection.version,
          },
        }),
      { success: "Configuração salva.", invalidate },
    );
  };

  const missingScopes = connection
    ? INSTAGRAM_SCOPES.filter((scope) => !connection.scopes.includes(scope))
    : [];

  return (
    <Sheet open onOpenChange={(next) => !next && !busy && onClose()}>
      <SheetContent className="flex w-full flex-col gap-0 overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>Conexão com o Instagram</SheetTitle>
          <SheetDescription>
            {channel.profileName}. Conectar permite publicar no horário planejado e acompanhar os
            resultados da conta.
          </SheetDescription>
        </SheetHeader>
        <div className="mt-6 space-y-6">
          {connection === undefined ? (
            <div className="space-y-3 rounded-xl border border-dashed border-border p-4">
              <p className="text-sm text-muted-foreground">
                Este canal ainda não está conectado. Quem for conectar entra na conta do Instagram e
                autoriza o Compasso uma única vez. A conta precisa ser profissional (comercial ou
                criador de conteúdo).
              </p>
              {canConnect ? (
                <Button onClick={() => void connect()} loading={busy}>
                  <Plug aria-hidden="true" />
                  Conectar ao Instagram
                </Button>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Peça a uma pessoa com permissão para conectar este canal.
                </p>
              )}
            </div>
          ) : (
            <>
              <section aria-labelledby="connection-account" className="space-y-1">
                <h3 id="connection-account" className="text-sm font-semibold text-foreground">
                  Conta
                </h3>
                <dl className="divide-y divide-border">
                  <Row label="Perfil">@{connection.username}</Row>
                  {connection.displayName ? <Row label="Nome">{connection.displayName}</Row> : null}
                  {connection.accountType ? <Row label="Tipo">{connection.accountType}</Row> : null}
                  {connection.followersCount !== null ? (
                    <Row label="Seguidores">{formatNumber(connection.followersCount)}</Row>
                  ) : null}
                </dl>
              </section>

              <section aria-labelledby="connection-state" className="space-y-1">
                <h3 id="connection-state" className="text-sm font-semibold text-foreground">
                  Conexão
                </h3>
                <dl className="divide-y divide-border">
                  <Row label="Situação">
                    <ConnectionBadge status={connection.status} />
                  </Row>
                  <Row label="Conectado em">{formatDateTime(connection.connectedAt)}</Row>
                  <Row label="Acesso válido até">{formatDateTime(connection.tokenExpiresAt)}</Row>
                  {connection.lastErrorCode ? (
                    <Row label="Último problema">
                      {dbErrorMessage({ message: connection.lastErrorCode })}
                    </Row>
                  ) : null}
                  <Row label="Permissões">
                    {INSTAGRAM_SCOPES.map((scope) => (
                      <span key={scope} className="block">
                        {instagramScopeLabels[scope]}:{" "}
                        {connection.scopes.includes(scope) ? "sim" : "não"}
                      </span>
                    ))}
                  </Row>
                </dl>
                {missingScopes.length > 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Faltam permissões. Reconecte o canal para liberar tudo.
                  </p>
                ) : null}
                {canConnect ? (
                  <div className="flex flex-wrap gap-2 pt-2">
                    <Button variant="outline" onClick={() => void test()} disabled={busy}>
                      <RefreshCw aria-hidden="true" />
                      Testar conexão
                    </Button>
                    <Button
                      variant={needsReconnect(connection.status) ? "default" : "outline"}
                      onClick={() => void connect()}
                      disabled={busy}
                    >
                      <Plug aria-hidden="true" />
                      Reconectar
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setDisconnecting(true)}
                      disabled={busy}
                    >
                      <PlugZap aria-hidden="true" />
                      Desconectar
                    </Button>
                  </div>
                ) : null}
              </section>

              <section aria-labelledby="connection-settings" className="space-y-3">
                <h3 id="connection-settings" className="text-sm font-semibold text-foreground">
                  Configuração
                </h3>
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-0.5">
                    <Label htmlFor="auto-publish-default">Publicar automaticamente</Label>
                    <p className="text-sm text-muted-foreground">
                      Novos conteúdos deste canal já nascem para publicar sozinhos no horário
                      planejado, depois de aprovados.
                    </p>
                  </div>
                  <Switch
                    id="auto-publish-default"
                    checked={connection.autoPublishDefault}
                    disabled={!canConnect || busy}
                    onCheckedChange={(checked) => toggle({ autoPublishDefault: checked })}
                  />
                </div>
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-0.5">
                    <Label htmlFor="collect-metrics">Coletar métricas</Label>
                    <p className="text-sm text-muted-foreground">
                      Guarda o histórico de seguidores, alcance e resultados dos posts para os
                      relatórios.
                      {connection.lastMetricsAt
                        ? ` Última coleta: ${formatDateTime(connection.lastMetricsAt)}.`
                        : " Ainda não houve coleta."}
                    </p>
                  </div>
                  <Switch
                    id="collect-metrics"
                    checked={connection.collectMetrics}
                    disabled={!canConnect || busy}
                    onCheckedChange={(checked) => toggle({ collectMetrics: checked })}
                  />
                </div>
              </section>
            </>
          )}
        </div>
        <ConfirmDialog
          open={disconnecting}
          onOpenChange={setDisconnecting}
          title="Desconectar o Instagram"
          description="Os conteúdos que iam sair sozinhos voltam para a publicação manual e a coleta de métricas para. O histórico já guardado continua. Para voltar, é preciso conectar de novo."
          confirmLabel="Desconectar"
          destructive
          busy={busy}
          onConfirm={async () => {
            const result = await run(() => disconnectChannel({ data: { channelId: channel.id } }), {
              success: "Canal desconectado.",
              invalidate,
            });
            return result.ok;
          }}
        />
      </SheetContent>
    </Sheet>
  );
}
