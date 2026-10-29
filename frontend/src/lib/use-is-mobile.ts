import { useEffect, useState } from "react";

/** 화면 너비 기준 모바일 여부(JS) — 데스크톱/모바일 전용 트리 분기에 사용. */
export function useIsMobile(breakpoint = 768): boolean {
  const [mobile, setMobile] = useState(() => (typeof window !== "undefined" ? window.innerWidth < breakpoint : false));
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpoint - 1}px)`);
    const on = () => setMobile(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, [breakpoint]);
  return mobile;
}
