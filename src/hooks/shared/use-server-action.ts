import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import type { Result } from "@/lib/shared/server-utils";

type RunOptions = {
  success?: string;
  invalidate?: readonly (readonly unknown[])[];
};

export const useServerAction = () => {
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);

  const run = async <T extends object>(
    action: () => Promise<Result<T>>,
    options: RunOptions = {},
  ): Promise<Result<T>> => {
    setBusy(true);
    try {
      const result = await action();
      if (!result.ok) {
        toast.error(result.message);
        return result;
      }
      await Promise.all(
        (options.invalidate ?? []).map((queryKey) => queryClient.invalidateQueries({ queryKey })),
      );
      if (options.success !== undefined) toast.success(options.success);
      return result;
    } finally {
      setBusy(false);
    }
  };

  return { run, busy };
};
