const BRAZIL_FIRST = [
  "America/Sao_Paulo",
  "America/Recife",
  "America/Fortaleza",
  "America/Bahia",
  "America/Manaus",
  "America/Cuiaba",
  "America/Belem",
  "America/Rio_Branco",
  "America/Noronha",
];

export const timezoneOptions = (): { value: string; label: string }[] => {
  const all = Intl.supportedValuesOf("timeZone");
  const rest = all.filter((zone) => !BRAZIL_FIRST.includes(zone));
  return [...BRAZIL_FIRST, ...rest].map((zone) => ({
    value: zone,
    label: zone.replaceAll("_", " "),
  }));
};
