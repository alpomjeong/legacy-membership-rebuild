import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/lib/api";
import { ALL_TABS, MAX_CUSTOM_TABS, TABS_SETTING_KEY, normalizeTabIds, useTabIds } from "@/lib/nav";

export default function TabsEdit() {
  const router = useRouter();
  const qc = useQueryClient();
  const current = useTabIds();
  const currentKey = current.join(",");
  const [sel, setSel] = useState<string[]>(current);
  const [prevKey, setPrevKey] = useState(currentKey);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // 저장된 탭 구성이 바뀌면(내용 기준) 렌더 중 동기화.
  if (prevKey !== currentKey) { setPrevKey(currentKey); setSel(current); }
  const toggle = (id: string) => setSel((p) => p.includes(id) ? p.filter((x) => x !== id) : (p.length >= MAX_CUSTOM_TABS ? p : [...p, id]));
  const save = async () => {
    const value = normalizeTabIds(sel);
    setSaving(true); setError(null);
    try { await api.put(`/me/settings/${TABS_SETTING_KEY}`, { value }); await qc.invalidateQueries({ queryKey: ["mobile-tabs"] }); router.back(); }
    catch (e) { setError(e instanceof Error ? e.message : "저장 실패"); setSaving(false); }
  };
  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-hanji dark:bg-hanji-dark">
      <View className="flex-row items-center justify-between px-4 py-3">
        <Pressable onPress={() => router.back()} hitSlop={8}><Text className="font-body text-[15px] text-ink-soft dark:text-ink-softDark">취소</Text></Pressable>
        <Text className="font-bodyb text-[16px] text-ink dark:text-ink-dark">탭 편집</Text>
        <Pressable onPress={save} disabled={saving} hitSlop={8}><Text className={`font-bodyb text-[15px] ${saving ? "text-ink-soft" : "text-celadon dark:text-celadon-dark"}`}>{saving ? "저장 중…" : "저장"}</Text></Pressable>
      </View>
      <Text className="px-5 pb-2 font-body text-[12px] text-ink-soft dark:text-ink-softDark">하단에 표시할 탭을 최대 {MAX_CUSTOM_TABS}개 선택 (더보기는 항상 표시)</Text>
      {error ? <Text className="mx-5 mb-2 font-bodym text-[13px] text-vermilion">{error}</Text> : null}
      <View className="px-5">
        {ALL_TABS.map((t) => {
          const on = sel.includes(t.id);
          return (
            <Pressable key={t.id} onPress={() => toggle(t.id)} className="mb-2 flex-row items-center gap-3 rounded-2xl border border-line bg-hanji-card p-4 active:opacity-70 dark:border-line-dark dark:bg-hanji-cardDark">
              <Ionicons name={t.icon} size={20} color="#2f7d6b" />
              <Text className="flex-1 font-bodyb text-[15px] text-ink dark:text-ink-dark">{t.title}</Text>
              <Ionicons name={on ? "checkmark-circle" : "ellipse-outline"} size={22} color={on ? "#2f7d6b" : "#c9bfa9"} />
            </Pressable>
          );
        })}
      </View>
    </SafeAreaView>
  );
}
