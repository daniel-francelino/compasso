import { z } from "zod";
import { ConnectionStatus } from "@/lib/shared/enums";

export const brandIdSchema = z.object({ brandId: z.string().uuid() });

export const startConnectionSchema = z.object({ channelId: z.string().uuid() });

export const completeConnectionSchema = z.object({
  code: z.string().trim().min(1).max(2000),
  state: z.string().trim().min(1).max(1000),
});

export const connectionSettingsSchema = z.object({
  channelId: z.string().uuid(),
  autoPublishDefault: z.boolean(),
  collectMetrics: z.boolean(),
  expectedVersion: z.number().int().min(1),
});

export const testConnectionSchema = z.object({
  brandId: z.string().uuid(),
  channelId: z.string().uuid(),
});

export const disconnectSchema = z.object({ channelId: z.string().uuid() });

export const connectionRowSchema = z.object({
  channel_id: z.string().uuid(),
  brand_id: z.string().uuid(),
  provider: z.string(),
  username: z.string(),
  display_name: z.string().nullable(),
  account_type: z.string().nullable(),
  followers_count: z.number().int().nullable(),
  status: z.nativeEnum(ConnectionStatus),
  scopes: z.array(z.string()),
  token_expires_at: z.string(),
  auto_publish_default: z.boolean(),
  collect_metrics: z.boolean(),
  connected_at: z.string(),
  last_refreshed_at: z.string().nullable(),
  last_error_code: z.string().nullable(),
  last_metrics_at: z.string().nullable(),
  version: z.number().int(),
});

export type ChannelConnection = {
  channelId: string;
  username: string;
  displayName: string | null;
  accountType: string | null;
  followersCount: number | null;
  status: ConnectionStatus;
  scopes: string[];
  tokenExpiresAt: string;
  autoPublishDefault: boolean;
  collectMetrics: boolean;
  connectedAt: string;
  lastRefreshedAt: string | null;
  lastErrorCode: string | null;
  lastMetricsAt: string | null;
  version: number;
};

export const toConnection = (row: z.infer<typeof connectionRowSchema>): ChannelConnection => ({
  channelId: row.channel_id,
  username: row.username,
  displayName: row.display_name,
  accountType: row.account_type,
  followersCount: row.followers_count,
  status: row.status,
  scopes: row.scopes,
  tokenExpiresAt: row.token_expires_at,
  autoPublishDefault: row.auto_publish_default,
  collectMetrics: row.collect_metrics,
  connectedAt: row.connected_at,
  lastRefreshedAt: row.last_refreshed_at,
  lastErrorCode: row.last_error_code,
  lastMetricsAt: row.last_metrics_at,
  version: row.version,
});
