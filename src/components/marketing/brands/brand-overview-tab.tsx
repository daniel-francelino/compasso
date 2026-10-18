import { Link } from "@tanstack/react-router";
import { SectionCard } from "@/components/shared/admin/section-card";
import { PageSkeleton } from "@/components/shared/admin/skeletons";
import { useBrand } from "@/hooks/marketing/use-brand";

const fields = [
  ["description", "Sobre a marca"],
  ["targetAudience", "Público"],
  ["toneOfVoice", "Tom de voz"],
  ["objectives", "Objetivos"],
] as const;

export function BrandOverviewTab({ brandId }: { brandId: string }) {
  const query = useBrand(brandId);
  if (!query.data) return <PageSkeleton rows={2} />;
  const brand = query.data;

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <SectionCard as="div" title="Resumo">
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-muted-foreground">Cliente</dt>
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
            <dt className="text-muted-foreground">Fuso horário</dt>
            <dd>{brand.timezone.replaceAll("_", " ")}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Canais</dt>
            <dd>{brand.channelCount}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Membros</dt>
            <dd>{brand.memberCount}</dd>
          </div>
        </dl>
      </SectionCard>
      <SectionCard as="div" title="Identidade">
        {fields.map(([key, label]) => (
          <div key={key} className="text-sm">
            <p className="text-muted-foreground">{label}</p>
            <p className="whitespace-pre-wrap">{brand[key] ?? "—"}</p>
          </div>
        ))}
      </SectionCard>
    </div>
  );
}
