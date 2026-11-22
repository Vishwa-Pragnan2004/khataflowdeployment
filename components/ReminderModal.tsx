
"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  prepareReminder,
  getReminderWarning,
  logReminder,

} from "@/app/actions";
import {
  buildWhatsAppLink,
  type ReminderTone,
} from "@/lib/whatsapp";

type ReminderLanguage = "EN" | "HI";

const TONE_OPTIONS: {
  value: ReminderTone;
  label: string;
}[] = [
  { value: "POLITE", label: "Polite (Due Soon)" },
  { value: "FIRM", label: "Firm (Overdue)" },
];

const LANGUAGE_OPTIONS: {
  value: ReminderLanguage;
  label: string;
}[] = [
  { value: "EN", label: "English" },
  { value: "HI", label: "Hinglish (Roman Hindi)" },
];

type ReminderModalProps = {
  billId: number;
  overdue: boolean;
};

type PendingSend = {
  warning: string;
  whatsappNumber: string;
};

export default function ReminderModal(
  props: ReminderModalProps
) {
  const { billId, overdue } = props;

  const router = useRouter();

  const defaultTone: ReminderTone = overdue
    ? "FIRM"
    : "POLITE";

  const [open, setOpen] = useState(false);

  const [tone, setTone] =
    useState<ReminderTone>(defaultTone);

  const [language, setLanguage] =
    useState<ReminderLanguage>("EN");

  const [draft, setDraft] = useState("");

  const [error, setError] = useState<string | null>(null);

  const [pendingSend, setPendingSend] =
    useState<PendingSend | null>(null);

  const [isSending, setIsSending] = useState(false);



  const [isLoading, startTransition] = useTransition();

  // Prevent overlapping requests and stale draft responses.
  const requestId = useRef(0);

  // Prevent duplicate send operations.
  const sendingRef = useRef(false);

  // Keep a reference to the WhatsApp popup.
  const whatsappWindowRef = useRef<Window | null>(null);

  function resetState() {
    requestId.current += 1;

    setTone(defaultTone);
    setLanguage("EN");
    setDraft("");
    setError(null);
    setPendingSend(null);
    setIsSending(false);

    sendingRef.current = false;

    whatsappWindowRef.current?.close();
    whatsappWindowRef.current = null;
  }

  function loadDraft(
    nextTone: ReminderTone,
    nextLanguage: ReminderLanguage
  ) {
    const currentRequest = ++requestId.current;

    setError(null);
    setDraft("");

    startTransition(async () => {
      try {
        const result = await prepareReminder({
          billId,
          tone: nextTone,
          language: nextLanguage,
        });

        // Ignore outdated requests.
        if (currentRequest !== requestId.current) {
          return;
        }

        if (!result.ok) {
          setError(result.error);
          return;
        }

        setDraft(result.data.message);

      } catch (err) {
        if (currentRequest !== requestId.current) {
          return;
        }

        console.error("Reminder preparation failed:", err);

        setError(
          "Unable to prepare reminder. Please try again."
        );
      }
    });
  }

  function openSheet() {
    resetState();

    setOpen(true);

    loadDraft(defaultTone, "EN");
  }

  function closeSheet() {
    resetState();
    setOpen(false);
  }

  function handleToneChange(nextTone: ReminderTone) {
    if (isSending) return;

    setTone(nextTone);
    setPendingSend(null);

    loadDraft(nextTone, language);
  }

  function handleLanguageChange(
    nextLanguage: ReminderLanguage
  ) {
    if (isSending) return;

    setLanguage(nextLanguage);
    setPendingSend(null);

    loadDraft(tone, nextLanguage);
  }

  async function sendViaWhatsApp(
    whatsappNumber: string
  ) {
    if (sendingRef.current) return;

    const popup = whatsappWindowRef.current;

    if (!popup || popup.closed) {
      setError(
        "WhatsApp could not be opened. Please try again."
      );
      return;
    }

    sendingRef.current = true;

    setIsSending(true);
    setError(null);

    try {
      const link = buildWhatsAppLink(
        whatsappNumber,
        draft
      );

      // Navigate the already-opened popup.
      popup.location.href = link;

      // Log the reminder after opening WhatsApp.
      const logResult = await logReminder({
        billId,
        tone,
        message: draft,
      });

      if (!logResult.ok) {
        setError(
          logResult.error ??
            "WhatsApp opened, but reminder logging failed."
        );

        return;
      }

      setPendingSend(null);
      setOpen(false);

      router.refresh();

    } catch (err) {
      console.error("Reminder sending failed:", err);

      setError(
        "Something went wrong. Please try again."
      );

    } finally {
      sendingRef.current = false;
      setIsSending(false);
      whatsappWindowRef.current = null;
    }
  }

  async function handleOpenWhatsApp() {
    if (sendingRef.current || isLoading) return;

    if (draft.trim() === "") {
      setError("Please enter a reminder message.");
      return;
    }

    setError(null);

    // Open popup immediately within the click event.
    const popup = window.open(
      "about:blank",
      "_blank"
    );

    if (!popup) {
      setError(
        "Please allow popups in your browser to open WhatsApp."
      );
      return;
    }

    whatsappWindowRef.current = popup;

    try {
      const check = await getReminderWarning(billId);

      if (!check.ok) {
        popup.close();
        whatsappWindowRef.current = null;

        setError(check.error);
        return;
      }

      if (check.data.warning !== null) {
        popup.close();
        whatsappWindowRef.current = null;

        setPendingSend({
          warning: check.data.warning,
          whatsappNumber: check.data.whatsappNumber,
        });

        return;
      }

      await sendViaWhatsApp(
        check.data.whatsappNumber
      );

    } catch (err) {
      popup.close();
      whatsappWindowRef.current = null;

      console.error("Reminder check failed:", err);

      setError(
        "Unable to check reminder status. Please try again."
      );
    }
  }

  async function handleConfirmSend() {
    if (
      pendingSend === null ||
      sendingRef.current
    ) {
      return;
    }

    const whatsappNumber =
      pendingSend.whatsappNumber;

    setPendingSend(null);

    // Confirmation is a separate click, so open a
    // fresh popup synchronously here.
    const popup = window.open(
      "about:blank",
      "_blank"
    );

    if (!popup) {
      setError(
        "Please allow popups in your browser to open WhatsApp."
      );

      return;
    }

    whatsappWindowRef.current = popup;

    await sendViaWhatsApp(whatsappNumber);
  }

  function handleCancelWarning() {
    setPendingSend(null);
    setError(null);
  }



  const isBusy = isLoading || isSending;

  const sendDisabled =
    draft.trim() === "" || isBusy;

  return (
    <>
      {/* Open reminder modal */}
      <button
        type="button"
        onClick={openSheet}
        className="min-h-14 w-full rounded-xl bg-green-700 text-lg font-semibold text-white"
      >
        Send Reminder (Yaad Dilao)
      </button>

      {open && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40 bg-black/40"
            onClick={closeSheet}
            aria-hidden="true"
          />

          {/* Modal */}
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="reminder-title"
            className="fixed bottom-0 left-0 right-0 z-50 mx-auto max-h-[90vh] max-w-md overflow-y-auto rounded-t-2xl bg-white p-5 pb-8 shadow-xl"
          >
            <h2
              id="reminder-title"
              className="mb-4 text-xl font-bold text-gray-900"
            >
              Send Reminder (Yaad Dilao)
            </h2>

            {/* Reminder tone */}
            <div className="mb-3 flex flex-wrap gap-2">
              {TONE_OPTIONS.map((option) => {
                const selected =
                  tone === option.value;

                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() =>
                      handleToneChange(option.value)
                    }
                    disabled={isBusy}
                    aria-pressed={selected}
                    className={
                      selected
                        ? "min-h-12 rounded-full bg-green-700 px-4 text-base font-medium text-white disabled:opacity-60"
                        : "min-h-12 rounded-full bg-stone-200 px-4 text-base font-medium text-gray-800 disabled:opacity-60"
                    }
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>

            {/* Language selection */}
            <div className="mb-4 flex flex-wrap gap-2">
              {LANGUAGE_OPTIONS.map((option) => {
                const selected =
                  language === option.value;

                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() =>
                      handleLanguageChange(option.value)
                    }
                    disabled={isBusy}
                    aria-pressed={selected}
                    className={
                      selected
                        ? "min-h-12 rounded-full bg-green-700 px-4 text-base font-medium text-white disabled:opacity-60"
                        : "min-h-12 rounded-full bg-stone-200 px-4 text-base font-medium text-gray-800 disabled:opacity-60"
                    }
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>

            {/* Reminder message */}
            <div className="mb-2">
              <textarea
                rows={5}
                value={draft}
                onChange={(e) =>
                  setDraft(e.target.value)
                }
                disabled={isBusy}
                aria-label="Reminder message"
                className="min-h-32 w-full rounded-xl border-2 border-stone-300 p-3 text-lg text-gray-900 focus:border-green-700 focus:outline-none disabled:opacity-60"
              />

              {isLoading && (
                <p className="mt-1 text-sm text-stone-500">
                  Loading reminder...
                </p>
              )}
            </div>

            <p className="mb-4 text-sm text-stone-500">
              You can edit this message before sending.
            </p>

            {/* Error */}
            {error && (
              <p
                role="alert"
                className="mb-4 text-sm text-red-600"
              >
                {error}
              </p>
            )}

            {/* Duplicate reminder warning */}
            {pendingSend !== null && (
              <div className="mb-4 rounded-xl bg-amber-50 p-3 text-amber-700">
                <p className="mb-3 text-base">
                  {pendingSend.warning}
                </p>

                <button
                  type="button"
                  onClick={handleConfirmSend}
                  disabled={isBusy}
                  className="mb-2 min-h-12 w-full rounded-xl bg-green-700 text-base font-semibold text-white disabled:opacity-60"
                >
                  Yes, send again
                </button>

                <button
                  type="button"
                  onClick={handleCancelWarning}
                  disabled={isBusy}
                  className="min-h-12 w-full text-base font-medium text-gray-700"
                >
                  Cancel (Radd karo)
                </button>
              </div>
            )}

            {/* WhatsApp button */}
            <button
              type="button"
              onClick={handleOpenWhatsApp}
              disabled={
                sendDisabled ||
                pendingSend !== null
              }
              className="min-h-14 w-full rounded-xl bg-green-700 text-lg font-semibold text-white disabled:opacity-60"
            >
              {isSending
                ? "Opening..."
                : isLoading
                  ? "Preparing..."
                  : "Open WhatsApp"}
            </button>


            {/* Cancel */}
            <button
              type="button"
              onClick={closeSheet}
              disabled={isSending}
              className="mt-3 min-h-14 w-full text-lg font-medium text-gray-700"
            >
              Cancel (Radd karo)
            </button>
          </div>
        </>
      )}
    </>
  );
}
