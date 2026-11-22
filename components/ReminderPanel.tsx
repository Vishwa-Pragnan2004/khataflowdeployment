"use client";

import { useEffect, useState, useTransition } from "react";
import { logReminder, prepareReminder } from "@/app/actions";
import type { ReminderTone } from "@/lib/whatsapp";

export default function ReminderPanel(props: { billId: number; overdue: boolean }) {
  const { billId, overdue } = props;
  const defaultTone: ReminderTone = overdue ? "FIRM" : "POLITE";

  const [tone, setTone] = useState<ReminderTone>(defaultTone);
  const [message, setMessage] = useState<string>("");
  const [waLink, setWaLink] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [copied, setCopied] = useState<boolean>(false);

  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;
    prepareReminder({ billId, tone: defaultTone }).then((res) => {
      if (cancelled) return;
      if (res.ok) {
        setMessage(res.data.message);
        setWaLink(res.data.waLink);
        setError("");
      } else {
        setError(res.error);
      }
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [billId]);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  function changeTone(next: ReminderTone) {
    setTone(next);
    startTransition(async () => {
      const res = await prepareReminder({ billId, tone: next });
      if (res.ok) {
        setMessage(res.data.message);
        setWaLink(res.data.waLink);
        setError("");
      } else {
        setError(res.error);
      }
    });
  }

  function handleCopy() {
    if (!message) return;
    void navigator.clipboard.writeText(message);
    setCopied(true);
  }


  function handleOpenWhatsApp() {
    if (!waLink) return;
    window.open(waLink, "_blank", "noopener");
    void logReminder({ billId, tone, channel: "WHATSAPP", message });
  }

  const chipBase = "min-h-14 flex-1 rounded-xl px-4 text-lg font-semibold";
  const chipOn = "bg-green-700 text-white";
  const chipOff = "bg-stone-200";

  return (
    <section className="space-y-4">
      <h2 className="text-xl font-bold text-stone-900">Send Reminder (Yaad Dilao)</h2>

      <div className="flex gap-3">
        <button
          type="button"
          disabled={isPending}
          onClick={() => changeTone("POLITE")}
          className={`${chipBase} ${tone === "POLITE" ? chipOn : chipOff}`}
        >
          Polite (Due Soon)
        </button>
        <button
          type="button"
          disabled={isPending}
          onClick={() => changeTone("FIRM")}
          className={`${chipBase} ${tone === "FIRM" ? chipOn : chipOff}`}
        >
          Firm (Overdue)
        </button>
      </div>

      <div className="rounded-xl border bg-stone-100 p-4 text-base whitespace-pre-line">
        {message ? (
          message
        ) : error ? (
          <span className="text-red-600">{error}</span>
        ) : (
          "Message loading..."
        )}
      </div>

      <button
        type="button"
        onClick={handleCopy}
        disabled={!message}
        className="min-h-14 w-full rounded-xl bg-stone-200 text-lg font-semibold text-stone-900"
      >
        {copied ? "Copied (Copy ho gaya)" : "Copy Message (Message Copy Karo)"}
      </button>

      <button
        type="button"
        onClick={handleOpenWhatsApp}
        disabled={!message}
        className="min-h-14 w-full rounded-xl bg-green-700 text-lg font-semibold text-white disabled:opacity-50"
      >
        Open in WhatsApp (WhatsApp Kholo)
      </button>

    </section>
  );
}