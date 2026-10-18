import type { ReactNode } from "react";
import type { PublishedSettings } from "@/lib/shared/content/published";

type Settings = Pick<PublishedSettings, "navigation" | "announcement" | "contacts" | "social">;

const socialLabels: Record<string, string> = {
  instagram: "Instagram",
  linkedin: "LinkedIn",
  facebook: "Facebook",
  youtube: "YouTube",
};

const linkProps = (link: { href: string; newTab: boolean }) => ({
  href: link.href,
  ...(link.newTab ? { target: "_blank", rel: "noopener noreferrer" } : {}),
});

export function SiteLayout({
  settings,
  children,
}: {
  settings: Settings | null;
  children: ReactNode;
}) {
  const header = settings?.navigation.header ?? [];
  const footer = settings?.navigation.footer ?? [];
  const announcement = settings?.announcement;
  const social = Object.entries(settings?.social ?? {}).filter(([, url]) =>
    url.startsWith("https://"),
  );
  return (
    <div className="flex min-h-screen flex-col bg-ivory text-ink">
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded-md focus:bg-surface focus:px-3 focus:py-2"
      >
        Pular para o conteúdo
      </a>
      {announcement?.enabled && announcement.text !== "" ? (
        <p className="bg-violet px-6 py-2 text-center text-sm text-ivory">
          {announcement.link ? (
            <a {...linkProps(announcement.link)} className="underline">
              {announcement.text}
            </a>
          ) : (
            announcement.text
          )}
        </p>
      ) : null}
      {header.length > 0 ? (
        <header className="border-b border-line bg-surface">
          <nav
            aria-label="Principal"
            className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-6 py-4"
          >
            <a href="/" className="font-semibold">
              Início
            </a>
            <ul className="flex flex-wrap gap-x-5 gap-y-1">
              {header.map((item) => (
                <li key={item.label}>
                  {item.link ? (
                    <a {...linkProps(item.link)} className="hover:underline">
                      {item.label}
                    </a>
                  ) : (
                    <span>{item.label}</span>
                  )}
                  {item.children.length > 0 ? (
                    <ul className="ml-3 inline-flex gap-3 text-sm text-ink-soft">
                      {item.children.map((child) => (
                        <li key={child.label}>
                          {child.link ? (
                            <a {...linkProps(child.link)} className="hover:underline">
                              {child.label}
                            </a>
                          ) : (
                            child.label
                          )}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              ))}
            </ul>
          </nav>
        </header>
      ) : null}
      <main id="conteudo" className="flex-1">
        {children}
      </main>
      {footer.length > 0 || social.length > 0 ? (
        <footer className="border-t border-line bg-surface">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-6 text-sm">
            <ul className="flex flex-wrap gap-x-5 gap-y-1">
              {footer.map((item) => (
                <li key={item.label}>
                  {item.link ? (
                    <a {...linkProps(item.link)} className="hover:underline">
                      {item.label}
                    </a>
                  ) : (
                    item.label
                  )}
                </li>
              ))}
            </ul>
            <ul className="flex flex-wrap gap-x-4">
              {social.map(([key, url]) => (
                <li key={key}>
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:underline"
                  >
                    {socialLabels[key] ?? key}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </footer>
      ) : null}
    </div>
  );
}
