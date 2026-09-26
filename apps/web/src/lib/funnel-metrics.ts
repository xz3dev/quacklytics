export interface FunnelPoint {
  index: number;
  label: string;
  value: number;
  start: number;
  conversion: number | null;
  conversionPrevious: number | null;
  dropped: number;
  droppedFromStart: number;
  dropRate: number | null;
  dropRateFromStart: number | null;
  averageSeconds: number | null;
}

export function funnelPercent(value: number | null): string {
  return value === null ? "—" : `${value.toFixed(1)}%`;
}

export function funnelDuration(seconds: number | null): string {
  if (seconds === null) return "—";
  if (seconds < 1) return "<1s";
  const total = Math.round(seconds);
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const remaining = total % 60;
  if (days) return `${days}d${hours ? ` ${hours}h` : ""}`;
  if (hours) return `${hours}h${minutes ? ` ${minutes}m` : ""}`;
  if (minutes) return `${minutes}m${remaining ? ` ${remaining}s` : ""}`;
  return `${remaining}s`;
}
