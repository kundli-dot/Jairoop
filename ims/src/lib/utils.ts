import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatNumber(num: number): string {
  return num.toLocaleString("en-IN");
}

export function formatCurrency(num: number): string {
  return "₹" + num.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function generateId(prefix: string): string {
  const now = new Date();
  const dateStr = now.getFullYear().toString() +
    String(now.getMonth() + 1).padStart(2, "0") +
    String(now.getDate()).padStart(2, "0");
  const rand = String(Math.floor(Math.random() * 999)).padStart(3, "0");
  return `${prefix}-${dateStr}-${rand}`;
}

export function todayStr(): string {
  return new Date().toISOString().split("T")[0];
}

export function getReorderStatus(closingBalance: number, minStockLevel: number): string {
  if (closingBalance <= minStockLevel) return "REORDER";
  if (closingBalance <= minStockLevel * 1.5) return "LOW";
  return "NORMAL";
}
