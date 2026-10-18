import { useState } from "react";
import { z } from "zod";
import type { SiteRenderContext } from "@/components/shared/site/site-context";
import { TurnstileBox } from "@/components/shared/site/turnstile-box";
import { Button } from "@/components/shared/ui/button";
import { Checkbox } from "@/components/shared/ui/checkbox";
import { Input } from "@/components/shared/ui/input";
import { Label } from "@/components/shared/ui/label";
import { Textarea } from "@/components/shared/ui/textarea";

const schema = z.object({
  title: z.string().default(""),
  intro: z.string().default(""),
  consentText: z.string().default(""),
  successMessage: z.string().default(""),
});

export function ContactFormSection({
  content,
  ctx,
}: {
  content: Record<string, unknown>;
  ctx: SiteRenderContext;
}) {
  const parsed = schema.safeParse(content);
  const [values, setValues] = useState({
    name: "",
    email: "",
    phone: "",
    message: "",
    website: "",
  });
  const [consent, setConsent] = useState(false);
  const [token, setToken] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "done">("idle");
  const [error, setError] = useState<string | null>(null);
  if (!parsed.success || parsed.data.consentText === "") return null;
  const { title, intro, consentText, successMessage } = parsed.data;

  if (state === "done") {
    return (
      <div className="mx-auto max-w-xl px-6" role="status">
        <p className="rounded-2xl border border-line bg-surface p-6">{successMessage}</p>
      </div>
    );
  }

  const set = (key: keyof typeof values) => (value: string) =>
    setValues((previous) => ({ ...previous, [key]: value }));

  async function submit() {
    if (state === "sending") return;
    setError(null);
    if (values.name.trim() === "" || values.message.trim() === "") {
      setError("Informe seu nome e a mensagem.");
      return;
    }
    if (values.email.trim() === "" && values.phone.trim() === "") {
      setError("Informe um e-mail ou um telefone para a resposta.");
      return;
    }
    if (!consent) {
      setError("É preciso aceitar o consentimento para enviar a mensagem.");
      return;
    }
    if (ctx.submitContact === null) {
      setError("O envio não está disponível na pré-visualização.");
      return;
    }
    setState("sending");
    const outcome = await ctx.submitContact({ ...values, consent, turnstileToken: token });
    if (outcome.ok) {
      setState("done");
      return;
    }
    setState("idle");
    setError(outcome.message);
  }

  return (
    <div className="mx-auto max-w-xl space-y-6 px-6">
      <header className="space-y-2">
        {title === "" ? null : <h2 className="heading-card">{title}</h2>}
        {intro === "" ? null : <p className="text-ink-soft">{intro}</p>}
      </header>
      <form
        noValidate
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <div className="space-y-1.5">
          <Label htmlFor="contact-name">Nome</Label>
          <Input
            id="contact-name"
            autoComplete="name"
            maxLength={120}
            value={values.name}
            onChange={(event) => set("name")(event.target.value)}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="contact-email">E-mail</Label>
            <Input
              id="contact-email"
              type="email"
              autoComplete="email"
              maxLength={200}
              value={values.email}
              onChange={(event) => set("email")(event.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="contact-phone">Telefone</Label>
            <Input
              id="contact-phone"
              type="tel"
              autoComplete="tel"
              maxLength={40}
              value={values.phone}
              onChange={(event) => set("phone")(event.target.value)}
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="contact-message">Mensagem</Label>
          <Textarea
            id="contact-message"
            rows={5}
            maxLength={4000}
            value={values.message}
            onChange={(event) => set("message")(event.target.value)}
          />
        </div>
        <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
          <label htmlFor="contact-website">Não preencha este campo</label>
          <input
            id="contact-website"
            tabIndex={-1}
            autoComplete="off"
            value={values.website}
            onChange={(event) => set("website")(event.target.value)}
          />
        </div>
        <div className="flex items-start gap-2">
          <Checkbox
            id="contact-consent"
            checked={consent}
            onCheckedChange={(checked) => setConsent(checked === true)}
          />
          <Label htmlFor="contact-consent" className="font-normal leading-snug">
            {consentText}
          </Label>
        </div>
        {ctx.turnstileSiteKey ? (
          <TurnstileBox siteKey={ctx.turnstileSiteKey} onToken={setToken} />
        ) : null}
        {error === null ? null : (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
        <Button type="submit" loading={state === "sending"}>
          Enviar mensagem
        </Button>
      </form>
    </div>
  );
}
