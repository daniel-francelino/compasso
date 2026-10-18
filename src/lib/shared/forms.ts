import type { ZodError } from "zod";

export const zodFieldErrors = (error: ZodError) => {
  const errors: Record<string, string> = {};
  for (const issue of error.issues) {
    const field = String(issue.path[0] ?? "form");
    errors[field] ??= issue.message;
  }
  return errors;
};

export const focusFirstInvalid = (form: HTMLFormElement | null) => {
  if (!form) return;
  requestAnimationFrame(() => {
    form.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  });
};
