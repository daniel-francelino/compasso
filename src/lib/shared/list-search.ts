import { z } from "zod";
import { SortDirection } from "@/lib/shared/list-sort";

export const PAGE_SIZE = 20;

export const listSearchSchema = z.object({
  q: z.string().max(100).optional().catch(undefined),
  page: z.coerce.number().int().min(1).max(10000).optional().catch(undefined),
  status: z.string().max(40).optional().catch(undefined),
  sort: z.string().max(40).optional().catch(undefined),
  dir: z.nativeEnum(SortDirection).optional().catch(undefined),
  owner: z.string().uuid().optional().catch(undefined),
  tag: z.string().max(40).optional().catch(undefined),
  contentType: z.string().uuid().optional().catch(undefined),
  client: z.string().uuid().optional().catch(undefined),
  platform: z.string().max(20).optional().catch(undefined),
  scope: z.string().max(10).optional().catch(undefined),
  brand: z.string().uuid().optional().catch(undefined),
  kind: z.string().max(10).optional().catch(undefined),
  folder: z.string().uuid().optional().catch(undefined),
  order: z.string().max(10).optional().catch(undefined),
  editorial: z.string().max(30).optional().catch(undefined),
  channel: z.string().uuid().optional().catch(undefined),
  publication: z.string().max(30).optional().catch(undefined),
  view: z.string().max(10).optional().catch(undefined),
});

export type ListSearch = z.infer<typeof listSearchSchema>;

export const listRequestSchema = z.object({
  search: z.string().max(100).default(""),
  page: z.number().int().min(1).max(10000).default(1),
  status: z.string().max(40).optional(),
  sort: z.string().max(40).optional(),
  dir: z.nativeEnum(SortDirection).optional(),
});

export type ListRequest = z.infer<typeof listRequestSchema>;
