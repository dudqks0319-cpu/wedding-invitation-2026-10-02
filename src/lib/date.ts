const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];
const WEEKDAYS_EN = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];
const MONTHS_EN = [
  "JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE",
  "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER",
];

/** "2027-04-17T12:30" → 시간대와 무관하게 그대로 해석 */
export function parseDateTime(value: string) {
  const [datePart, timePart = "00:00"] = value.split("T");
  const [y, m, d] = datePart.split("-").map(Number);
  const [hh, mm] = timePart.split(":").map(Number);
  return { year: y, month: m, day: d, hour: hh, minute: mm };
}

export function weekdayOf(year: number, month: number, day: number) {
  return new Date(year, month - 1, day).getDay();
}

export function formatKoreanDate(value: string) {
  const { year, month, day } = parseDateTime(value);
  return `${year}년 ${month}월 ${day}일 ${WEEKDAYS[weekdayOf(year, month, day)]}요일`;
}

export function formatKoreanTime(value: string) {
  const { hour, minute } = parseDateTime(value);
  const period = hour < 12 ? "오전" : hour === 12 ? "낮" : "오후";
  const h = hour > 12 ? hour - 12 : hour;
  return `${period} ${h}시${minute ? ` ${minute}분` : ""}`;
}

export function formatDotDate(value: string) {
  const { year, month, day } = parseDateTime(value);
  return `${year}.${String(month).padStart(2, "0")}.${String(day).padStart(2, "0")}`;
}

export function formatEnglishDate(value: string) {
  const { year, month, day } = parseDateTime(value);
  return {
    weekday: WEEKDAYS_EN[weekdayOf(year, month, day)],
    month: MONTHS_EN[month - 1],
    day,
    year,
  };
}

/** 달력에 그릴 칸 (앞쪽 빈칸은 null) */
export function monthMatrix(year: number, month: number) {
  const first = weekdayOf(year, month, 1);
  const days = new Date(year, month, 0).getDate();
  const cells: (number | null)[] = Array(first).fill(null);
  for (let d = 1; d <= days; d++) cells.push(d);
  while (cells.length % 7) cells.push(null);
  return cells;
}

export function diffFromNow(value: string, now: number) {
  const { year, month, day, hour, minute } = parseDateTime(value);
  const target = new Date(year, month - 1, day, hour, minute).getTime();
  const ms = Math.max(0, target - now);
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const dday = Math.round(
    (new Date(year, month - 1, day).getTime() - today.getTime()) / 86400000,
  );
  return {
    dday,
    days: Math.floor(ms / 86400000),
    hours: Math.floor((ms / 3600000) % 24),
    minutes: Math.floor((ms / 60000) % 60),
    seconds: Math.floor((ms / 1000) % 60),
  };
}

export { WEEKDAYS };
