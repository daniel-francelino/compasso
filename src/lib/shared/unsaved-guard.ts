export let bypassNext = false;

export const bypassUnsavedGuard = () => {
  bypassNext = true;
};

export const consumeBypass = () => {
  const bypass = bypassNext;
  bypassNext = false;
  return bypass;
};
