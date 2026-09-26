import { z } from "zod";

// Grid density and card defaults live here so the client and API agree.
// Rows grow beyond the initial canvas to accommodate larger dashboards.
export const DASHBOARD_GRID = {
  columns: 12,
  rows: 12,
  rowHeight: 56,
  gap: 16,
  minWidth: 3,
  minHeight: 4,
  defaultWidth: 6,
  defaultHeight: 6,
};

export const dashboardGridItem = z
  .object({
    insightId: z.number().int().positive(),
    x: z.number().int().min(0),
    y: z.number().int().min(0).max(10000),
    w: z
      .number()
      .int()
      .min(DASHBOARD_GRID.minWidth)
      .max(DASHBOARD_GRID.columns),
    h: z.number().int().min(DASHBOARD_GRID.minHeight).max(100),
  })
  .refine(
    (item) => item.x + item.w <= DASHBOARD_GRID.columns,
    "Card exceeds grid width",
  );
export type DashboardGridItem = z.infer<typeof dashboardGridItem>;

export function gridItemsOverlap(a: DashboardGridItem, b: DashboardGridItem) {
  return (
    a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
  );
}

export const dashboardLayout = z
  .array(dashboardGridItem)
  .max(1000)
  .superRefine((items, ctx) => {
    for (const [index, item] of items.entries()) {
      if (
        items
          .slice(0, index)
          .some(
            (other) =>
              other.insightId === item.insightId ||
              gridItemsOverlap(item, other),
          )
      ) {
        ctx.addIssue({
          code: "custom",
          message: "Layout contains duplicate or overlapping insights",
          path: [index],
        });
      }
    }
  });

/** Preserve saved placements and put new insights in the first free grid cells. */
export function resolveDashboardLayout(
  insightIds: number[],
  saved: DashboardGridItem[] = [],
) {
  const items = saved.filter((item) => insightIds.includes(item.insightId));
  for (const insightId of insightIds) {
    if (items.some((item) => item.insightId === insightId)) continue;
    const item = {
      insightId,
      x: 0,
      y: 0,
      w: DASHBOARD_GRID.defaultWidth,
      h: DASHBOARD_GRID.defaultHeight,
    };
    while (items.some((other) => gridItemsOverlap(item, other))) {
      item.x += 1;
      if (item.x + item.w > DASHBOARD_GRID.columns) {
        item.x = 0;
        item.y += 1;
      }
    }
    items.push(item);
  }
  return items;
}

/** Keep the edited card in place and push collisions down without losing cards. */
export function placeDashboardItem(
  items: DashboardGridItem[],
  changed: DashboardGridItem,
) {
  const placed = [changed];
  for (const original of items
    .filter((item) => item.insightId !== changed.insightId)
    .sort((a, b) => a.y - b.y || a.x - b.x)) {
    const item = { ...original };
    let collision = placed.find((other) => gridItemsOverlap(item, other));
    while (collision) {
      item.y = collision.y + collision.h;
      collision = placed.find((other) => gridItemsOverlap(item, other));
    }
    placed.push(item);
  }
  return items.map(
    (item) =>
      placed.find((other) => other.insightId === item.insightId) ?? item,
  );
}
