import type { RsvpEntry } from "@/types/invitation";

const responseDate = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit",
  hour: "2-digit", minute: "2-digit", hourCycle: "h23",
});

function csvCell(value: string | number) {
  const text = String(value);
  // A visible text prefix remains harmless after spreadsheet save/reopen.
  // Quote escaping alone does not prevent spreadsheet formula execution.
  const formulaLike = /^[\s\uFEFF]*[=+\-@＝＋－＠]/u.test(text) || /^[\t\r\n]/.test(text);
  return `"${(formulaLike ? `문자: ${text}` : text).replaceAll('"', '""')}"`;
}

function formatResponseDate(value: string) {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? responseDate.format(date) : "확인 필요";
}

/** Only the fields shown to the invitation owner; never IDs or session data. */
export function rsvpsToCsv(entries: readonly RsvpEntry[]) {
  const rows: (string | number)[][] = [
    ["이름", "측", "참석 여부", "참석 인원", "식사", "메모", "응답일 (한국 시간)"],
    ...entries.map((entry) => [
      entry.name,
      entry.side === "groom" ? "신랑측" : entry.side === "bride" ? "신부측" : "하객",
      entry.attending ? "참석" : "불참",
      entry.attending ? entry.count : 0,
      !entry.attending ? "해당 없음" : entry.meal === "yes" ? "예정" : entry.meal === "no" ? "안 함" : "미정",
      entry.memo ?? "",
      formatResponseDate(entry.createdAt),
    ]),
  ];
  // UTF-8 BOM lets spreadsheet apps identify Korean text; CRLF separates rows.
  return "\uFEFF" + rows.map((row) => row.map(csvCell).join(",")).join("\r\n") + "\r\n";
}
