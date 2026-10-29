/* 하단 탭 구성 정의 + 사용자 설정 정규화 (순수 로직). */
import type { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export interface TabDef { id: string; title: string; icon: keyof typeof Ionicons.glyphMap }

export const ALL_TABS: TabDef[] = [
  { id: "index", title: "회원현황", icon: "people" },
  { id: "bulsa", title: "불사", icon: "flame" },
  { id: "enshrine", title: "봉안일", icon: "calendar" },
  { id: "counsel", title: "상담", icon: "chatbubble-ellipses" },
  { id: "reports", title: "대시보드", icon: "stats-chart" },
];
export const DEFAULT_TAB_IDS = ["index", "bulsa", "enshrine", "counsel"];
export const MAX_CUSTOM_TABS = 4;
export const TABS_SETTING_KEY = "mobile.tabs";

export function normalizeTabIds(value: unknown): string[] {
  const valid = new Set(ALL_TABS.map((t) => t.id));
  if (!Array.isArray(value)) return [...DEFAULT_TAB_IDS];
  const seen = new Set<string>(); const out: string[] = [];
  for (const v of value) {
    if (typeof v === "string" && valid.has(v) && !seen.has(v)) { seen.add(v); out.push(v); }
  }
  const capped = out.slice(0, MAX_CUSTOM_TABS);
  return capped.length ? capped : [...DEFAULT_TAB_IDS];
}

export function useTabIds(): string[] {
  const { data } = useQuery({
    queryKey: ["mobile-tabs"],
    queryFn: async () => normalizeTabIds((await api.get<{ value: unknown }>(`/me/settings/${TABS_SETTING_KEY}`)).value),
  });
  return data ?? DEFAULT_TAB_IDS;
}
