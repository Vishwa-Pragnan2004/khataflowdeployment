"use client";

import { dayToDate } from "@/lib/cashforecast/forecast";

const money = (n: number) => (n < 0 ? "-" : "") + "\u20B9" + Math.abs(n).toLocaleString("en-IN");

const icon = (s: Scenario) => (s?.safe ? "\u2705" : "\u274C");
const short = (s: Scenario) =>
  s?.safe ? "safe" : s?.firstNegative ? `short on ${dayToDate(s.firstNegative.day)}` : "short";

function joinNames(fullNames: string[]) {
  const firsts = fullNames.map((n) => n.split(" ")[0]);
  const n = firsts.length;
  if (n === 0) return "";
  const top = firsts.slice(0, 3);
  if (n > 3) return `${top.join(", ")} and ${n - 3} others`;
  if (top.length === 1) return top[0];
  return `${top.slice(0, -1).join(", ")} and ${top[top.length - 1]}`;
}

export interface Scenario {
  safe: boolean;
  lowest: { day: number; balance: number };
  firstNegative: { day: number } | null;
}

interface VerdictProps {
  windowDays: number;
  chosen: Scenario;
  all: Record<30 | 60 | 90, Scenario>;
  tickedNames: string[];
  hasTicked: boolean;
  baseVerdict: Scenario;
  scenarioVerdict: Scenario;
  tickedTotal: number;
}

export default function Verdict({
  windowDays,
  chosen,
  all,
  tickedNames,
  hasTicked,
  baseVerdict,
  scenarioVerdict,
  tickedTotal,
}: VerdictProps) {
  const safe = chosen?.safe ?? true;
  const banner = safe
    ? "bg-emerald-50 border-emerald-300 text-emerald-900"
    : "bg-red-50 border-red-300 text-red-900";

  const shortOn = chosen?.firstNegative ? ` on ${dayToDate(chosen.firstNegative.day)}` : "";

  const lowestBal = chosen?.lowest?.balance ?? 0;
  const lowestDay = chosen?.lowest?.day ?? 0;

  const mainText = safe
    ? `You are safe for the next ${windowDays} days. Lowest cash: ${money(lowestBal)} on ${dayToDate(lowestDay)}.`
    : `Cash runs short${shortOn}. Lowest: ${money(lowestBal)} on ${dayToDate(lowestDay)}.`;

  const namesText = joinNames(tickedNames);
  const verdictSentence = safe
    ? `you are safe for the next ${windowDays} days`
    : `cash still runs short${shortOn}`;

  // Baseline status (before ticking)
  const baseSafe = baseVerdict?.safe ?? true;
  const baseShortOn = baseVerdict?.firstNegative
    ? ` on ${dayToDate(baseVerdict.firstNegative.day)}`
    : "";

  return (
    <div role="status" className={`rounded-2xl border p-4 ${banner}`}>
      {/* Baseline status (before ticking) */}
      {!hasTicked && (
        <>
          <p className="text-lg font-semibold">
            <span aria-hidden="true">{baseSafe ? "\u2705" : "\u274C"}</span>{" "}
            {baseSafe
              ? `You are safe for the next ${windowDays} days.`
              : `Cash runs short${baseShortOn}.`}
          </p>
          <p className="mt-1 text-sm">
            Tick an overdue or unpaid person below to see how much safer you become.
          </p>
        </>
      )}

      {/* Scenario status (after ticking) */}
      {hasTicked && (
        <>
          <p className="text-lg font-semibold">
            <span aria-hidden="true">{safe ? "\u2705" : "\u274C"}</span> {mainText}
          </p>

          {tickedTotal > 0 && (
            <p className="mt-1 text-sm">
              {`If ${namesText || "these customers"} pay you ${money(tickedTotal)}, ${verdictSentence}.`}
            </p>
          )}

          {/* Show improvement from baseline to scenario */}
          {baseVerdict && !baseVerdict.safe && scenarioVerdict?.safe && (
            <p className="mt-2 rounded-lg bg-emerald-100 px-3 py-2 text-sm font-medium text-emerald-900">
              {"\u{1F7E2} Ticking these payments makes you safe for the next {windowDays} days (was short{baseShortOn})."}
            </p>
          )}
          {baseVerdict && !baseVerdict.safe && scenarioVerdict && !scenarioVerdict.safe && scenarioVerdict.firstNegative && (
            <p className="mt-2 rounded-lg bg-amber-100 px-3 py-2 text-sm font-medium text-amber-900">
              {`\u{1F7E1} Still short${shortOn}, but the shortfall is smaller. Lowest cash improved from ${money(baseVerdict.lowest.balance)} to ${money(scenarioVerdict.lowest.balance)}.`}
            </p>
          )}

          {all && (
            <p className="mt-2 text-sm">
              {`30 days: ${all[30] ? icon(all[30]) + " " + short(all[30]) : ""} \u00B7 60 days: ${all[60] ? icon(all[60]) + " " + short(all[60]) : ""} \u00B7 90 days: ${all[90] ? icon(all[90]) + " " + short(all[90]) : ""}`}
            </p>
          )}

          {namesText && (
            <p className="mt-1 text-sm">{`If ${namesText} pay you, then ${verdictSentence}.`}</p>
          )}
        </>
      )}
    </div>
  );
}