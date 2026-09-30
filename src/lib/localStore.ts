"use client";

import { useSyncExternalStore } from "react";

/**
 * 브라우저 저장소(localStorage)를 React 에서 쉽게 쓰기 위한 도구.
 * 백엔드가 생기기 전까지 임시 저장소 역할을 합니다.
 */

const PREFIX = "bomgyeol:";
const listeners = new Set<() => void>();
const cache = new Map<string, { raw: string | null; value: unknown }>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (!e.key || e.key.startsWith(PREFIX)) listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export function readStored<T>(key: string, fallback: T): T {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(PREFIX + key);
  } catch {
    return fallback;
  }
  if (raw === null) return fallback;
  const hit = cache.get(key);
  if (hit && hit.raw === raw) return hit.value as T;
  try {
    const value = JSON.parse(raw) as T;
    cache.set(key, { raw, value });
    return value;
  } catch {
    return fallback;
  }
}

export function writeStored<T>(key: string, value: T) {
  try {
    window.localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    // 저장 공간이 가득 찼거나(사진이 너무 클 때) 비공개 모드일 수 있어요.
    throw new Error("브라우저 저장 공간이 부족해요. 사진 수를 줄여 주세요.");
  }
  listeners.forEach((l) => l());
}

/** fallback 은 컴포넌트 밖에서 만든 고정된 값을 넘겨 주세요. */
export function useStored<T>(key: string, fallback: T): T {
  return useSyncExternalStore(
    subscribe,
    () => readStored(key, fallback),
    () => fallback,
  );
}
