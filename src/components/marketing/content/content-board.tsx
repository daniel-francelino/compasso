import {
  DragDropProvider,
  type DragEndEvent,
  DragOverlay,
  type DragStartEvent,
  useDraggable,
  useDroppable,
} from "@dnd-kit/react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { CalendarClock, GripVertical, RotateCw, TriangleAlert } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { EmptyState } from "@/components/shared/admin/empty-state";
import { InfoTip } from "@/components/shared/admin/info-tip";
import { ChannelLogos } from "@/components/marketing/content/channel-logos";
import { SectionCard } from "@/components/shared/admin/section-card";
import { EditorialStatusBadge } from "@/components/shared/content/status-badges";
import { Button } from "@/components/shared/ui/button";
import { Badge } from "@/components/shared/ui/badge";
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
import { cn } from "@/lib/shared/utils";

type BoardFilters = { search: string; brandId?: string; channelId?: string; ownerId?: string };

const REFUSED: Partial<Record<EditorialStatus, string>> = {
  [EditorialStatus.AwaitingApproval]:
    "Para enviar à aprovação, abra o conteúdo e use “Enviar para aprovação”.",
  [EditorialStatus.Approved]: "A aprovação é decidida pelo cliente no portal.",
  [EditorialStatus.Published]:
    "Para marcar como publicado, abra o conteúdo e use “Marcar como publicado”.",
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

const canMoveTo = (card: BoardCard | null, to: EditorialStatus): boolean =>
  card !== null && DirectMoves[card.editorialStatus].includes(to);

function CardBody({ card, onOpen }: { card: BoardCard; onOpen?: (id: string) => void }) {
  const planned = nextPlanned(card);
  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={onOpen ? () => onOpen(card.id) : undefined}
        className="block w-full text-left font-medium leading-snug text-primary underline-offset-4 hover:underline"
      >
        {card.title}
      </button>
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
    </div>
  );
}

function DraggableCard({
  card,
  disabled,
  onOpen,
}: {
  card: BoardCard;
  disabled: boolean;
  onOpen: (id: string) => void;
}) {
  const { ref, isDragSource } = useDraggable({ id: card.id, disabled });
  return (
    <li ref={ref} aria-roledescription="item arrastável">
      <SectionCard
        padding="xs"
        className={cn(
          "relative shadow-sm transition-shadow hover:shadow-md",
          !disabled && "cursor-grab touch-manipulation active:cursor-grabbing",
          isDragSource && "opacity-40",
        )}
      >
        {disabled ? null : (
          <GripVertical
            className="absolute right-1.5 top-2 size-4 text-muted-foreground"
            aria-hidden="true"
          />
        )}
        <CardBody card={card} onOpen={onOpen} />
      </SectionCard>
    </li>
  );
}

function Column({
  column,
  dragging,
  movable,
  onOpen,
}: {
  column: BoardColumn;
  dragging: BoardCard | null;
  movable: boolean;
  onOpen: (id: string) => void;
}) {
  const { ref, isDropTarget } = useDroppable({ id: column.status });
  const accepting = canMoveTo(dragging, column.status);
  return (
    <SectionCard
      as="section"
      aria-labelledby={`board-${column.status}`}
      padding="xs"
      className={cn(
        "flex max-h-[calc(100dvh-18rem)] min-h-64 w-[min(84vw,19rem)] shrink-0 snap-start flex-col gap-3 bg-muted/70 transition-shadow",
        accepting && "ring-2 ring-primary/30",
        accepting && isDropTarget && "ring-primary bg-primary/5",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <h2 id={`board-${column.status}`} className="min-w-0">
          <EditorialStatusBadge status={column.status} />
        </h2>
        <Badge variant="secondary" aria-label={`${column.total} conteúdos`}>
          {column.total}
        </Badge>
      </div>
      <div ref={ref} className="flex min-h-0 flex-1 flex-col">
        {column.cards.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border bg-card/60 px-3 py-4 text-center text-xs text-muted-foreground">
            {REFUSED[column.status] ?? "Nada por aqui."}
          </p>
        ) : (
          <ul className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain pr-1">
            {column.cards.map((card) => (
              <DraggableCard
                key={card.id}
                card={card}
                disabled={!movable || DirectMoves[card.editorialStatus].length === 0}
                onOpen={onOpen}
              />
            ))}
          </ul>
        )}
      </div>
      {column.total > column.cards.length ? (
        <p className="border-t border-border/70 pt-2 text-xs text-muted-foreground">
          Mostrando {column.cards.length} de {column.total}. Use a lista com o filtro de estado para
          ver todos.
        </p>
      ) : null}
    </SectionCard>
  );
}

export function ContentBoard({
  filters,
  onOpen,
}: {
  filters: BoardFilters;
  onOpen: (id: string) => void;
}) {
  const auth = useAuth();
  const { run } = useServerAction();
  const [dragging, setDragging] = useState<BoardCard | null>(null);
  const query = useQuery({
    queryKey: QueryKey.Content.board(filters),
    queryFn: async () => unwrapResult(await listBoard({ data: filters })).columns,
    placeholderData: keepPreviousData,
  });

  const cards = (query.data ?? []).flatMap((column) => column.cards);
  const cardById = (id: unknown) => cards.find((card) => card.id === String(id)) ?? null;

  async function move(card: BoardCard, to: EditorialStatus) {
    const result = await run(
      () => moveContent({ data: { id: card.id, to, expectedVersion: card.version } }),
      { invalidate: [QueryKey.Content.all(), QueryKey.Dashboard.all()] },
    );
    if (result.ok) toast.success(`Movido para “${editorialStatusLabels[to]}”.`);
  }

  function handleDragStart(event: DragStartEvent) {
    setDragging(cardById(event.operation.source?.id));
  }

  function handleDragEnd(event: DragEndEvent) {
    const card = cardById(event.operation.source?.id);
    const target = (query.data ?? []).find(
      (column) => column.status === event.operation.target?.id,
    );
    setDragging(null);
    if (event.canceled || card === null || target === undefined) return;
    if (target.status === card.editorialStatus) return;
    if (!canMoveTo(card, target.status)) {
      toast.error(
        REFUSED[target.status] ??
          `Não é possível mover para “${editorialStatusLabels[target.status]}” a partir deste estado.`,
      );
      return;
    }
    void move(card, target.status);
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
    <DragDropProvider onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div
        className="flex snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain pb-3"
        role="group"
        aria-label="Quadro de conteúdos"
      >
        {query.data.map((column) => (
          <Column
            key={column.status}
            column={column}
            dragging={dragging}
            movable={can(auth, Action.Content.Update)}
            onOpen={onOpen}
          />
        ))}
      </div>
      <DragOverlay>
        {dragging ? (
          <SectionCard padding="xs" className="w-[17rem] rotate-2 cursor-grabbing shadow-lg">
            <CardBody card={dragging} />
          </SectionCard>
        ) : null}
      </DragOverlay>
    </DragDropProvider>
  );
}
