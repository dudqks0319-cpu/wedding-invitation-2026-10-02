import type { Invitation, RsvpEntry } from "../../types/invitation";
import { INVITATION_FONTS } from "../presentation";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) { super(message); this.status=status; }
}
export function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new ApiError(400, '입력 형식을 확인해 주세요');
  return value as Record<string, unknown>;
}
export function text(value: unknown, max: number, label: string, required = true): string {
  if (!required && (value === undefined || value === '')) return '';
  if (typeof value !== 'string' || value.length > max || (required && !value.trim())) throw new ApiError(400, `${label}을 확인해 주세요`);
  return value.trim();
}
export function slugValue(value: unknown): string {
  const slug = text(value, 30, '청첩장 주소');
  if (!/^[a-z0-9-]{3,30}$/.test(slug) || slug.startsWith('sample-')) throw new ApiError(400, '주소는 영문 소문자·숫자·-로 3~30자여야 해요 (sample- 제외)');
  return slug;
}
export function safeNext(value: unknown): string {
  if (typeof value !== 'string' || !/^\/(my|create)(\/|\?|$)/.test(value) || /[\\\r\n]/.test(value)) return '/my';
  return value;
}
function bool(value: unknown): boolean {
  if (typeof value !== 'boolean') throw new ApiError(400, '선택 항목을 확인해 주세요');
  return value;
}
function choice<T extends string>(value: unknown, values: readonly T[]): T {
  if (typeof value !== 'string' || !values.includes(value as T)) throw new ApiError(400, '선택 항목을 확인해 주세요');
  return value as T;
}
export function photoUrl(value: unknown): string {
  const url = text(value, 200, '사진');
  if (!/^\/(photos\/[a-z0-9-]+\.webp|api\/photos\/[a-f0-9-]{36})$/.test(url)) throw new ApiError(400, '사진은 직접 업로드하거나 예시 사진을 골라 주세요');
  return url;
}
export function invitationValue(value: unknown, templates: { id: string; category: string }[]): Invitation {
  const x = object(value), type = choice(x.type, ['wedding','dol','party'] as const);
  const templateId = text(x.templateId, 40, '디자인');
  if (!templates.some(t => t.id === templateId && t.category === type)) throw new ApiError(400, '행사에 맞는 디자인을 골라 주세요');
  const dateTime = text(x.dateTime, 16, '행사 일시');
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(dateTime) || !Number.isFinite(Date.parse(dateTime + '+09:00')) || new Date(dateTime + 'Z').toISOString().slice(0,16) !== dateTime) throw new ApiError(400, '행사 일시를 확인해 주세요');
  const venue = object(x.venue), options = object(x.options);
  const lat = venue.lat, lng = venue.lng;
  if (typeof lat !== 'number' || !Number.isFinite(lat) || Math.abs(lat) > 90 || typeof lng !== 'number' || !Number.isFinite(lng) || Math.abs(lng) > 180) throw new ApiError(400, '지도 위치를 확인해 주세요');
  if (!Array.isArray(x.gallery) || x.gallery.length > 30 || !Array.isArray(x.accounts) || x.accounts.length > 10) throw new ApiError(400, '사진은 30장, 계좌는 10개까지 넣을 수 있어요');
  const partner = (v: unknown) => {
    const p = object(v);
    return {name:text(p.name,20,'이름'), order:text(p.order,20,'관계'), englishName:text(p.englishName,40,'영문 이름',false), phone:text(p.phone,30,'연락처',false), father:text(p.father,20,'아버지 성함',false), mother:text(p.mother,20,'어머니 성함',false), fatherPhone:text(p.fatherPhone,30,'연락처',false), motherPhone:text(p.motherPhone,30,'연락처',false), fatherDeceased:p.fatherDeceased === undefined ? false : bool(p.fatherDeceased), motherDeceased:p.motherDeceased === undefined ? false : bool(p.motherDeceased)};
  };
  const inv: Invitation = {
    slug:slugValue(x.slug), templateId, type, dateTime,
    venue:{name:text(venue.name,100,'장소'),address:text(venue.address,200,'주소'),lat,lng, ...Object.fromEntries(['hall','tel','subway','bus','parking','car'].map(k => [k,text(venue[k],500,'교통 안내',false)]))},
    greetingTitle:text(x.greetingTitle,100,'인사말 제목'), greeting:text(x.greeting,2000,'인사말'), coverPhoto:photoUrl(x.coverPhoto),gallery:x.gallery.map(photoUrl),
    accounts:x.accounts.map(v => {const a=object(v); const pay=text(a.kakaoPayUrl,300,'송금 링크',false); if (pay && !/^https:\/\/(qr\.kakaopay\.com|link\.kakaopay\.com)\//.test(pay)) throw new ApiError(400,'카카오페이의 실제 송금 링크를 넣어 주세요'); return {id:text(a.id,40,'계좌'),side:choice(a.side,['groom','bride','host'] as const),label:text(a.label,30,'계좌 이름'),bank:text(a.bank,30,'은행'),number:text(a.number,40,'계좌번호'),holder:text(a.holder,30,'예금주'),...(pay?{kakaoPayUrl:pay}:{})};}),
    options:{showCalendar:bool(options.showCalendar),showDday:bool(options.showDday),showGallery:bool(options.showGallery),showAccounts:bool(options.showAccounts),showGuestbook:bool(options.showGuestbook),showRsvp:bool(options.showRsvp),showEffect:bool(options.showEffect)},
    shareTitle:text(x.shareTitle,100,'공유 제목',false), shareDescription:text(x.shareDescription,300,'공유 설명',false),
  };
  if (options.bgmUrl) throw new ApiError(400,'외부 음악 링크는 현재 지원하지 않아요');
  if (options.font !== undefined) inv.options.font = choice(options.font, INVITATION_FONTS.map(font => font.id));
  if (x.coverPresentation !== undefined) {
    const p = object(x.coverPresentation);
    const number = (key: string, min: number, max: number) => {
      const value = p[key];
      if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) throw new ApiError(400, '사진 구도를 확인해 주세요');
      return value;
    };
    inv.coverPresentation = { x: number('x', 0, 1), y: number('y', 0, 1), zoom: number('zoom', 1, 2), fit: choice(p.fit, ['cover', 'contain'] as const) };
  }
  if (type === 'wedding') {const w=object(x.wedding); inv.wedding={groom:partner(w.groom),bride:partner(w.bride)};}
  if (type === 'dol') {const d=object(x.dol); const birthDate=text(d.birthDate,10,'생일'); if (!/^\d{4}-\d{2}-\d{2}$/.test(birthDate) || (!Number.isFinite(Date.parse(birthDate)) || new Date(birthDate).toISOString().slice(0,10)!==birthDate)) throw new ApiError(400,'아기 생일을 확인해 주세요'); inv.dol={babyName:text(d.babyName,20,'아기 이름'),babyEnglishName:text(d.babyEnglishName,40,'영문 이름',false),birthDate,father:text(d.father,20,'아버지 이름'),mother:text(d.mother,20,'어머니 이름'),phone:text(d.phone,30,'연락처',false)};}
  if (type === 'party') {const p=object(x.party); inv.party={honoreeName:text(p.honoreeName,30,'주인공 이름'),eventName:text(p.eventName,30,'행사'),hostName:text(p.hostName,50,'초대하는 분'),phone:text(p.phone,30,'연락처',false)};}
  return inv;
}
export function guestbookValue(value: unknown) {
  const x=object(value); const password=text(x.password,64,'비밀번호');
  if(password.length<4) throw new ApiError(400,'비밀번호는 4자리 이상 입력해 주세요');
  return {name:text(x.name,12,'이름'),message:text(x.message,300,'메시지'),password};
}
export function rsvpValue(value: unknown): Omit<RsvpEntry,'id'|'createdAt'> {
  const x=object(value);
  if(!Number.isInteger(x.count) || (x.count as number)<1 || (x.count as number)>20) throw new ApiError(400,'인원은 1~20명으로 입력해 주세요');
  return {side:choice(x.side,['groom','bride','host'] as const),name:text(x.name,20,'이름'),attending:bool(x.attending),count:x.count as number,meal:choice(x.meal,['yes','no','unknown'] as const),memo:text(x.memo,60,'메모',false)};
}
