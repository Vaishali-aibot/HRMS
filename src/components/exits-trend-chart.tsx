"use client";

import { useState } from "react";

type Point = { label: string; count: number };

const CHART_W = 760;
const CHART_H = 120;
const BAR_W = 24;
const RADIUS = 4;

/** Rounded-top, square-bottom bar path — plain SVG <rect rx> rounds every
 * corner, so the baseline needs a hand-built path instead. */
function barPath(x: number, yTop: number, height: number, width: number) {
  const yBase = yTop + height;
  const r = Math.min(RADIUS, height, width / 2);
  if (height <= 0) return "";
  return [
    `M ${x} ${yBase}`,
    `L ${x} ${yTop + r}`,
    `Q ${x} ${yTop} ${x + r} ${yTop}`,
    `L ${x + width - r} ${yTop}`,
    `Q ${x + width} ${yTop} ${x + width} ${yTop + r}`,
    `L ${x + width} ${yBase}`,
    "Z",
  ].join(" ");
}

/**
 * Single-series column chart for exits over the last 12 months. One hue
 * (primary) — no legend needed. The month with the most exits gets a
 * direct label; every other bar's value lives in the hover/focus tooltip,
 * per "never a number on every point."
 */
export function ExitsTrendChart({ data }: { data: Point[] }) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const maxCount = Math.max(1, ...data.map((d) => d.count));
  const peakIndex = data.reduce(
    (best, d, i) => (d.count > data[best].count ? i : best),
    0
  );
  const slotW = CHART_W / data.length;

  const active = activeIndex != null ? data[activeIndex] : null;
  const activeX = activeIndex != null ? activeIndex * slotW + slotW / 2 : 0;
  const activeBarTop =
    activeIndex != null ? CHART_H - (data[activeIndex].count / maxCount) * (CHART_H - 16) : 0;

  return (
    <div className="w-full overflow-x-auto">
      <svg
        viewBox={`0 -28 ${CHART_W} ${CHART_H + 44}`}
        className="h-auto w-full min-w-[480px]"
        role="img"
        aria-label="Exits per month, last 12 months"
      >
        {/* baseline — recessive hairline */}
        <line
          x1={0}
          y1={CHART_H}
          x2={CHART_W}
          y2={CHART_H}
          stroke="var(--border)"
          strokeWidth={1}
        />

        {data.map((d, i) => {
          const barHeight = (d.count / maxCount) * (CHART_H - 16);
          const x = i * slotW + (slotW - BAR_W) / 2;
          const yTop = CHART_H - barHeight;
          const isActive = activeIndex === i;
          const isPeak = i === peakIndex && d.count > 0;

          return (
            <g key={d.label}>
              {/* hit target — bigger than the mark */}
              <rect
                x={i * slotW}
                y={-28}
                width={slotW}
                height={CHART_H + 28}
                fill="transparent"
                tabIndex={0}
                role="img"
                aria-label={`${d.label}: ${d.count} exit${d.count === 1 ? "" : "s"}`}
                onPointerEnter={() => setActiveIndex(i)}
                onPointerLeave={() => setActiveIndex(null)}
                onFocus={() => setActiveIndex(i)}
                onBlur={() => setActiveIndex(null)}
                className="outline-none"
              />
              <path
                d={barPath(x, yTop, Math.max(barHeight, d.count > 0 ? 2 : 0), BAR_W)}
                fill="var(--primary)"
                opacity={isActive ? 1 : 0.85}
              />
              {isPeak && (
                <text
                  x={i * slotW + slotW / 2}
                  y={yTop - 6}
                  textAnchor="middle"
                  className="fill-muted-foreground text-[10px] tabular-nums"
                >
                  {d.count}
                </text>
              )}
              <text
                x={i * slotW + slotW / 2}
                y={CHART_H + 14}
                textAnchor="middle"
                className="fill-muted-foreground text-[10px]"
              >
                {d.label}
              </text>
            </g>
          );
        })}

        {active && (
          <g transform={`translate(${activeX}, ${activeBarTop - 10})`}>
            <rect
              x={-26}
              y={-20}
              width={52}
              height={18}
              rx={4}
              fill="var(--popover)"
              stroke="var(--border)"
              strokeWidth={1}
            />
            <text
              x={0}
              y={-7}
              textAnchor="middle"
              className="fill-foreground text-[10px] font-medium tabular-nums"
            >
              {active.count}
            </text>
          </g>
        )}
      </svg>
    </div>
  );
}
