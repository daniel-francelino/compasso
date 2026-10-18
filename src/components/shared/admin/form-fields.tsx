import type { ReactNode, Ref } from "react";
import { InfoTip } from "@/components/shared/admin/info-tip";
import { Input } from "@/components/shared/ui/input";
import { Label } from "@/components/shared/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/shared/ui/select";
import { Textarea } from "@/components/shared/ui/textarea";
import { cn } from "@/lib/shared/utils";

export function FieldLabel({
  htmlFor,
  required,
  tip,
  children,
}: {
  htmlFor: string;
  required?: boolean | undefined;
  tip?: { label: string; content: ReactNode } | undefined;
  children: ReactNode;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <Label htmlFor={htmlFor}>
        {children}
        {required ? (
          <>
            {" "}
            <span aria-hidden className="text-destructive">
              *
            </span>
          </>
        ) : null}
      </Label>
      {tip ? <InfoTip label={tip.label}>{tip.content}</InfoTip> : null}
    </div>
  );
}

export function FieldMessage({
  error,
  hint,
}: {
  error?: string | undefined;
  hint?: ReactNode | undefined;
}) {
  const content = error ?? hint;
  if (!content) return null;
  return (
    <p className={cn("text-xs", error ? "text-destructive" : "text-muted-foreground")}>{content}</p>
  );
}

export function TextField({
  id,
  label,
  required,
  tip,
  value,
  onValueChange,
  maxLength,
  counter = false,
  inputMode,
  placeholder,
  error,
  disabled,
  type,
  hint,
  inputRef,
  autoComplete,
}: {
  id: string;
  label: string;
  required?: boolean;
  tip?: { label: string; content: ReactNode } | undefined;
  value: string;
  onValueChange: (value: string) => void;
  maxLength?: number;
  inputMode?: "numeric" | "decimal" | "text" | "email" | "tel";
  placeholder?: string;
  type?: "text" | "email" | "tel";
  hint?: string | undefined;
  inputRef?: Ref<HTMLInputElement>;
  autoComplete?: string;
  counter?: boolean;
  error?: string | undefined;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <FieldLabel htmlFor={id} required={required} tip={tip}>
        {label}
      </FieldLabel>
      <Input
        ref={inputRef}
        id={id}
        name={id}
        type={type}
        className="h-11 md:h-10"
        value={value}
        maxLength={maxLength}
        inputMode={inputMode}
        autoComplete={autoComplete}
        placeholder={placeholder}
        disabled={disabled}
        aria-invalid={error ? true : undefined}
        aria-required={required}
        onChange={(event) => onValueChange(event.target.value)}
      />
      <FieldMessage
        error={error}
        hint={counter && maxLength ? `${value.length}/${maxLength} caracteres` : hint}
      />
    </div>
  );
}

export function NumberField({
  id,
  label,
  tip,
  ariaLabel,
  value,
  onValueChange,
  placeholder,
  hint,
  error,
  disabled,
  className,
}: {
  id: string;
  label?: string;
  tip?: { label: string; content: ReactNode } | undefined;
  ariaLabel?: string;
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  hint?: string | undefined;
  error?: string | undefined;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <div className="space-y-1.5">
      {label ? (
        <FieldLabel htmlFor={id} tip={tip}>
          {label}
        </FieldLabel>
      ) : null}
      <Input
        id={id}
        name={id}
        type="text"
        inputMode="decimal"
        className={cn("h-11 md:h-10", className)}
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        aria-label={label ? undefined : ariaLabel}
        aria-invalid={error ? true : undefined}
        aria-describedby={error || hint ? `${id}-message` : undefined}
        onChange={(event) => onValueChange(event.target.value)}
      />
      {error || hint ? (
        <p
          id={`${id}-message`}
          className={cn("text-xs", error ? "text-destructive" : "text-muted-foreground")}
        >
          {error ?? hint}
        </p>
      ) : null}
    </div>
  );
}

export function TextAreaField({
  id,
  label,
  tip,
  value,
  onValueChange,
  maxLength,
  rows,
  error,
  disabled,
}: {
  id: string;
  label: string;
  tip?: { label: string; content: ReactNode } | undefined;
  value: string;
  onValueChange: (value: string) => void;
  maxLength: number;
  rows: number;
  error?: string | undefined;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <FieldLabel htmlFor={id} tip={tip}>
        {label}
      </FieldLabel>
      <Textarea
        id={id}
        value={value}
        disabled={disabled}
        maxLength={maxLength}
        rows={rows}
        aria-invalid={error ? true : undefined}
        onChange={(event) => onValueChange(event.target.value)}
      />
      <FieldMessage error={error} hint={`${value.length}/${maxLength} caracteres`} />
    </div>
  );
}

export type SelectOption = { value: string; label: string; icon?: ReactNode };

export function SelectField({
  id,
  label,
  required,
  tip,
  value,
  onValueChange,
  options,
  placeholder,
  error,
  disabled,
  triggerClassName,
}: {
  id: string;
  label: string;
  required?: boolean;
  tip?: { label: string; content: ReactNode } | undefined;
  value: string;
  onValueChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  error?: string | undefined;
  disabled?: boolean;
  triggerClassName?: string;
}) {
  return (
    <div className="space-y-1.5">
      <FieldLabel htmlFor={id} required={required} tip={tip}>
        {label}
      </FieldLabel>
      <Select value={value} onValueChange={onValueChange} disabled={disabled ?? false}>
        <SelectTrigger
          id={id}
          className={triggerClassName}
          aria-invalid={error ? true : undefined}
          aria-required={required}
        >
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.icon ? (
                <span className="flex items-center gap-2">
                  {option.icon}
                  {option.label}
                </span>
              ) : (
                option.label
              )}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <FieldMessage error={error} />
    </div>
  );
}

export function DateField({
  id,
  label,
  required,
  value,
  onValueChange,
  error,
  hint,
  disabled,
  min,
}: {
  id: string;
  label: string;
  required?: boolean;
  value: string;
  onValueChange: (value: string) => void;
  error?: string | undefined;
  hint?: string | undefined;
  disabled?: boolean;
  min?: string;
}) {
  return (
    <div className="space-y-1.5">
      <FieldLabel htmlFor={id} required={required}>
        {label}
      </FieldLabel>
      <Input
        id={id}
        name={id}
        type="date"
        className="h-11 md:h-10"
        value={value}
        min={min}
        disabled={disabled}
        aria-invalid={error ? true : undefined}
        aria-required={required}
        onChange={(event) => onValueChange(event.target.value)}
      />
      <FieldMessage error={error} hint={hint} />
    </div>
  );
}
