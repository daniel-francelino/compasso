import { Eye, EyeOff } from "lucide-react";
import { useState, type ComponentProps, type ReactNode } from "react";
import { InfoTip } from "@/components/shared/admin/info-tip";
import { Input } from "@/components/shared/ui/input";
import { Label } from "@/components/shared/ui/label";
import { SectionCard } from "@/components/shared/admin/section-card";

export function AuthShell({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description?: string | undefined;
  children: ReactNode;
  footer?: ReactNode | undefined;
}) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-10">
      <img src="/aura-creative-logo.png" alt="Aura Creative" className="mb-6 h-auto w-56" />
      <SectionCard padding="lg" as="div" className="w-full max-w-md sm:p-8">
        <h1 className="heading-section text-foreground">{title}</h1>
        {description ? <p className="mt-2 text-sm text-muted-foreground">{description}</p> : null}
        <div className="mt-6">{children}</div>
      </SectionCard>
      {footer ? <div className="mt-5 text-sm text-muted-foreground">{footer}</div> : null}
    </main>
  );
}

type FieldExtras = {
  id: string;
  label: string;
  error?: string | undefined;
  hint?: string | undefined;
};

function FieldFrame({
  id,
  label,
  error,
  hint,
  required,
  children,
}: FieldExtras & { required?: boolean | undefined; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5">
        <Label htmlFor={id}>
          {label}
          {required ? (
            <span aria-hidden className="ml-0.5 text-destructive">
              *
            </span>
          ) : null}
        </Label>
        {hint ? <InfoTip label={`Ajuda sobre ${label}`}>{hint}</InfoTip> : null}
      </div>
      {children}
      {error ? (
        <p id={`${id}-error`} className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}

const describedBy = (id: string, error?: string) => (error ? `${id}-error` : undefined);

export function Field({ id, label, error, hint, ...props }: FieldExtras & ComponentProps<"input">) {
  return (
    <FieldFrame id={id} label={label} error={error} hint={hint} required={props.required}>
      <Input
        id={id}
        name={id}
        className="h-11 md:h-10"
        aria-invalid={error ? true : undefined}
        aria-required={props.required}
        aria-describedby={describedBy(id, error)}
        {...props}
        required={false}
      />
    </FieldFrame>
  );
}

export function PasswordField({
  id,
  label,
  error,
  hint,
  ...props
}: FieldExtras & Omit<ComponentProps<"input">, "type">) {
  const [visible, setVisible] = useState(false);

  return (
    <FieldFrame id={id} label={label} error={error} hint={hint} required={props.required}>
      <div className="relative">
        <Input
          id={id}
          name={id}
          type={visible ? "text" : "password"}
          className="h-11 pr-11 md:h-10"
          aria-invalid={error ? true : undefined}
          aria-required={props.required}
          aria-describedby={describedBy(id, error)}
          {...props}
          required={false}
        />
        <button
          type="button"
          onClick={() => setVisible((current) => !current)}
          aria-label={visible ? "Esconder senha" : "Mostrar senha"}
          aria-pressed={visible}
          className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-md text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </div>
    </FieldFrame>
  );
}

export function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p
      role="alert"
      className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
    >
      {message}
    </p>
  );
}
