import { useEffect, useRef, useState, type PointerEvent } from "react";
import {
  DASHBOARD_GRID as grid,
  placeDashboardItem,
  type DashboardGridItem,
} from "@quacklytics/contracts";
import {
  InsightCard,
  type InsightTimeOverrides,
} from "@/app/insights/insight-card";
import type { Insight } from "@/model/insights/insight";

type Action = "move" | "left" | "right" | "top" | "bottom";
const edges: { action: Exclude<Action, "move">; className: string }[] = [
  { action: "left", className: "-left-1 top-3 bottom-3 w-2 cursor-ew-resize" },
  {
    action: "right",
    className: "-right-1 top-3 bottom-3 w-2 cursor-ew-resize",
  },
  { action: "top", className: "-top-1 left-3 right-3 h-2 cursor-ns-resize" },
  {
    action: "bottom",
    className: "-bottom-1 left-3 right-3 h-2 cursor-ns-resize",
  },
];
const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

function transform(
  item: DashboardGridItem,
  action: Action,
  dx: number,
  dy: number,
) {
  const next = { ...item };
  if (action === "move") {
    next.x = clamp(item.x + dx, 0, grid.columns - item.w);
    next.y = clamp(item.y + dy, 0, 10000);
  } else if (action === "right") {
    next.w = clamp(item.w + dx, grid.minWidth, grid.columns - item.x);
  } else if (action === "left") {
    next.w = clamp(item.w - dx, grid.minWidth, item.x + item.w);
    next.x = item.x + item.w - next.w;
  } else if (action === "bottom") {
    next.h = clamp(item.h + dy, grid.minHeight, 100);
  } else {
    next.h = clamp(item.h - dy, grid.minHeight, Math.min(100, item.y + item.h));
    next.y = item.y + item.h - next.h;
  }
  return next;
}

export function DashboardGrid({
  insights,
  layout,
  editing,
  onChange,
  timeOverrides,
}: {
  insights: Insight[];
  layout: DashboardGridItem[];
  editing: boolean;
  onChange: (layout: DashboardGridItem[]) => void;
  timeOverrides: InsightTimeOverrides;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const gesture = useRef<{
    item: DashboardGridItem;
    action: Action;
    x: number;
    y: number;
    layout: DashboardGridItem[];
  } | null>(null);
  const [active, setActive] = useState<number | null>(null);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new ResizeObserver(() => setWidth(element.clientWidth));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const stacked = width > 0 && width < 600 && !editing;
  const rows = Math.max(grid.rows, ...layout.map((item) => item.y + item.h));
  const start = (
    event: PointerEvent<HTMLButtonElement>,
    item: DashboardGridItem,
    action: Action,
  ) => {
    if (!editing || event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    gesture.current = {
      item,
      action,
      x: event.clientX,
      y: event.clientY,
      layout,
    };
    setActive(item.insightId);
  };
  const move = (event: PointerEvent<HTMLButtonElement>) => {
    const current = gesture.current;
    if (!current || !editing) return;
    const dx = Math.round(
      (event.clientX - current.x) / ((width + grid.gap) / grid.columns),
    );
    const dy = Math.round(
      (event.clientY - current.y) / (grid.rowHeight + grid.gap),
    );
    onChange(
      placeDashboardItem(
        current.layout,
        transform(current.item, current.action, dx, dy),
      ),
    );
  };
  const finish = () => {
    gesture.current = null;
    setActive(null);
  };
  const cancel = () => {
    if (gesture.current) onChange(gesture.current.layout);
    finish();
  };
  const controls = (item: DashboardGridItem, action: Action) => ({
    onPointerDown: (event: PointerEvent<HTMLButtonElement>) =>
      start(event, item, action),
    onPointerMove: move,
    onPointerUp: finish,
    onPointerCancel: cancel,
    onLostPointerCapture: finish,
  });
  return (
    <div
      ref={ref}
      role="region"
      aria-label="Dashboard layout"
      data-editing={editing}
      className={`grid min-w-0 ${editing ? "rounded-lg bg-muted/30 outline outline-1 outline-border" : ""}`}
      style={{
        gridTemplateColumns: `repeat(${stacked ? 1 : grid.columns}, minmax(0, 1fr))`,
        gridAutoRows: stacked ? "auto" : grid.rowHeight,
        gap: grid.gap,
        minHeight: editing
          ? rows * (grid.rowHeight + grid.gap) - grid.gap
          : undefined,
        backgroundImage: editing
          ? "linear-gradient(to right, hsl(var(--border)) 1px, transparent 1px), linear-gradient(to bottom, hsl(var(--border)) 1px, transparent 1px)"
          : undefined,
        backgroundSize: `${(width + grid.gap) / grid.columns}px ${grid.rowHeight + grid.gap}px`,
      }}
    >
      {layout.map((item) => {
        const insight = insights.find(
          (insight) => insight.id === item.insightId,
        );
        if (!insight) return null;
        return (
          <div
            key={item.insightId}
            data-testid={`dashboard-insight-${item.insightId}`}
            data-grid-x={item.x}
            data-grid-y={item.y}
            data-grid-width={item.w}
            data-grid-height={item.h}
            className={`relative min-w-0 min-h-0 ${editing ? "ring-1 ring-primary/40 rounded-lg" : ""}`}
            style={{
              gridColumn: stacked
                ? undefined
                : `${item.x + 1} / span ${item.w}`,
              gridRow: stacked ? undefined : `${item.y + 1} / span ${item.h}`,
              zIndex: active === item.insightId ? 20 : undefined,
            }}
          >
            <div
              className="h-full min-w-0 overflow-hidden rounded-lg"
              data-dashboard-card={stacked ? "auto" : "fixed"}
              inert={editing}
            >
              <InsightCard
                insightId={item.insightId}
                timeOverrides={timeOverrides}
              />
            </div>
            {editing && (
              <>
                <button
                  type="button"
                  aria-label={`Move ${insight.name}`}
                  title="Drag to move"
                  className="absolute inset-0 z-10 touch-none rounded-lg cursor-grab active:cursor-grabbing focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  {...controls(item, "move")}
                />
                {edges.map(({ action, className }) => (
                  <button
                    key={action}
                    type="button"
                    aria-label={`Resize ${insight.name} ${action} border`}
                    title="Drag to resize"
                    className={`absolute z-20 touch-none rounded hover:bg-primary/40 focus-visible:bg-primary/40 focus-visible:outline-none ${className}`}
                    {...controls(item, action)}
                  />
                ))}
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
