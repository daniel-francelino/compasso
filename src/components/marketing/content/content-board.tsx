import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ArrowRightLeft, TriangleAlert, RotateCw } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/shared/admin/empty-state";
import { SectionCard } from "@/components/shared/admin/section-card";
import { Button } from "@/components/shared/ui/button";
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
import { moveVariant } from "@/lib/marketing/content/variants.functions";
import { Action } from "@/lib/shared/auth/actions";
import { can } from "@/lib/shared/auth/permissions";
import { useAuth } from "@/lib/shared/auth/use-auth";
import { DirectMoves } from "@/lib/shared/editorial/editorial";
import { EditorialStatus } from "@/lib/shared/enums";
import { formatInZone } from "@/lib/shared/format";
import { editorialStatusLabels, platformLabels } from "@/lib/shared/labels";
import { QueryKey } from "@/lib/shared/query-keys";
import { unwrapResult } from "@/lib/shared/result-client";

type BoardFilters = { search: string; brandId?: string; channelId?: string; ownerId?: string };

const REFUSED: Partial<Record<EditorialStatus, string>> = {
  [EditorialStatus.AwaitingApproval]:
    "Para enviar à aprovação, abra a variante e use “Enviar para aprovação”.",
  [EditorialStatus.Approved]: "A aprovação é decidida pelo cliente no portal.",
  [EditorialStatus.ChangesRequested]: "Este estado é definido pelo pedido do cliente.",
  [EditorialStatus.Cancelled]: "Para cancelar, abra a variante e use “Cancelar”.",
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
  return (
    <li className="space-y-2 rounded-xl border border-border bg-card p-3">
      <Link
        to="/admin/marketing/variants/$variantId"
        params={{ variantId: card.id }}
        className="block font-medium text-primary underline-offset-4 hover:underline"
      >
        {card.title}
      </Link>
      <p className="text-xs text-muted-foreground">
        {card.brandName} · {platformLabels[card.platform]} ({card.profileName})
      </p>
      <p className="text-xs text-muted-foreground">
        {card.plannedAt !== null && card.plannedTimezone !== null
          ? formatInZone(card.plannedAt, card.plannedTimezone)
          : "Sem data prevista"}
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
            Aprovar, pedir alterações, enviar à aprovação e cancelar são feitos dentro da variante.
          </DropdownMenuLabel>
        </DropdownMenuContent>
      </DropdownMenu>
    </li>
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
    <section
      aria-labelledby={`board-${column.status}`}
      className="flex w-72 shrink-0 flex-col gap-3 rounded-2xl bg-muted p-3"
    >
      <h2
        id={`board-${column.status}`}
        className="flex items-center justify-between text-sm font-medium"
      >
        {editorialStatusLabels[column.status]}
        <span className="text-muted-foreground">{column.total}</span>
      </h2>
      {column.cards.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          {REFUSED[column.status] ?? "Nada por aqui."}
        </p>
      ) : (
        <ul className="space-y-2">
          {column.cards.map((card) => (
            <Card key={card.id} card={card} busy={busy} onMove={(to) => onMove(card, to)} />
          ))}
        </ul>
      )}
      {column.total > column.cards.length ? (
        <p className="text-xs text-muted-foreground">
          Mostrando {column.cards.length} de {column.total}. Use a lista com o filtro de estado para
          ver todos.
        </p>
      ) : null}
    </section>
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
      () => moveVariant({ data: { id: card.id, to, expectedVersion: card.version } }),
      { invalidate: [QueryKey.Content.all(), QueryKey.Dashboard.all()] },
    );
    if (result.ok) toast.success(`Movido para “${editorialStatusLabels[to]}”.`);
  }

  if (query.isPending) {
    return (
      <div className="flex gap-3 overflow-x-auto" aria-busy="true">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-64 w-72 shrink-0 rounded-2xl" />
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
    <div className="flex gap-3 overflow-x-auto pb-2" role="group" aria-label="Quadro de conteúdos">
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
