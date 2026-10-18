import { z } from "zod";
import type { ValueOf } from "@/lib/shared/utils";

export const SortDirection = {
  Asc: "asc",
  Desc: "desc",
} as const;
export type SortDirection = ValueOf<typeof SortDirection>;

export type ListSort = { key: string; dir: SortDirection } | null;

export const sortParams = {
  sort: z.string().max(40).optional(),
  dir: z.nativeEnum(SortDirection).optional(),
};

export const sortRequest = (sort: ListSort) => (sort ? { sort: sort.key, dir: sort.dir } : {});
