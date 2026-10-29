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
            className="font-display text-lg font-bold whitespace-nowrap text-ink sm:text-xl"
          >
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
          <a
            href="#contato"
            className="rounded-full bg-violet px-4 py-2 text-sm whitespace-nowrap font-medium text-ivory hover:bg-violet-deep"
          >
            Vamos conversar
          </a>
        </nav>
      </header>
    </>
  );
}
