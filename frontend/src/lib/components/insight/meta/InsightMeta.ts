import type { Insight, TimeBucket } from '$lib/components/insight/Insight';
import { writable } from 'svelte/store';
import { authService } from '$lib/client/auth';

export const createInsightMetaStore = (meta: InsightMeta) => {
  const { subscribe, set, update } = writable<InsightMeta>(meta);

  authService.checkAuth();
  return {
    subscribe,
    set,
    update: (data: Partial<InsightMeta>) => update((meta) => ({ ...meta, ...data })),
  };
};

export interface InsightMeta {
  range: {
    start: Date;
    end: Date;
  };
  timeBucket: TimeBucket;
}
