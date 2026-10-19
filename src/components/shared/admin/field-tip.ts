export const hintTip = (label: string, hint: string | undefined) =>
  hint ? { label: `Ajuda sobre ${label}`, content: hint } : undefined;
