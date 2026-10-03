import type { EventType, Theme } from "@/types/invitation";

export function favoriteDesigns(value: unknown, templates: Theme[]): string[] {
  if (!Array.isArray(value)) return [];
  const known = new Set(templates.map(t => t.id));
  return Array.from(new Set(value.filter((id): id is string => typeof id === "string" && known.has(id)))).slice(0, templates.length);
}

export function searchDesigns(templates: Theme[], filter: { type: EventType | "all"; tag: string | null; query: string; favorites?: string[] }) {
  const normalize = (s: string) => s.normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim();
  const words = normalize(filter.query).split(" ").filter(Boolean);
  return templates.filter(t => {
    if (filter.type !== "all" && t.category !== filter.type) return false;
    if (filter.tag && !t.tags.includes(filter.tag)) return false;
    if (filter.favorites && !filter.favorites.includes(t.id)) return false;
    const text = normalize([t.name, t.nameEn, t.description, ...t.tags].join(" "));
    return words.every(word => text.includes(word));
  });
}
