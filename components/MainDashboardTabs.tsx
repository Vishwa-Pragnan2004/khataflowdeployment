"use client";

import { useCallback, useState } from "react";

export type DashboardTab = "receivables" | "forecast";

interface MainDashboardTabsProps {
  initialTab?: DashboardTab;
  receivablesView: React.ReactNode;
  forecastView: React.ReactNode;
}

const TABS: { key: DashboardTab; label: string; icon: string; id: string }[] = [
  { key: "receivables", label: "Udhaar Receivables", icon: "\uD83D\uDCC4", id: "tab-receivables" },
  { key: "forecast", label: "Cash Forecast", icon: "\uD83D\uDCC8", id: "tab-forecast" },
];

export default function MainDashboardTabs({
  initialTab = "receivables",
  receivablesView,
  forecastView,
}: MainDashboardTabsProps) {
  const [activeTab, setActiveTab] = useState<DashboardTab>(initialTab);

  const switchTab = useCallback((tab: DashboardTab) => {
    setActiveTab(tab);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      if (tab === "forecast") {
        url.searchParams.set("tab", "forecast");
      } else {
        url.searchParams.delete("tab");
      }
      window.history.replaceState({}, "", url.toString());
    }
  }, []);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    const idx = TABS.findIndex((t) => t.key === activeTab);
    const next = e.key === "ArrowRight"
      ? TABS[(idx + 1) % TABS.length]
      : TABS[(idx - 1 + TABS.length) % TABS.length];
    switchTab(next.key);
    document.getElementById(next.id)?.focus();
  };

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 p-4 sm:p-6">
      <nav
        role="tablist"
        aria-label="Main dashboard views"
        onKeyDown={onKeyDown}
        className="flex rounded-2xl border border-stone-200 bg-stone-100 p-1.5 shadow-inner"
      >
        {TABS.map((t) => {
          const selected = activeTab === t.key;
          return (
            <button
              key={t.key}
              type="button"
              role="tab"
              id={t.id}
              aria-selected={selected}
              aria-controls={`panel-${t.key}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => switchTab(t.key)}
              className={
                "flex flex-1 items-center justify-center gap-2 rounded-xl py-3 text-center text-sm font-semibold transition-all sm:text-base " +
                (selected
                  ? "bg-white text-stone-900 shadow-sm"
                  : "text-stone-600 hover:text-stone-900")
              }
            >
              <span aria-hidden="true">{t.icon}</span>
              <span>{t.label}</span>
            </button>
          );
        })}
      </nav>

      <div
        role="tabpanel"
        id={`panel-${activeTab}`}
        aria-labelledby={`tab-${activeTab}`}
        className="w-full"
      >
        {activeTab === "receivables" ? receivablesView : forecastView}
      </div>
    </main>
  );
}