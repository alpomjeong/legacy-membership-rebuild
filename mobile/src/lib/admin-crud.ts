/* 관리자 리소스 CRUD 훅 — 리소스별 react-query 키. */
import { Alert } from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

export function useAdminCrud<T extends { id: string }>(basePath: string, updateVerb: "PUT" | "PATCH" = "PUT", listQuery = "") {
  const qc = useQueryClient();
  const key = ["admin", basePath, listQuery];
  const { data, isLoading, error } = useQuery({ queryKey: key, queryFn: () => api.get<T[]>(basePath + listQuery) });
  const inval = () => qc.invalidateQueries({ queryKey: key });
  return {
    items: data ?? [],
    loading: isLoading,
    error: error ? (error instanceof Error ? error.message : String(error)) : null,
    create: async (dto: unknown) => { await api.post(basePath, dto); await inval(); },
    update: async (id: string, dto: unknown) => { await (updateVerb === "PUT" ? api.put : api.patch)(`${basePath}/${id}`, dto); await inval(); },
    remove: async (id: string) => {
      try { await api.delete(`${basePath}/${id}`); await inval(); }
      catch (e) { Alert.alert("삭제 실패", e instanceof Error ? e.message : "삭제할 수 없습니다."); }
    },
    reload: inval,
  };
}
