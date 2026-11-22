import { startOfDay } from "./dates";

export type BillStatus = "PAID" | "PARTIALLY_PAID" | "OVERDUE" | "UNPAID";

export function sumPayments(payments: { amount: number }[]): number {
  return payments.reduce((total, payment) => total + payment.amount, 0);
}

export function getBalance(totalAmount: number, paid: number): number {
  return totalAmount - paid;
}

export function getBillStatus(
  input: { totalAmount: number; dueDate: Date; payments: { amount: number }[] },
  today: Date,
): { status: BillStatus; paid: number; balance: number; isOverdue: boolean } {
  const paid = sumPayments(input.payments);
  const balance = getBalance(input.totalAmount, paid);

  let status: BillStatus;
  if (balance <= 0) {
    status = "PAID";
  } else if (startOfDay(input.dueDate).getTime() < startOfDay(today).getTime()) {
    status = "OVERDUE";
  } else if (paid > 0) {
    status = "PARTIALLY_PAID";
  } else {
    status = "UNPAID";
  }

  return { status, paid, balance, isOverdue: status === "OVERDUE" };
}
