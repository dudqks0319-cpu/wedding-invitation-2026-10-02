import type { RsvpEntry } from "@/types/invitation";

export function summarizeRsvps(entries: RsvpEntry[]) {
  return entries.reduce((summary, entry) => {
    if (!entry.attending) return summary;
    summary.people += entry.count;
    if (entry.meal === "yes") summary.meals += entry.count;
    else if (entry.meal !== "no") summary.unknownMeals += entry.count;
    return summary;
  }, { people: 0, meals: 0, unknownMeals: 0 });
}
