import { capabilitiesFor } from "./platform/capabilities.ts";

export interface SourceActionFlags {
  canRefreshLatest: boolean;
  canBackfill: boolean;
  allowBackfillAll: boolean;
  canSyncTags: boolean;
  canCheckAvailability: boolean;
}

export function sourceActionFlags(platform: string): SourceActionFlags {
  const cap = capabilitiesFor(platform);
  if (!cap) {
    return {
      canRefreshLatest: false,
      canBackfill: false,
      allowBackfillAll: false,
      canSyncTags: false,
      canCheckAvailability: false,
    };
  }
  return {
    canRefreshLatest: cap.latestRefresh,
    canBackfill: cap.backfill,
    allowBackfillAll: cap.backfillAll,
    canSyncTags: cap.tagsSync,
    canCheckAvailability: cap.availabilityCheck,
  };
}
