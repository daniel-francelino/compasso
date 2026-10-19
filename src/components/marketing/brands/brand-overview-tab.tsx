import { AudioLines, Building2, Clock3, PanelsTopLeft, Target, UsersRound } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { SectionCard } from "@/components/shared/admin/section-card";
import { PageSkeleton } from "@/components/shared/admin/skeletons";
import { useBrand } from "@/hooks/marketing/use-brand";

const fields = [
  ["description", "Sobre a marca", Building2],
  ["targetAudience", "Público", UsersRound],
  ["toneOfVoice", "Tom de voz", AudioLines],
  ["objectives", "Objetivos", Target],
] as const;

export function BrandOverviewTab({ brandId }: { brandId: string }) {
  const query = useBrand(brandId);
  if (!query.data) return <PageSkeleton rows={2} />;
  const brand = query.data;

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <SectionCard as="div" title="Resumo" icon={Building2}>
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="flex items-center gap-1.5 text-muted-foreground">
              <Building2 className="size-3.5" aria-hidden="true" />
              Cliente
            </dt>
            <dd>
              <Link
                to="/admin/marketing/clients/$clientId"
                params={{ clientId: brand.clientId }}
                className="text-primary underline-offset-4 hover:underline"
              >
                {brand.clientName}
              </Link>
            </dd>
          </div>
          <div>
            <dt className="flex items-center gap-1.5 text-muted-foreground">
              <Clock3 className="size-3.5" aria-hidden="true" />
              Fuso horário
            </dt>
            <dd>{brand.timezone.replaceAll("_", " ")}</dd>
          </div>
          <div>
            <dt className="flex items-center gap-1.5 text-muted-foreground">
              <PanelsTopLeft className="size-3.5" aria-hidden="true" />
              Canais
            </dt>
            <dd>{brand.channelCount}</dd>
          </div>
          <div>
            <dt className="flex items-center gap-1.5 text-muted-foreground">
              <UsersRound className="size-3.5" aria-hidden="true" />
              Membros
            </dt>
            <dd>{brand.memberCount}</dd>
          </div>
        </dl>
      </SectionCard>
      <SectionCard as="div" title="Identidade" icon={AudioLines}>
        {fields.map(([key, label, Icon]) => (
          <div key={key} className="text-sm">
            <p className="flex items-center gap-1.5 text-muted-foreground">
              <Icon className="size-3.5" aria-hidden="true" />
              {label}
            </p>
            <p className="whitespace-pre-wrap">{brand[key] ?? "—"}</p>
          </div>
        ))}
      </SectionCard>
    </div>
  );
}
