// Server-compatible charts for the Cash Forecast page. Hand-drawn inline SVG,
// no client hooks and no chart library. All props are plain numbers/strings.
import type { ReactNode } from "react";
import { formatRupees } from "@/lib/money";

type ChartBucket = {
  label: string;
  inflow: number;
  outflow: number;
  closingCash: number;
};

type ChartOutflow = {
  category: string;
  amount: number;
};

type Props = {
  buckets: ChartBucket[];
  lowestCash: number;
  outflowItems: ChartOutflow[];
};

const FORECAST_CHARTS_CSS = `
@keyframes forecast-draw {
  from { stroke-dashoffset: 1; }
  to { stroke-dashoffset: 0; }
}
@keyframes forecast-grow {
  from { transform: scaleY(0); }
  to { transform: scaleY(1); }
}
.forecast-draw {
  stroke-dasharray: 1;
  stroke-dashoffset: 1;
  animation: forecast-draw 1.6s ease-out forwards;
}
.forecast-bar {
  transform-box: fill-box;
  transform-origin: 50% 100%;
  animation: forecast-grow 0.7s ease-out both;
}
@media (prefers-reduced-motion: reduce) {
  .forecast-draw {
    stroke-dasharray: none;
    stroke-dashoffset: 0;
    animation: none;
  }
  .forecast-bar {
    animation: none;
  }
}
`;

// SVG geometry shared by the two bar/line charts.
const W = 640;
const H = 280;
const PAD_L = 72;
const PAD_R = 20;
const PAD_T = 20;
const PAD_B = 36;
const PLOT_W = W - PAD_L - PAD_R;
const PLOT_H = H - PAD_T - PAD_B;

const EMERALD = "#10b981";
const ROSE = "#f43f5e";
const PALETTE = ["#10b981", "#f59e0b", "#0ea5e9", "#8b5cf6", "#f43f5e", "#78716c"];

// Compact rupee label for axis ticks: ₹5L, ₹50k, ₹1.2Cr.
function compactRupees(n: number): string {
  const sign = n < 0 ? "-" : "";
  const a = Math.abs(n);
  const trim = (x: number) => Number(x.toFixed(1)).toString();
  if (a >= 10000000) return `${sign}₹${trim(a / 10000000)}Cr`;
  if (a >= 100000) return `${sign}₹${trim(a / 100000)}L`;
  if (a >= 1000) return `${sign}₹${trim(a / 1000)}k`;
  return `${sign}₹${Math.round(a)}`;
}

// Rounds a raw step up to a 1, 2, 2.5, 5 or 10 multiple of a power of ten.
function niceStep(raw: number): number {
  const base = Math.pow(10, Math.floor(Math.log10(raw)));
  const f = raw / base;
  const nice = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10;
  return nice * base;
}

// Nice axis bounds and tick values covering all values. Guards against a
// zero range so the scale never divides by zero.
function makeScale(values: number[]): { lo: number; hi: number; ticks: number[] } {
  const min = Math.min(...values);
  let max = Math.max(...values);
  if (!(max > min)) max = min + 1;
  const step = niceStep((max - min) / 4);
  const lo = Math.floor(min / step) * step;
  let hi = Math.ceil(max / step) * step;
  if (hi <= lo) hi = lo + step;
  const ticks: number[] = [];
  for (let t = lo; t <= hi + step / 2; t += step) ticks.push(t);
  return { lo, hi, ticks };
}

function scaleY(sc: { lo: number; hi: number }, v: number): number {
  return PAD_T + ((sc.hi - v) / (sc.hi - sc.lo)) * PLOT_H;
}

function ChartCard({
  title,
  subtitle,
  className = "",
  children,
}: {
  title: string;
  subtitle: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      className={`rounded-2xl border border-stone-200 bg-white p-5 shadow-sm md:p-6 ${className}`}
    >
      <h2 className="text-lg font-semibold text-stone-900">{title}</h2>
      <p className="text-sm text-stone-500">{subtitle}</p>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function EmptyNote({ text }: { text: string }) {
  return <p className="py-10 text-center text-sm text-stone-500">{text}</p>;
}

// Break mark and exact-amount label for a bar cut off at the top of the scale.
function ClippedMark({ x, w, label }: { x: number; w: number; label: string }) {
  return (
    <g>
      <path
        d={`M${x - 1} ${PAD_T + 14} l${w + 2} -5 M${x - 1} ${PAD_T + 20} l${w + 2} -5`}
        stroke="#ffffff"
        strokeWidth={2}
        strokeLinecap="round"
      />
      <text x={x + w / 2} y={PAD_T - 4} textAnchor="middle" fontSize={10} fontWeight={600} fill="#44403c">
        {label}
      </text>
    </g>
  );
}

export default function ForecastCharts({ buckets, lowestCash, outflowItems }: Props) {
  const n = buckets.length;

  // ----- Chart 1: cash balance area + line -----
  let cashChart;
  if (n === 0) {
    cashChart = <EmptyNote text="No weekly forecast data yet (Abhi koi data nahi)" />;
  } else {
    const sc = makeScale([0, ...buckets.map((b) => b.closingCash)]);
    const xOf = (i: number) => (n === 1 ? PAD_L + PLOT_W / 2 : PAD_L + (i * PLOT_W) / (n - 1));
    const yOf = (v: number) => scaleY(sc, v);
    const points = buckets.map((b, i) => ({ x: xOf(i), y: yOf(b.closingCash) }));
    const linePath = points
      .map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
      .join(" ");
    const baseY = yOf(0);
    const areaPath = `${linePath} L${xOf(n - 1).toFixed(1)} ${baseY.toFixed(1)} L${xOf(0).toFixed(1)} ${baseY.toFixed(1)} Z`;

    let minIdx = 0;
    buckets.forEach((b, i) => {
      if (b.closingCash < buckets[minIdx].closingCash) minIdx = i;
    });
    const low = points[minIdx];
    const labelAbove = low.y - 14 > PAD_T + 2;
    const labelY = labelAbove ? low.y - 12 : low.y + 20;
    const labelX = Math.min(Math.max(low.x, PAD_L + 70), W - PAD_R - 70);

    cashChart = (
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        className="h-auto"
        role="img"
        aria-label="Cash balance over 13 weeks line chart"
      >
        <defs>
          <linearGradient id="forecast-cash-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={EMERALD} stopOpacity="0.35" />
            <stop offset="100%" stopColor={EMERALD} stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Gridlines and Y-axis labels */}
        {sc.ticks.map((t) => (
          <g key={`g-${t}`}>
            <line
              x1={PAD_L}
              x2={W - PAD_R}
              y1={yOf(t)}
              y2={yOf(t)}
              stroke="#e7e5e4"
              strokeWidth={1}
            />
            <text x={PAD_L - 8} y={yOf(t) + 4} textAnchor="end" fontSize={11} fill="#78716c">
              {compactRupees(t)}
            </text>
          </g>
        ))}

        {/* Red dashed zero line, only when some balance is below zero */}
        {sc.lo < 0 ? (
          <line
            x1={PAD_L}
            x2={W - PAD_R}
            y1={baseY}
            y2={baseY}
            stroke="#dc2626"
            strokeWidth={1.5}
            strokeDasharray="6 4"
          />
        ) : null}

        {/* Area fill and animated line */}
        <path d={areaPath} fill="url(#forecast-cash-grad)" />
        <path
          d={linePath}
          fill="none"
          stroke={EMERALD}
          strokeWidth={3}
          strokeLinejoin="round"
          strokeLinecap="round"
          pathLength={1}
          className="forecast-draw"
        />

        {/* Data points with tooltips */}
        {buckets.map((b, i) => (
          <circle
            key={`p-${b.label}`}
            cx={points[i].x}
            cy={points[i].y}
            r={4}
            fill="#ffffff"
            stroke="#059669"
            strokeWidth={2}
          >
            <title>{`${b.label}: ${formatRupees(b.closingCash)}`}</title>
          </circle>
        ))}

        {/* Lowest point marker */}
        <circle cx={low.x} cy={low.y} r={6} fill={ROSE} stroke="#ffffff" strokeWidth={2}>
          <title>{`Lowest: ${formatRupees(lowestCash)}`}</title>
        </circle>
        <text
          x={labelX}
          y={labelY}
          textAnchor="middle"
          fontSize={12}
          fontWeight={600}
          fill="#be123c"
        >
          {`Lowest ${formatRupees(lowestCash)}`}
        </text>

        {/* X-axis week labels */}
        {buckets.map((_, i) => (
          <text
            key={`x-${i}`}
            x={xOf(i)}
            y={H - PAD_B + 18}
            textAnchor="middle"
            fontSize={11}
            fill="#78716c"
          >
            {`W${i + 1}`}
          </text>
        ))}
      </svg>
    );
  }

  // ----- Chart 2: grouped inflow vs outflow bars -----
  let barChart;
  if (n === 0) {
    barChart = <EmptyNote text="No weekly forecast data yet (Abhi koi data nahi)" />;
  } else {
    // Bar-only scale: the 90th percentile of the non-zero values sets the top
    // (times 1.5), so one outlier week cannot flatten the rest. Bars above it
    // are cut off at the plot top and labelled with their exact amount.
    const nonZero = buckets
      .flatMap((b) => [b.inflow, b.outflow])
      .filter((v) => v !== 0)
      .sort((a, b) => a - b);
    const p90 = nonZero.length > 0 ? nonZero[Math.floor(0.9 * (nonZero.length - 1))] : 0;
    const barMax = nonZero.length > 0 ? Math.max(p90 * 1.5, 1) : 1;
    const barStep = niceStep(barMax / 4);
    const barHi = Math.ceil(barMax / barStep) * barStep;
    const barTicks: number[] = [];
    for (let t = 0; t <= barHi + barStep / 2; t += barStep) barTicks.push(t);
    const sc = { lo: 0, hi: barHi };
    const yOf = (v: number) => scaleY(sc, v);
    const isClipped = (v: number) => v > barMax;
    const barTopY = (v: number) => (isClipped(v) ? PAD_T : yOf(Math.max(0, v)));
    const clippedCount = buckets.reduce(
      (c, b) => c + (isClipped(b.inflow) ? 1 : 0) + (isClipped(b.outflow) ? 1 : 0),
      0,
    );
    const baseY = yOf(0);
    const groupW = PLOT_W / n;
    const barW = Math.min(18, groupW * 0.3);

    barChart = (
      <>
        {clippedCount > 0 ? (
          <p className="mb-2 text-xs text-stone-500">
            Bars above the scale are cut off; their exact amounts are labelled (Scale se bahar ki rakam ka label dekhiye)
          </p>
        ) : null}
        <div className="mb-2 flex flex-wrap gap-4 text-sm text-stone-700">
          <span className="inline-flex items-center gap-2">
            <span className="inline-block h-3 w-3 rounded-sm bg-emerald-500" />
            Inflow (Aaya)
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="inline-block h-3 w-3 rounded-sm bg-rose-500" />
            Outflow (Gaya)
          </span>
        </div>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          width="100%"
          className="h-auto"
          role="img"
          aria-label="Inflow versus outflow per week bar chart"
        >
          {barTicks.map((t) => (
            <g key={`g-${t}`}>
              <line
                x1={PAD_L}
                x2={W - PAD_R}
                y1={yOf(t)}
                y2={yOf(t)}
                stroke="#e7e5e4"
                strokeWidth={1}
              />
              <text x={PAD_L - 8} y={yOf(t) + 4} textAnchor="end" fontSize={11} fill="#78716c">
                {compactRupees(t)}
              </text>
            </g>
          ))}

          {buckets.map((b, i) => {
            const cx = PAD_L + i * groupW + groupW / 2;
            const inX = cx - barW - 2;
            const outX = cx + 2;
            const inH = Math.max(0, baseY - barTopY(b.inflow));
            const outH = Math.max(0, baseY - barTopY(b.outflow));
            const delay = `${i * 60}ms`;
            return (
              <g key={`bar-${b.label}`}>
                <rect
                  className="forecast-bar"
                  style={{ animationDelay: delay }}
                  x={inX}
                  y={baseY - inH}
                  width={barW}
                  height={inH}
                  rx={3}
                  fill={EMERALD}
                >
                  <title>{`${b.label} · Inflow: ${formatRupees(b.inflow)}`}</title>
                </rect>
                <rect
                  className="forecast-bar"
                  style={{ animationDelay: delay }}
                  x={outX}
                  y={baseY - outH}
                  width={barW}
                  height={outH}
                  rx={3}
                  fill={ROSE}
                >
                  <title>{`${b.label} · Outflow: ${formatRupees(b.outflow)}`}</title>
                </rect>
                {isClipped(b.inflow) ? (
                  <ClippedMark x={inX} w={barW} label={formatRupees(b.inflow)} />
                ) : null}
                {isClipped(b.outflow) ? (
                  <ClippedMark x={outX} w={barW} label={formatRupees(b.outflow)} />
                ) : null}
                <text
                  x={cx}
                  y={H - PAD_B + 18}
                  textAnchor="middle"
                  fontSize={11}
                  fill="#78716c"
                >
                  {`W${i + 1}`}
                </text>
              </g>
            );
          })}
          <line x1={PAD_L} x2={W - PAD_R} y1={baseY} y2={baseY} stroke="#a8a29e" strokeWidth={1} />
        </svg>
      </>
    );
  }

  // ----- Chart 3: donut of outflow by category -----
  const totals = new Map<string, number>();
  for (const item of outflowItems) {
    totals.set(item.category, (totals.get(item.category) ?? 0) + item.amount);
  }
  const slices = Array.from(totals.entries())
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1]);
  const total = slices.reduce((sum, [, v]) => sum + v, 0);

  let donutChart;
  if (slices.length === 0 || total <= 0) {
    donutChart = <EmptyNote text="No upcoming expenses (Koi kharch nahi)" />;
  } else {
    const R = 70;
    const STROKE = 26;
    const C = 2 * Math.PI * R;
    let offset = 0;
    donutChart = (
      <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-center">
        <svg
          viewBox="0 0 200 200"
          className="h-auto w-48 shrink-0"
          role="img"
          aria-label="Outflow by category donut chart"
        >
          {slices.map(([category, value], i) => {
            const len = (value / total) * C;
            const seg = (
              <circle
                key={`seg-${category}`}
                cx={100}
                cy={100}
                r={R}
                fill="none"
                stroke={PALETTE[i % PALETTE.length]}
                strokeWidth={STROKE}
                strokeDasharray={`${len} ${C - len}`}
                strokeDashoffset={-offset}
                transform="rotate(-90 100 100)"
              >
                <title>{`${category}: ${formatRupees(value)}`}</title>
              </circle>
            );
            offset += len;
            return seg;
          })}
          <text x={100} y={94} textAnchor="middle" fontSize={11} fill="#78716c">
            Total
          </text>
          <text x={100} y={114} textAnchor="middle" fontSize={13} fontWeight={700} fill="#1c1917">
            {formatRupees(total)}
          </text>
        </svg>

        <ul className="w-full flex-1 divide-y divide-stone-200">
          {slices.map(([category, value], i) => (
            <li key={`legend-${category}`} className="flex items-center justify-between gap-3 py-2 text-sm">
              <span className="flex items-center gap-2 font-medium text-stone-800">
                <span
                  className="inline-block h-3 w-3 rounded-sm"
                  style={{ backgroundColor: PALETTE[i % PALETTE.length] }}
                />
                {category}
              </span>
              <span className="text-right text-stone-600">
                {formatRupees(value)}{" "}
                <span className="text-stone-500">
                  ({((value / total) * 100).toFixed(1)}%)
                </span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <style dangerouslySetInnerHTML={{ __html: FORECAST_CHARTS_CSS }} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ChartCard
          title="Cash balance over 13 weeks (Nakad balance)"
          subtitle="Closing cash at the end of each week"
          className="lg:col-span-2"
        >
          {cashChart}
        </ChartCard>

        <ChartCard
          title="Inflow vs outflow per week (Aaya vs Gaya)"
          subtitle="Money coming in and going out, week by week"
        >
          {barChart}
        </ChartCard>

        <ChartCard
          title="Where the cash goes (Kharch ka breakdown)"
          subtitle="Upcoming expenses grouped by category"
        >
          {donutChart}
        </ChartCard>
      </div>
    </div>
  );
}
