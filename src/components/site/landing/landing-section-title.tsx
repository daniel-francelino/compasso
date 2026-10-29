import { BlurFade } from "lost-ui/effects/blur-fade";
import { TextAnimate } from "lost-ui/effects/text-animate";

export function LandingSectionTitle({
  eyebrow,
  title,
  text,
}: {
  eyebrow: string;
  title: string;
  text?: string;
}) {
  return (
    <header className="mx-auto max-w-2xl space-y-3 text-center">
      <BlurFade inView>
        <p className="text-sm font-semibold uppercase tracking-wide text-violet-deep">{eyebrow}</p>
      </BlurFade>
      <h2 className="font-display text-4xl font-bold tracking-tight text-ink sm:text-5xl">
        <TextAnimate animation="slideUp" by="word" as="span" startOnView once>
          {title}
        </TextAnimate>
      </h2>
      {text === undefined ? null : (
        <BlurFade inView delay={0.15}>
          <p className="text-lg text-ink-soft">{text}</p>
        </BlurFade>
      )}
    </header>
  );
}
