export function logError(...details: unknown[]) {
  // eslint-disable-next-line no-console -- the single place that writes errors to the console
  console.error(...details);
}
