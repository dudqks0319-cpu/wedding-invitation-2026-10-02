import type { Invitation } from "@/types/invitation";

/** "김민준" → "민준" (두 글자 이하 이름은 그대로) */
export function givenName(full: string) {
  const name = full.trim();
  return name.length >= 3 ? name.slice(1) : name;
}

/** 표지/공유 문구에 쓰는 이름·행사명 모음 */
export function getDisplay(inv: Invitation) {
  if (inv.type === "wedding" && inv.wedding) {
    const { groom, bride } = inv.wedding;
    return {
      names: [groom.name, bride.name],
      shortNames: [givenName(groom.name), givenName(bride.name)],
      englishNames: [groom.englishName || "Groom", bride.englishName || "Bride"],
      eventKo: "결혼합니다",
      eventEn: "WEDDING DAY",
      scriptLine: "We're getting married",
      headline: `${groom.name} · ${bride.name}`,
      joiner: "&",
    };
  }
  if (inv.type === "dol" && inv.dol) {
    const { babyName, babyEnglishName } = inv.dol;
    return {
      names: [babyName],
      shortNames: [givenName(babyName)],
      englishNames: [babyEnglishName || "Baby"],
      eventKo: "첫 돌잔치",
      eventEn: "FIRST BIRTHDAY",
      scriptLine: "Happy 1st Birthday",
      headline: `${givenName(babyName)}의 첫 생일`,
      joiner: "",
    };
  }
  const party = inv.party ?? { honoreeName: "", eventName: "잔치", hostName: "" };
  return {
    names: [party.honoreeName],
    shortNames: [party.honoreeName],
    englishNames: ["Celebration"],
    eventKo: `${party.eventName} 잔치`,
    eventEn: "BIRTHDAY CELEBRATION",
    scriptLine: "Happy Birthday",
    headline: `${party.honoreeName} ${party.eventName}연`,
    joiner: "",
  };
}

export type Display = ReturnType<typeof getDisplay>;
