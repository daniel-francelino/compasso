import { FALLBACK_LOGO_PERCENT } from "@/lib/shared/preview/instagram";

export function InstagramMediaFallback({
  profileName,
  brandLogoUrl,
}: {
  profileName: string;
  brandLogoUrl: string | null | undefined;
}) {
  const width = `${FALLBACK_LOGO_PERCENT}%`;
  return (
    <div
      role="img"
      aria-label="Imagem ainda não enviada"
      className="flex size-full flex-col items-center justify-center gap-3 bg-muted text-muted-foreground"
    >
      {brandLogoUrl ? (
        <img src={brandLogoUrl} alt="" className="object-contain" style={{ width }} />
      ) : (
        <span
          className="flex aspect-square items-center justify-center rounded-full bg-surface text-2xl font-semibold text-foreground"
          style={{ width }}
          aria-hidden="true"
        >
          {profileName.replace("@", "").slice(0, 1).toUpperCase()}
        </span>
      )}
      <span className="text-xs">Imagem ainda não enviada</span>
    </div>
  );
}
