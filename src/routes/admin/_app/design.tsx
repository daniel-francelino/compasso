import { createFileRoute, notFound } from "@tanstack/react-router";
import { CircleCheck, Clock, FileText, Inbox, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/shared/admin/empty-state";
import { PageHeader } from "@/components/shared/admin/page-header";
import { SectionCard } from "@/components/shared/admin/section-card";
import { type StatusTone, StatusBadge } from "@/components/shared/admin/status-badge";
import { Button } from "@/components/shared/ui/button";
import { Skeleton } from "@/components/shared/ui/skeleton";

export const Route = createFileRoute("/admin/_app/design")({
  beforeLoad: () => {
    if (!import.meta.env.DEV) throw notFound();
  },
  component: DesignPage,
});

const swatches = [
  ["bg-ink", "ink"],
  ["bg-ink-soft", "ink-soft"],
  ["bg-violet", "violet"],
  ["bg-violet-deep", "violet-deep"],
  ["bg-violet-bright", "violet-bright"],
  ["bg-orchid", "orchid"],
  ["bg-orchid-light", "orchid-light"],
  ["bg-rose", "rose"],
  ["bg-peach", "peach"],
  ["bg-coral", "coral"],
  ["bg-coral-dark", "coral-dark"],
  ["bg-sage", "sage"],
  ["bg-cactus", "cactus"],
  ["bg-ivory", "ivory"],
  ["bg-surface", "surface"],
  ["bg-cream", "cream"],
  ["bg-line", "line"],
  ["bg-line-strong", "line-strong"],
  ["bg-warning", "warning"],
  ["bg-danger", "danger"],
] as const;

const tones: { tone: StatusTone; label: string; icon: typeof FileText }[] = [
  { tone: "draft", label: "Rascunho", icon: FileText },
  { tone: "info", label: "Em produção", icon: Clock },
  { tone: "warning", label: "Aguardando aprovação", icon: Clock },
  { tone: "negative", label: "Alterações solicitadas", icon: TriangleAlert },
  { tone: "success", label: "Aprovado", icon: CircleCheck },
  { tone: "neutral", label: "Cancelado", icon: FileText },
];

function DesignPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Design system" description="Página de desenvolvimento." />

      <SectionCard title="Cores">
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5">
          {swatches.map(([className, name]) => (
            <li key={name} className="space-y-1">
              <div className={`${className} h-12 rounded-md border border-border`} />
              <p className="text-xs text-muted-foreground">{name}</p>
            </li>
          ))}
        </ul>
      </SectionCard>

      <SectionCard title="Botões">
        <div className="flex flex-wrap gap-2">
          <Button>Primário</Button>
          <Button variant="secondary">Secundário</Button>
          <Button variant="outline">Contorno</Button>
          <Button variant="ghost">Discreto</Button>
          <Button variant="destructive">Excluir</Button>
          <Button disabled>Desabilitado</Button>
          <Button variant="outline" onClick={() => toast.success("Salvo com sucesso.")}>
            Mostrar aviso
          </Button>
        </div>
      </SectionCard>

      <SectionCard title="Status">
        <div className="flex flex-wrap gap-2">
          {tones.map((item) => (
            <StatusBadge key={item.tone} tone={item.tone} icon={item.icon}>
              {item.label}
            </StatusBadge>
          ))}
        </div>
      </SectionCard>

      <SectionCard title="Estados">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2" aria-busy="true">
            <Skeleton className="h-6 w-1/2" />
            <Skeleton className="h-24 w-full" />
          </div>
          <EmptyState
            icon={Inbox}
            title="Nada por aqui ainda"
            description="Quando houver itens, eles aparecem nesta lista."
          />
        </div>
      </SectionCard>
    </div>
  );
}
