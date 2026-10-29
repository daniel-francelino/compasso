import { Link } from "@tanstack/react-router";
import { LogIn, MessageCircle } from "lucide-react";
import { ScrollProgress } from "lost-ui/effects/scroll-progress";
import { navItems } from "@/components/site/landing/landing-content";

export function LandingHeader() {
  return (
    <>
      <ScrollProgress />
      <header className="sticky top-0 z-40 border-b border-line bg-surface">
        <nav
          aria-label="Principal"
          className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-3"
        >
          <a
            href="/"
            className="flex items-center gap-2 font-display text-lg font-bold whitespace-nowrap text-ink sm:text-xl"
          >
            <img src="/aura-mark.svg" alt="" width={28} height={28} className="size-7" />
            Rayana Vasconcelos
          </a>
          <ul className="hidden items-center gap-6 text-sm md:flex">
            {navItems.map((item) => (
              <li key={item.anchor}>
                <a href={`#${item.anchor}`} className="text-ink-soft hover:text-violet-deep">
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
          <div className="flex items-center gap-2">
            <Link
              to="/admin/login"
              aria-label="Entrar"
              className="inline-flex min-h-11 items-center gap-2 rounded-full border border-line-strong px-3 text-sm font-medium whitespace-nowrap text-ink hover:bg-orchid-light sm:px-4"
            >
              <LogIn aria-hidden="true" className="size-4" />
              <span className="max-sm:sr-only">Entrar</span>
            </Link>
            <a
              href="#contato"
              className="inline-flex min-h-11 items-center gap-2 rounded-full bg-violet px-3 text-sm sm:px-4 whitespace-nowrap font-medium text-ivory hover:bg-violet-deep"
            >
              <MessageCircle aria-hidden="true" className="size-4" />
              <span className="max-sm:sr-only">Vamos conversar</span>
            </a>
          </div>
        </nav>
      </header>
    </>
  );
}
