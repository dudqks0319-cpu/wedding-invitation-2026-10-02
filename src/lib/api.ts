"use client";
import { useEffect, useSyncExternalStore } from "react";
import type { GuestbookEntry, Invitation, RsvpEntry } from "@/types/invitation";
import { readStored, useStored, writeStored } from "./localStore";
import { REMOTE_DATA } from "./dataMode";
const INVITATIONS_KEY = "invitations";
const EMPTY_INVITATIONS: Record<string, Invitation> = {};
const EMPTY_GUESTBOOK: GuestbookEntry[] = [];
const EMPTY_RSVP: RsvpEntry[] = [];
export class ClientError extends Error {
  status: number;
  constructor(message: string, status: number) { super(message); this.status = status; }
}
type State = { loading: boolean; error: ClientError | null; data?: unknown };
const INITIAL: State = { loading: true, error: null };
const LOCAL: State = { loading: false, error: null };
const cache = new Map<string, State>();
const pending = new Set<string>();
const listeners = new Set<() => void>();
function emit() { listeners.forEach((fn) => fn()); }
function subscribe(fn: () => void) { listeners.add(fn); return () => { listeners.delete(fn); }; }
export async function request<T>(path: string, method = "GET", body?: unknown): Promise<T> {
  const url = process.env.NEXT_PUBLIC_BACKEND === 'cloudflare' ? path.replace(/^\/api\//, '/api/v2/') : path;
  const response = await fetch(url, {
    method, credentials: "same-origin", cache: "no-store", signal: AbortSignal.timeout(20_000),
    headers: method === "GET" ? {} : { "Content-Type": "application/json", "Idempotency-Key": crypto.randomUUID() },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok) throw new ClientError(data.error ?? "요청을 처리하지 못했어요", response.status);
  return data as T;
}
function load(path: string) {
  if (pending.has(path)) return;
  pending.add(path);
  void request(path).then((data) => cache.set(path, { data, loading: false, error: null }))
    .catch((error) => cache.set(path, { loading: false, error: error instanceof ClientError ? error : new ClientError("연결을 확인하고 다시 시도해 주세요", 0) }))
    .finally(() => { pending.delete(path); emit(); });
}
function refresh(path: string) { cache.delete(path); emit(); load(path); }
export function refreshApi(path:string){refresh(path);}
export function useApiState(path: string): State {
  const enabled = REMOTE_DATA && !!path && !path.includes("/sample-");
  const state = useSyncExternalStore(subscribe, () => enabled ? cache.get(path) ?? INITIAL : LOCAL, () => enabled ? INITIAL : LOCAL);
  useEffect(() => { if (enabled && !cache.has(path)) load(path); }, [enabled, path]);
  return state;
}
export function newId() { return crypto.randomUUID().replaceAll("-", "").slice(0, 12); }
export function useMyInvitations() {
  const local = useStored(INVITATIONS_KEY, EMPTY_INVITATIONS);
  const remote = useApiState("/api/invitations");
  return REMOTE_DATA ? (remote.data as Record<string, Invitation> | undefined) ?? EMPTY_INVITATIONS : local;
}
export function useInvitation(slug: string): Invitation | undefined {
  const local = useStored(INVITATIONS_KEY, EMPTY_INVITATIONS);
  const remote = useApiState(slug ? `/api/invitations/${slug}` : "");
  return REMOTE_DATA ? remote.data as Invitation | undefined : local[slug];
}
export function getInvitation(slug: string): Invitation | undefined {
  return REMOTE_DATA ? cache.get(`/api/invitations/${slug}`)?.data as Invitation | undefined : readStored(INVITATIONS_KEY, EMPTY_INVITATIONS)[slug];
}
export async function saveInvitation(inv: Invitation) {
  if (REMOTE_DATA) {
    const saved = await request<Invitation>(`/api/invitations/${inv.slug}`, "PUT", inv);
    cache.set(`/api/invitations/${inv.slug}`, { data: saved, loading: false, error: null });
    refresh("/api/invitations"); return saved;
  }
  writeStored(INVITATIONS_KEY, { ...readStored(INVITATIONS_KEY, EMPTY_INVITATIONS), [inv.slug]: inv }); return inv;
}
export async function publishInvitation(slug: string, published: boolean, expectedRevision?:number) {
  const inv = getInvitation(slug);
  if (published && inv && [inv.coverPhoto,...inv.gallery].some(url=>url.startsWith('/photos/'))) throw new ClientError('AI 예시 사진을 실제 사진으로 바꾸고, 갤러리의 예시 사진도 지워 주세요.',400);
  const saved = await request<Invitation>(`/api/invitations/${slug}/publish`, "POST", { published, revision: expectedRevision ?? inv?.revision ?? 0 });
  cache.set(`/api/invitations/${slug}`, { data: saved, loading: false, error: null });
  refresh("/api/invitations"); return saved;
}
export async function deleteInvitation(slug: string) {
  if (REMOTE_DATA) { await request(`/api/invitations/${slug}`, "DELETE", {}); cache.delete(`/api/invitations/${slug}`); refresh("/api/invitations"); return; }
  const rest = { ...readStored(INVITATIONS_KEY, EMPTY_INVITATIONS) }; delete rest[slug]; writeStored(INVITATIONS_KEY, rest);
}
export function useGuestbook(slug: string) {
  const local = useStored(`guestbook:${slug}`, EMPTY_GUESTBOOK);
  const remote = useApiState(`/api/invitations/${slug}/guestbook`);
  return REMOTE_DATA ? (remote.data as GuestbookEntry[] | undefined) ?? EMPTY_GUESTBOOK : local;
}
export async function addGuestbook(slug: string, entry: { name: string; message: string; password: string }) {
  if (REMOTE_DATA) { const saved = await request<GuestbookEntry>(`/api/invitations/${slug}/guestbook`, "POST", entry); refresh(`/api/invitations/${slug}/guestbook`); return saved; }
  const item: GuestbookEntry = { id: newId(), name: entry.name, message: entry.message, createdAt: new Date().toISOString() };
  writeStored(`guestbook:${slug}`, [item, ...readStored(`guestbook:${slug}`, EMPTY_GUESTBOOK)]); return item;
}
export async function removeGuestbook(slug: string, id: string, password = "") {
  if (REMOTE_DATA) { await request(`/api/invitations/${slug}/guestbook/${id}`, "DELETE", { password }); refresh(`/api/invitations/${slug}/guestbook`); return; }
  writeStored(`guestbook:${slug}`, readStored(`guestbook:${slug}`, EMPTY_GUESTBOOK).filter((g) => g.id !== id));
}
export function useRsvpList(slug: string) {
  const local = useStored(`rsvp:${slug}`, EMPTY_RSVP);
  const remote = useApiState(`/api/invitations/${slug}/rsvp`);
  return REMOTE_DATA ? (remote.data as RsvpEntry[] | undefined) ?? EMPTY_RSVP : local;
}
export async function submitRsvp(slug: string, entry: Omit<RsvpEntry, "id" | "createdAt">) {
  if (REMOTE_DATA) return request<RsvpEntry>(`/api/invitations/${slug}/rsvp`, "POST", entry);
  const item: RsvpEntry = { ...entry, id: newId(), createdAt: new Date().toISOString() };
  writeStored(`rsvp:${slug}`, [item, ...readStored(`rsvp:${slug}`, EMPTY_RSVP)]); return item;
}
