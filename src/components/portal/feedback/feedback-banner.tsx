import { MessageSquareHeart } from "lucide-react";
import { SectionCard } from "@/components/shared/admin/section-card";
import { Button } from "@/components/shared/ui/button";
import { periodMonthName } from "@/lib/shared/feedback/period";

export function FeedbackBanner({ period, onOpen }: { period: string; onOpen: () => void }) {
  return (
    <SectionCard
      padding="sm"
      aria-label="Pesquisa mensal"
      className="flex flex-wrap items-center justify-between gap-3"
    >
      <p className="flex items-center gap-2 text-sm">
        <MessageSquareHeart className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
        Conte como foi o trabalho em {periodMonthName(period)}.
      </p>
      <Button type="button" size="sm" onClick={onOpen}>
        Responder agora
      </Button>
    </SectionCard>
  );
}
