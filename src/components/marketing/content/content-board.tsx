import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ArrowRightLeft, CalendarClock, TriangleAlert, RotateCw } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/shared/admin/empty-state";
import { InfoTip } from "@/components/shared/admin/info-tip";
import { ChannelLogos } from "@/components/marketing/content/channel-logos";
import { SectionCard } from "@/components/shared/admin/section-card";
import { EditorialStatusBadge } from "@/components/shared/content/status-badges";
import { Button } from "@/components/shared/ui/button";
import { Badge } from "@/components/shared/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/shared/ui/dropdown-menu";
import { Skeleton } from "@/components/shared/ui/skeleton";
import { useServerAction } from "@/hooks/shared/use-server-action";
import {
  type BoardCard,
  type BoardColumn,
  listBoard,
} from "@/lib/marketing/content/content.functions";
import { moveContent } from "@/lib/marketing/content/workflow.functions";
import { Action } from "@/lib/shared/auth/actions";
import { can } from "@/lib/shared/auth/permissions";
import { useAuth } from "@/lib/shared/auth/use-auth";
import { DirectMoves } from "@/lib/shared/editorial/editorial";
import { EditorialStatus } from "@/lib/shared/enums";
import { formatInZone } from "@/lib/shared/format";
import { contentFormatLabels, editorialStatusLabels } from "@/lib/shared/labels";
import { QueryKey } from "@/lib/shared/query-keys";
import { unwrapResult } from "@/lib/shared/result-client";

type BoardFilters = { search: string; brandId?: string; channelId?: string; ownerId?: string };

const REFUSED: Partial<Record<EditorialStatus, string>> = {
  [EditorialStatus.AwaitingApproval]:
    "Para enviar à aprovação, abra o conteúdo e use “Enviar para aprovação”.",
  [EditorialStatus.Approved]: "A aprovação é decidida pelo cliente no portal.",
  [EditorialStatus.ChangesRequested]: "Este estado é definido pelo pedido do cliente.",
  [EditorialStatus.Cancelled]: "Para cancelar, abra o conteúdo e use “Cancelar”.",
};

const nextPlanned = (card: BoardCard): { at: string; timeZone: string } | null => {
  const planned = card.channels
    .filter((channel) => channel.plannedAt !== null && channel.plannedTimezone !== null)
    .sort((a, b) => (a.plannedAt ?? "").localeCompare(b.plannedAt ?? ""))[0];
  return planned?.plannedAt && planned.plannedTimezone
    ? { at: planned.plannedAt, timeZone: planned.plannedTimezone }
    : null;
};

function Card({
  card,
  onMove,
  busy,
}: {
  card: BoardCard;
  onMove: (to: EditorialStatus) => void;
  busy: boolean;
}) {
  const auth = useAuth();
  const targets = DirectMoves[card.editorialStatus];
  const movable = can(auth, Action.Content.Update) && targets.length > 0;
  const planned = nextPlanned(card);
  return (
    <SectionCard
      as="li"
      padding="xs"
      className="space-y-3 shadow-sm transition-shadow hover:shadow-md"
    >
      <Link
        to="/admin/marketing/content/$itemId"
        params={{ itemId: card.id }}
        className="block font-medium leading-snug text-primary underline-offset-4 hover:underline"
      >
        {card.title}
      </Link>
      <div className="flex flex-wrap items-center gap-1.5">
        <ChannelLogos channels={card.channels} />
        {[...new Set(card.channels.map((channel) => channel.format))].map((format) => (
          <Badge key={format} variant="secondary" className="font-normal">
            {contentFormatLabels[format]}
          </Badge>
        ))}
      </div>
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <CalendarClock className="size-3.5 shrink-0" aria-hidden="true" />
        {planned ? (
          <>
            {formatInZone(planned.at, planned.timeZone)}
            <InfoTip label={`Fuso horário: ${planned.timeZone}`}>
              Fuso horário: {planned.timeZone}
            </InfoTip>
          </>
        ) : (
          "Sem data prevista"
        )}
      </p>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy || !movable}
            aria-label={`Mover ${card.title} para outro estado`}
          >
            <ArrowRightLeft aria-hidden="true" />
            Mover para…
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuLabel>Estados permitidos</DropdownMenuLabel>
          {targets.map((target) => (
            <DropdownMenuItem key={target} onSelect={() => onMove(target)}>
              {editorialStatusLabels[target]}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuLabel className="max-w-56 whitespace-normal text-xs font-normal text-muted-foreground">
            Aprovar, pedir alterações, enviar à aprovação e cancelar são feitos dentro do conteúdo.
          </DropdownMenuLabel>
        </DropdownMenuContent>
      </DropdownMenu>
    </SectionCard>
  );
}

function Column({
  column,
  onMove,
  busy,
}: {
  column: BoardColumn;
  onMove: (card: BoardCard, to: EditorialStatus) => void;
  busy: boolean;
}) {
  return (
    <SectionCard
      as="section"
      aria-labelledby={`board-${column.status}`}
      padding="xs"
      className="flex max-h-[calc(100dvh-18rem)] min-h-64 w-[min(84vw,19rem)] shrink-0 snap-start flex-col gap-3 bg-muted/70"
    >
      <div className="flex items-center justify-between gap-2">
        <h2 id={`board-${column.status}`} className="min-w-0">
          <EditorialStatusBadge status={column.status} />
        </h2>
        <Badge variant="secondary" aria-label={`${column.total} conteúdos`}>
          {column.total}
        </Badge>
      </div>
      {column.cards.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border bg-card/60 px-3 py-4 text-center text-xs text-muted-foreground">
          {REFUSED[column.status] ?? "Nada por aqui."}
        </p>
      ) : (
        <ul className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain pr-1">
          {column.cards.map((card) => (
            <Card key={card.id} card={card} busy={busy} onMove={(to) => onMove(card, to)} />
          ))}
        </ul>
      )}
      {column.total > column.cards.length ? (
        <p className="border-t border-border/70 pt-2 text-xs text-muted-foreground">
          Mostrando {column.cards.length} de {column.total}. Use a lista com o filtro de estado para
          ver todos.
        </p>
      ) : null}
    </SectionCard>
  );
}

export function ContentBoard({ filters }: { filters: BoardFilters }) {
  const { run, busy } = useServerAction();
  const query = useQuery({
    queryKey: QueryKey.Content.board(filters),
    queryFn: async () => unwrapResult(await listBoard({ data: filters })).columns,
    placeholderData: keepPreviousData,
  });

  async function move(card: BoardCard, to: EditorialStatus) {
    const result = await run(
      () => moveContent({ data: { id: card.id, to, expectedVersion: card.version } }),
      { invalidate: [QueryKey.Content.all(), QueryKey.Dashboard.all()] },
    );
    if (result.ok) toast.success(`Movido para “${editorialStatusLabels[to]}”.`);
  }

  if (query.isPending) {
    return (
      <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-3" aria-busy="true">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton
            key={index}
            className="h-72 w-[min(84vw,19rem)] shrink-0 snap-start rounded-2xl"
          />
        ))}
      </div>
    );
  }
  if (query.isError) {
    return (
      <SectionCard>
        <EmptyState
          icon={TriangleAlert}
          title="Não foi possível carregar o quadro"
          description={query.error.message}
          action={
            <Button onClick={() => void query.refetch()}>
              <RotateCw aria-hidden="true" />
              Tentar novamente
            </Button>
          }
        />
      </SectionCard>
    );
  }
  return (
    <div
      className="flex snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain pb-3"
      role="group"
      aria-label="Quadro de conteúdos"
    >
      {query.data.map((column) => (
        <Column
          key={column.status}
          column={column}
          busy={busy}
          onMove={(card, to) => void move(card, to)}
        />
      ))}
    </div>
  );
}
