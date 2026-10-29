/* 불사 항목별 슬롯 규칙 lazy fetch (itemId별 캐시). */
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { SlotRule, SlotRulesResponse } from "@/lib/types";

export function useSlotRules(itemId: string | undefined, enabled: boolean): SlotRule[] {
  const { data } = useQuery({
    queryKey: ["slot-rules", itemId],
    queryFn: () => api.get<SlotRulesResponse>(`/buddhist-service-items/${itemId}/slot-rules`),
    enabled: enabled && !!itemId,
  });
  return data?.rules ?? [];
}
