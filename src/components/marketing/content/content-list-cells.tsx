import { UserRound } from "lucide-react";
import type { ReactNode } from "react";
import { BrandAvatar } from "@/components/shared/admin/brand-avatar";
import { PersonAvatar } from "@/components/shared/admin/person-avatar";
import { formatIcons } from "@/components/shared/content/format-icons";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/shared/ui/tooltip";
import type { ContentFormat } from "@/lib/shared/enums";
import { contentFormatLabels } from "@/lib/shared/labels";

function Hint({ label, children }: { label: string; children: ReactNode }) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex" role="img" aria-label={label}>
            {children}
          </span>
        </TooltipTrigger>
        <TooltipContent>{label}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function BrandCell({ name, logoUrl }: { name: string; logoUrl: string | null }) {
  return (
    <Hint label={name}>
      <BrandAvatar name={name} logoUrl={logoUrl} size="sm" />
    </Hint>
  );
}

export function FormatCells({ formats }: { formats: ContentFormat[] }) {
  if (formats.length === 0) return <span className="text-muted-foreground">—</span>;
  return (
    <span className="inline-flex items-center gap-1.5">
      {formats.map((format) => {
        const Icon = formatIcons[format];
        return (
          <Hint key={format} label={contentFormatLabels[format]}>
            <span className="flex size-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <Icon aria-hidden="true" className="size-3.5" />
            </span>
          </Hint>
        );
      })}
    </span>
  );
}

export function OwnerCell({ name, url }: { name: string | null; url: string | undefined }) {
  if (name === null) {
    return (
      <Hint label="Sem responsável">
        <span className="flex size-6 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <UserRound aria-hidden="true" className="size-3.5" />
        </span>
      </Hint>
    );
  }
  return (
    <Hint label={name}>
      <PersonAvatar name={name} url={url} size="sm" />
    </Hint>
  );
}
