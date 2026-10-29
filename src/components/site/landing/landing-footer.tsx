import { Instagram, Mail } from "lucide-react";
import { contact, footer, navItems } from "@/components/site/landing/landing-content";

export function LandingFooter() {
  return (
    <footer className="bg-ink text-ivory [--foreground:var(--ivory)]">
      <div className="mx-auto grid max-w-6xl gap-10 px-6 py-14 md:grid-cols-[1.4fr_1fr_1fr]">
        <div className="space-y-4">
          <a href="/" className="flex items-center gap-2 font-display text-2xl font-bold">
            <img src="/aura-mark.svg" alt="" width={32} height={32} className="size-8" />
            Rayana Vasconcelos
          </a>
          <p className="max-w-sm text-orchid-light">{footer.tagline}</p>
        </div>
        <nav aria-label="Rodapé" className="space-y-3">
          <p className="font-display text-xl font-semibold">{footer.navTitle}</p>
          <ul className="space-y-2 text-orchid-light">
            {navItems.map((item) => (
              <li key={item.anchor}>
                <a href={`#${item.anchor}`} className="hover:text-ivory hover:underline">
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <div className="space-y-3">
          <p className="font-display text-xl font-semibold">{footer.contactTitle}</p>
          <ul className="space-y-2 text-orchid-light">
            <li>
              <a
                href={contact.instagram.href}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 hover:text-ivory hover:underline"
              >
                <Instagram aria-hidden="true" className="size-4" />
                {contact.instagram.label}
              </a>
            </li>
            <li>
              <a
                href={contact.email.href}
                className="inline-flex items-center gap-2 hover:text-ivory hover:underline"
              >
                <Mail aria-hidden="true" className="size-4" />
                {contact.email.label}
              </a>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-ivory/20 px-6 py-5 text-center text-sm text-orchid-light">
        <p>{footer.legal}</p>
      </div>
    </footer>
  );
}
