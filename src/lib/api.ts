"use client";

import type { GuestbookEntry, Invitation, RsvpEntry } from "@/types/invitation";
import { readStored, useStored, writeStored } from "./localStore";

/**
 * ─────────────────────────────────────────────────────────────
 *  데이터 연결 창구 (지금은 브라우저에만 저장)
 * ─────────────────────────────────────────────────────────────
 *  백엔드 작업 시 이 파일의 함수 내부만 fetch("/api/...") 로 바꾸면
 *  화면 코드는 건드리지 않아도 됩니다. → docs/BACKEND_HANDOFF.md
 */

const INVITATIONS_KEY = "invitations";
const EMPTY_INVITATIONS: Record<string, Invitation> = {};
const EMPTY_GUESTBOOK: GuestbookEntry[] = [];
const EMPTY_RSVP: RsvpEntry[] = [];

export function newId() {
  return Math.random().toString(36).slice(2, 10);
}

/* ---------- 청첩장 ---------- */

// TODO(backend): GET /api/invitations (로그인 사용자 것만)
export function useMyInvitations() {
  return useStored(INVITATIONS_KEY, EMPTY_INVITATIONS);
}

// TODO(backend): GET /api/invitations/:slug
export function useInvitation(slug: string): Invitation | undefined {
  return useMyInvitations()[slug];
}

export function getInvitation(slug: string): Invitation | undefined {
  return readStored(INVITATIONS_KEY, EMPTY_INVITATIONS)[slug];
}

// TODO(backend): PUT /api/invitations/:slug
export async function saveInvitation(inv: Invitation) {
  const all = readStored(INVITATIONS_KEY, EMPTY_INVITATIONS);
  writeStored(INVITATIONS_KEY, { ...all, [inv.slug]: inv });
  return inv;
}

// TODO(backend): DELETE /api/invitations/:slug
export async function deleteInvitation(slug: string) {
  const rest = { ...readStored(INVITATIONS_KEY, EMPTY_INVITATIONS) };
  delete rest[slug];
  writeStored(INVITATIONS_KEY, rest);
}

/* ---------- 방명록 ---------- */

// TODO(backend): GET /api/invitations/:slug/guestbook
export function useGuestbook(slug: string) {
  return useStored(`guestbook:${slug}`, EMPTY_GUESTBOOK);
}

// TODO(backend): POST /api/invitations/:slug/guestbook  (password 는 서버에서 해시 저장)
export async function addGuestbook(
  slug: string,
  entry: { name: string; message: string; password: string },
) {
  const list = readStored(`guestbook:${slug}`, EMPTY_GUESTBOOK);
  const item: GuestbookEntry = {
    id: newId(),
    name: entry.name,
    message: entry.message,
    createdAt: new Date().toISOString(),
  };
  writeStored(`guestbook:${slug}`, [item, ...list]);
  return item;
}

// TODO(backend): DELETE /api/invitations/:slug/guestbook/:id  (비밀번호 확인)
export async function removeGuestbook(slug: string, id: string) {
  const list = readStored(`guestbook:${slug}`, EMPTY_GUESTBOOK);
  writeStored(
    `guestbook:${slug}`,
    list.filter((g) => g.id !== id),
  );
}

/* ---------- 참석 여부 (RSVP) ---------- */

// TODO(backend): GET /api/invitations/:slug/rsvp (청첩장 주인만)
export function useRsvpList(slug: string) {
  return useStored(`rsvp:${slug}`, EMPTY_RSVP);
}

// TODO(backend): POST /api/invitations/:slug/rsvp
export async function submitRsvp(slug: string, entry: Omit<RsvpEntry, "id" | "createdAt">) {
  const list = readStored(`rsvp:${slug}`, EMPTY_RSVP);
  const item: RsvpEntry = { ...entry, id: newId(), createdAt: new Date().toISOString() };
  writeStored(`rsvp:${slug}`, [item, ...list]);
  return item;
}
