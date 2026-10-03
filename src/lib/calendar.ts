import type { Invitation } from "@/types/invitation";
import { getDisplay } from "./display";

const escapeText = (value: string) => value.replace(/\\/g, "\\\\").replace(/\r\n|\r|\n/g, "\\n").replace(/;/g, "\\;").replace(/,/g, "\\,");

// Osamosam's RFC 5545 folding: 75 UTF-8 octets, including continuation space.
function foldLine(value: string) {
  const encoder = new TextEncoder();
  let result = "", size = 0;
  for (const character of value) {
    const bytes = encoder.encode(character).length;
    if (size + bytes > 75) { result += "\r\n "; size = 1; }
    result += character;
    size += bytes;
  }
  return result;
}

export function invitationCalendarFile(inv: Invitation, now = new Date()): string | null {
  const local = inv.dateTime;
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local)) return null;
  const start = new Date(local + "+09:00");
  const civil = new Date(local + "Z");
  if (!Number.isFinite(start.getTime()) || civil.toISOString().slice(0, 16) !== local || !Number.isFinite(now.getTime())) return null;
  const stamp = (date: Date) => date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  const d = getDisplay(inv);
  const title = `${d.names.join(" · ")} ${inv.type === "wedding" ? "결혼식" : inv.type === "dol" ? "돌잔치" : inv.party?.eventName ?? "잔치"}`;
  // Stable UID avoids a new identity on each download. No accounts, phones or guest data.
  const identity = /^[a-z0-9-]{3,30}$/.test(inv.slug) ? inv.slug : "invitation";
  return [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Invitation//Calendar//KO", "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT", `UID:${identity}@invitation`, `DTSTAMP:${stamp(now)}`, `DTSTART:${stamp(start)}`,
    `SUMMARY:${escapeText(title)}`,
    `LOCATION:${escapeText([inv.venue.name, inv.venue.address, inv.venue.hall].filter(Boolean).join(" "))}`,
    `DESCRIPTION:${escapeText([inv.venue.subway, inv.venue.bus, inv.venue.parking, inv.venue.car].filter(Boolean).join("\n"))}`,
    "END:VEVENT", "END:VCALENDAR", "",
  ].map(foldLine).join("\r\n");
}
