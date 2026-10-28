import { useRef, useState } from "react";
import type { ZodType, ZodTypeDef } from "zod";
import { focusFirstInvalid, zodFieldErrors } from "@/lib/shared/forms";
import type { Failure } from "@/lib/shared/server-utils";

type Outcome = { ok: true } | Failure;

type Options = { onInvalid?: (fields: Record<string, string>) => void };

export const useFormSubmit = (options: Options = {}) => {
  const formRef = useRef<HTMLFormElement>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function reportFailure(failure: Failure) {
    setError(failure.message);
    if (failure.fields === undefined) return;
    setErrors(failure.fields);
    options.onInvalid?.(failure.fields);
    focusFirstInvalid(formRef.current);
  }

  async function submit<Input, Res extends Outcome>(
    schema: ZodType<Input, ZodTypeDef, unknown>,
    values: unknown,
    action: (data: Input) => Promise<Res>,
    onSuccess: (result: Extract<Res, { ok: true }>) => void | Promise<void>,
  ) {
    if (busy) return;
    setError(null);
    setErrors({});

    const parsed = schema.safeParse(values);
    if (!parsed.success) {
      const fields = zodFieldErrors(parsed.error);
      setErrors(fields);
      options.onInvalid?.(fields);
      focusFirstInvalid(formRef.current);
      return;
    }

    setBusy(true);
    let result: Res;
    try {
      result = await action(parsed.data);
    } catch {
      result = {
        ok: false,
        code: "unavailable",
        message: "Não foi possível salvar. Verifique sua conexão e tente novamente.",
      } as Res;
    } finally {
      setBusy(false);
    }

    if (!result.ok) {
      reportFailure(result);
      return;
    }
    await onSuccess(result as Extract<Res, { ok: true }>);
  }

  return { formRef, errors, error, busy, submit, setError };
};
