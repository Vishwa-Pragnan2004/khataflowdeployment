import { addDays, endOfMonthDay, startOfDay } from "./dates";

export const TERMS_CHOICES = ["ON_RECEIPT", "D7", "D15", "D30", "EOM", "CUSTOM"] as const;

export type TermsChoice = (typeof TERMS_CHOICES)[number];

export const TERMS_LABELS: Record<TermsChoice, string> = {
  ON_RECEIPT: "Due on receipt",
  D7: "7 days",
  D15: "15 days",
  D30: "30 days",
  EOM: "End of month",
  CUSTOM: "Custom date",
};

export function computeTermsDueDate(choice: TermsChoice, issueDate: Date, customDate?: Date): Date {
  switch (choice) {
    case "ON_RECEIPT":
      return startOfDay(issueDate);
    case "D7":
      return addDays(issueDate, 7);
    case "D15":
      return addDays(issueDate, 15);
    case "D30":
      return addDays(issueDate, 30);
    case "EOM":
      return endOfMonthDay(issueDate);
    case "CUSTOM":
      if (!customDate) {
        throw new Error("Custom date required");
      }
      return startOfDay(customDate);
  }
}

export function termsDaysFromDue(issueDate: Date, dueDate: Date): number {
  return Math.max(
    0,
    Math.round((startOfDay(dueDate).getTime() - startOfDay(issueDate).getTime()) / 86400000),
  );
}
