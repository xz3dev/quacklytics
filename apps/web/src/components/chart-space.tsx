import { useLayoutEffect, useRef, useState, type ReactNode } from "react";

/** Share unused viewport height between plots, leaving room for their tables and legends. */
export function ChartSpace({
  minimum = 240,
  children,
}: {
  minimum?: number;
  children: (height: number) => ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(minimum);

  useLayoutEffect(() => {
    const element = ref.current;
    const dashboardCard = element?.closest("[data-dashboard-card]");
    const layout = dashboardCard
      ? element?.closest("[data-insight-content]")
      : element?.closest("[data-chart-layout]");
    if (!element || !layout) {
      setHeight(minimum);
      return;
    }
    let frame = 0;
    const measure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (dashboardCard?.getAttribute("data-dashboard-card") === "auto") {
          setHeight(minimum);
          return;
        }
        const plots = Array.from(
          layout.querySelectorAll("[data-chart-minimum]"),
        );
        const rendered = plots.reduce(
          (sum, plot) => sum + plot.getBoundingClientRect().height,
          0,
        );
        const minimums = plots.reduce(
          (sum, plot) => sum + Number(plot.getAttribute("data-chart-minimum")),
          0,
        );
        const bounds = layout.getBoundingClientRect();
        // Document coordinates keep scrolling from changing the chart size.
        const available = dashboardCard
          ? dashboardCard.clientHeight -
            (bounds.top -
              dashboardCard.getBoundingClientRect().top +
              (layout.parentElement?.scrollTop ?? 0)) -
            1
          : window.innerHeight - (bounds.top + window.scrollY) - 24;
        const extra = Math.max(
          0,
          available - (bounds.height - rendered) - minimums,
        );
        setHeight(Math.floor(minimum + extra / Math.max(1, plots.length)));
      });
    };
    const observer = new ResizeObserver(measure);
    observer.observe(layout);
    if (dashboardCard) observer.observe(dashboardCard);
    if (layout.parentElement) observer.observe(layout.parentElement);
    observer.observe(element);
    window.addEventListener("resize", measure);
    measure();
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
      cancelAnimationFrame(frame);
    };
  }, [minimum]);

  return (
    <div
      ref={ref}
      data-chart-minimum={minimum}
      className="min-w-0"
      style={{ height }}
    >
      {children(height)}
    </div>
  );
}
