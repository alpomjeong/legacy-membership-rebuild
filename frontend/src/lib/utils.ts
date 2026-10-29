import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Tailwind-aware className 병합 헬퍼. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
