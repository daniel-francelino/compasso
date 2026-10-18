import { useEffect, useState } from "react";
import { z } from "zod";
import type { AdminSpace } from "@/components/shared/admin/nav-config";
import { Space } from "@/lib/shared/enums";
import { StoredKey, readStored, writeStored } from "@/lib/shared/stored-keys";

const spaceSchema = z.union([z.literal(Space.Marketing), z.literal(Space.Cms)]);

export const useAdminSpace = () => {
  const [space, setSpace] = useState<AdminSpace>(Space.Marketing);

  useEffect(() => {
    setSpace(readStored(StoredKey.LastSpace, spaceSchema, Space.Marketing));
  }, []);

  const change = (next: AdminSpace) => {
    setSpace(next);
    writeStored(StoredKey.LastSpace, next);
  };

  return { space, change };
};
