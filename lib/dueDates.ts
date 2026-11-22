import { addDays, endOfMonthDay, startOfDay } from "./dates";

export type DueChoice = "7d" | "15d" | "EOM" | "custom";

export const DEFAULT_DUE_CHOICE: DueChoice = "15d";

export function computeDueDate(choice: DueChoice, today: Date, customDate?: Date): Date {
  switch (choice) {
    case "7d":
      return addDays(today, 7);
    case "15d":
      return addDays(today, 15);
    case "EOM":
      return endOfMonthDay(today);
    case "custom":
      if (!customDate) {
        throw new Error("Custom date required");
      }
      return startOfDay(customDate);
  }
}
