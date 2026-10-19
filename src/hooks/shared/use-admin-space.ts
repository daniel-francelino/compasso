import { useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { type AdminSpace, spaceOfPath } from "@/components/shared/admin/nav-config";
import { Space } from "@/lib/shared/enums";
import { StoredKey, readStored, writeStored } from "@/lib/shared/stored-keys";

const spaceSchema = z.union([z.literal(Space.Marketing), z.literal(Space.Cms)]);

export const useAdminSpace = (): AdminSpace => {
  const fromRoute = useRouterState({ select: (state) => spaceOfPath(state.location.pathname) });
  const [remembered, setRemembered] = useState<AdminSpace>(Space.Marketing);

  useEffect(() => {
    setRemembered(readStored(StoredKey.LastSpace, spaceSchema, Space.Marketing));
  }, []);

  useEffect(() => {
    if (fromRoute === null) return;
    setRemembered(fromRoute);
    writeStored(StoredKey.LastSpace, fromRoute);
  }, [fromRoute]);

  return fromRoute ?? remembered;
};
