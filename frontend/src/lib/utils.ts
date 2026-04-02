import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Parse a backend ISO timestamp string as UTC.
 *
 * Flask/SQLAlchemy returns naive UTC datetimes without a timezone suffix
 * (e.g. "2026-04-02T05:35:00"). JavaScript's Date constructor treats strings
 * without a timezone designator as **local time**, causing wrong diffs for
 * users outside UTC. This function appends "Z" when no offset is present so
 * the string is always interpreted as UTC, then converted to the local
 * timezone for display.
 */
export function parseUTC(iso: string | null | undefined): Date {
  if (!iso) return new Date(NaN);
  // Already has timezone info (ends with Z or contains +/- offset after time)
  const hasOffset = /[Z+\-]\d*$/.test(iso) || iso.endsWith("Z");
  return new Date(hasOffset ? iso : `${iso}Z`);
}
