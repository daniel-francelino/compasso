import { useQuery } from "@tanstack/react-query";
import { CatchBoundary } from "@tanstack/react-router";
import { Send } from "lucide-react";
import { useState } from "react";
import { FieldMessage, TextAreaField, TextField } from "@/components/shared/admin/form-fields";
import { TurnstileBox } from "@/components/shared/site/turnstile-box";
import { Button } from "@/components/shared/ui/button";
import { Checkbox } from "@/components/shared/ui/checkbox";
import { Label } from "@/components/shared/ui/label";
import { contactForm } from "@/components/site/landing/landing-content";
import { useFormSubmit } from "@/hooks/shared/use-form-submit";
import { QueryKey } from "@/lib/shared/query-keys";
import { type ContactMessageInput, contactMessageSchema } from "@/lib/site/contact-schemas";
import { getContactConfig, submitContactMessage } from "@/lib/site/public.functions";

const emptyValues = { name: "", email: "", phone: "", message: "", website: "" };

function ContactUnavailable() {
  return (
    <p role="alert" className="rounded-lg border border-line bg-ivory p-5 text-ink-soft">
      {contactForm.unavailable}
    </p>
  );
}

function ContactFormBody() {
  const config = useQuery({
    queryKey: QueryKey.Site.contactConfig(),
    queryFn: () => getContactConfig(),
    staleTime: Infinity,
    retry: false,
  });
  const [values, setValues] = useState(emptyValues);
  const [consent, setConsent] = useState(false);
  const [token, setToken] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [sent, setSent] = useState(false);
  const { formRef, errors, error, busy, submit, setError } = useFormSubmit();
  const siteKey = config.data?.turnstileSiteKey ?? null;

  const set = (key: keyof typeof emptyValues) => (value: string) =>
    setValues((previous) => ({ ...previous, [key]: value }));

  if (sent) {
    return (
      <p role="status" className="rounded-lg border border-line bg-ivory p-5 text-ink">
        {contactForm.success}
      </p>
    );
  }

  async function send(data: ContactMessageInput) {
    const outcome = await submitContactMessage({ data });
    if (outcome.ok) return outcome;
    setToken("");
    setAttempt((previous) => previous + 1);
    return outcome;
  }

  async function onSubmit() {
    if (siteKey !== null && token === "") {
      setError(contactForm.captcha);
      return;
    }
    await submit(
      contactMessageSchema,
      { ...values, consent, turnstileToken: token, slug: contactForm.source },
      send,
      () => setSent(true),
    );
  }

  return (
    <form
      ref={formRef}
      noValidate
      className="space-y-4 text-left"
      onSubmit={(event) => {
        event.preventDefault();
        void onSubmit();
      }}
    >
      <TextField
        id="contact-name"
        label="Nome"
        required
        autoComplete="name"
        maxLength={120}
        value={values.name}
        onValueChange={set("name")}
        error={errors["name"]}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          id="contact-email"
          label="E-mail"
          type="email"
          autoComplete="email"
          maxLength={200}
          value={values.email}
          onValueChange={set("email")}
          error={errors["email"]}
        />
        <TextField
          id="contact-phone"
          label="Telefone ou WhatsApp"
          type="tel"
          autoComplete="tel"
          maxLength={40}
          value={values.phone}
          onValueChange={set("phone")}
          error={errors["phone"]}
        />
      </div>
      <TextAreaField
        id="contact-message"
        label="Mensagem"
        rows={5}
        maxLength={4000}
        value={values.message}
        onValueChange={set("message")}
        error={errors["message"]}
      />
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
      <div className="space-y-1.5">
        <div className="flex items-start gap-2">
          <Checkbox
            id="contact-consent"
            checked={consent}
            aria-invalid={errors["consent"] ? true : undefined}
            onCheckedChange={(checked) => setConsent(checked === true)}
          />
          <Label htmlFor="contact-consent" className="font-normal leading-snug">
            {contactForm.consent}
          </Label>
        </div>
        <FieldMessage error={errors["consent"]} />
      </div>
      {siteKey !== null ? (
        <div className="space-y-1.5">
          <TurnstileBox key={attempt} siteKey={siteKey} onToken={setToken} />
          <FieldMessage error={errors["turnstileToken"]} />
        </div>
      ) : null}
      {error === null ? null : (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <Button
        type="submit"
        size="lg"
        loading={busy}
        disabled={config.isPending}
        className="w-full sm:w-auto"
      >
        <Send aria-hidden="true" />
        {contactForm.submit}
      </Button>
    </form>
  );
}

export function LandingContactForm() {
  return (
    <CatchBoundary getResetKey={() => "contact-form"} errorComponent={ContactUnavailable}>
      <ContactFormBody />
    </CatchBoundary>
  );
}
