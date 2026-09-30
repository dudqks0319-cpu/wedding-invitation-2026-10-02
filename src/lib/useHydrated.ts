import { useSyncExternalStore } from "react";

const noop = () => () => {};

/** 브라우저에서 화면이 준비됐는지 (서버 렌더링과 값이 달라지는 부분에 사용) */
export function useHydrated() {
  return useSyncExternalStore(noop, () => true, () => false);
}
