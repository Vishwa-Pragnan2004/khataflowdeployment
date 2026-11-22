"use client";

import React, { useState } from "react";

type TabKey = "cashForecast" | "overview";

const TABS: { key: TabKey; label: string; id: string }[] = [
  { key: "cashForecast", label: "Cash Forecast (Interactive)", id: "forecast-tab-cash" },
  { key: "overview", label: "Detailed Breakdown (Weekly)", id: "forecast-tab-overview" },
];

export default function ForecastTabs({
  overview,
  cashForecast,
}: {
  overview: React.ReactNode;
  cashForecast: React.ReactNode;
}) {
  const [active, setActive] = useState<TabKey>("cashForecast");

  const panelId = "forecast-tabpanel";
  const activeTab = TABS.find((t) => t.key === active)!;

  return (
    <div className="mx-auto max-w-5xl space-y-4 px-2 py-4 sm:px-4">
      <div role="tablist" aria-label="Forecast views" className="grid grid-cols-2 gap-2">
        {TABS.map((t) => {
          const selected = active === t.key;
          return (
            <button
              key={t.key}
              id={t.id}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={panelId}
              tabIndex={selected ? 0 : -1}
              onClick={() => setActive(t.key)}
              className={
                "min-h-[44px] rounded-xl px-3 font-medium transition-colors focus-visible:outline-2 focus-visible:outline-indigo-600 focus-visible:outline-offset-2 " +
                (selected
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "border border-stone-300 bg-white text-stone-700 hover:bg-stone-50")
              }
            >
              {t.label}
            </button>
          );
        })}
      </div>

      <div role="tabpanel" id={panelId} aria-labelledby={activeTab.id}>
        {active === "cashForecast" ? cashForecast : overview}
      </div>
    </div>
  );
}
