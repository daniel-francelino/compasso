import { Ban, TriangleAlert } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/shared/ui/alert";
import type { ContentDetail } from "@/lib/marketing/content/types";
import { EditorialStatus } from "@/lib/shared/enums";

export function ContentBanners({ content }: { content: ContentDetail }) {
  const overdue = content.channels.some(
    (channel) =>
      channel.plannedAt !== null &&
      new Date(channel.plannedAt).getTime() < Date.now() &&
      channel.published === null &&
      (content.editorialStatus === EditorialStatus.Approved ||
        content.editorialStatus === EditorialStatus.AwaitingApproval),
  );
  return (
    <div className="space-y-3">
      {content.cancelled ? (
        <Alert>
          <Ban aria-hidden="true" />
          <AlertTitle>Este conteúdo foi cancelado</AlertTitle>
          <AlertDescription>
            O histórico foi mantido, mas ele não pode mais ser editado.
          </AlertDescription>
        </Alert>
      ) : null}
      {content.editorialStatus === EditorialStatus.Approved ? (
        <Alert>
          <AlertTitle>Versão aprovada</AlertTitle>
          <AlertDescription>
            Para mudar texto, arquivos, canais ou datas, reabra o conteúdo. Isso exige uma nova
            aprovação.
          </AlertDescription>
        </Alert>
      ) : null}
      {content.editorialStatus === EditorialStatus.Published ? (
        <Alert>
          <AlertTitle>Conteúdo publicado</AlertTitle>
          <AlertDescription>
            Os originais e os arquivos do planejamento foram apagados. Ficam só as prévias do que
            foi publicado.
          </AlertDescription>
        </Alert>
      ) : null}
      {content.hasUnsentChanges && content.editorialStatus === EditorialStatus.AwaitingApproval ? (
        <Alert>
          <TriangleAlert aria-hidden="true" />
          <AlertTitle>Há alterações que o cliente ainda não viu</AlertTitle>
          <AlertDescription>
            O aprovador vê a versão {content.nextRevisionNo - 1}. Envie uma nova versão para que ele
            veja as mudanças.
          </AlertDescription>
        </Alert>
      ) : null}
      {overdue ? (
        <Alert>
          <TriangleAlert aria-hidden="true" />
          <AlertTitle>Data prevista ultrapassada — replanejar</AlertTitle>
          <AlertDescription>
            Uma data prevista já passou sem a publicação ser registrada. Reabra o conteúdo para
            replanejar ou registre a publicação.
          </AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}
