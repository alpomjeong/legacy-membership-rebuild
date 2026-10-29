import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, Modal, Platform, Pressable, RefreshControl, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/lib/api";
import { API_BASE } from "@/lib/config";
import { authStore } from "@/lib/auth";
import { ScreenHeader, EmptyBox } from "@/components/ui";
import { currentRoles, isAdmin } from "@/lib/roles";

interface BackupMeta { name: string; bytes: number; at: string }
interface Status { last: BackupMeta | null; count: number; nextRunAt: string; fullHour: number; database: string }

const fmtBytes = (b: number): string =>
  b >= 1e6 ? `${(b / 1e6).toFixed(1)} MB` : b >= 1e3 ? `${(b / 1e3).toFixed(0)} KB` : `${b} B`;
const p2 = (n: number): string => String(n).padStart(2, "0");
const fmtTime = (iso: string): string => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())} ${p2(d.getHours())}:${p2(d.getMinutes())}`;
};

export default function BackupAdmin() {
  const router = useRouter();
  const admin = isAdmin(currentRoles());
  const [status, setStatus] = useState<Status | null>(null);
  const [list, setList] = useState<BackupMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [target, setTarget] = useState<BackupMeta | null>(null); // 복원 대상
  const [confirmText, setConfirmText] = useState("");

  const load = useCallback(
    () =>
      Promise.all([
        api.get<Status>("/admin/backup/status"),
        api.get<BackupMeta[]>("/admin/backup/list"),
      ])
        .then(([s, l]) => { setStatus(s); setList(l); })
        .catch((e: unknown) => Alert.alert("불러오기 실패", e instanceof Error ? e.message : "오류"))
        .finally(() => setLoading(false)),
    [],
  );

  useEffect(() => {
    if (!admin) { router.back(); return; }
    void load();
  }, [admin, load, router]);

  const runBackup = async () => {
    setBusy(true);
    try {
      const r = await api.post<BackupMeta>("/admin/backup/run");
      Alert.alert("백업 완료", `${r.name}\n${fmtBytes(r.bytes)}`);
      await load();
    } catch (e) {
      Alert.alert("백업 실패", e instanceof Error ? e.message : "오류");
    } finally {
      setBusy(false);
    }
  };

  const download = async (name: string) => {
    if (Platform.OS !== "web") { Alert.alert("안내", "다운로드는 웹 화면에서 지원됩니다."); return; }
    try {
      const res = await fetch(`${API_BASE}/admin/backup/download/${encodeURIComponent(name)}`, {
        headers: { Authorization: `Bearer ${authStore.getToken() ?? ""}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = name; a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      Alert.alert("다운로드 실패", e instanceof Error ? e.message : "오류");
    }
  };

  const doRestore = async () => {
    if (!target) return;
    setBusy(true);
    try {
      const r = await api.post<{ restored: string; safetyBackup?: string }>("/admin/backup/restore", {
        file: target.name,
        confirm: confirmText,
      });
      setTarget(null); setConfirmText("");
      Alert.alert("복원 완료", `${r.restored}\n복원 전 안전백업: ${r.safetyBackup ?? "-"}`);
      await load();
    } catch (e) {
      Alert.alert("복원 실패", e instanceof Error ? e.message : "오류");
    } finally {
      setBusy(false);
    }
  };

  if (!admin) return null;
  const canRestore = !!status && confirmText.trim() === status.database;

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-hanji dark:bg-hanji-dark">
      <ScreenHeader title="백업 관리" subtitle="DB 백업·복원 (관리자)" />
      <ScrollView className="flex-1 px-5" refreshControl={<RefreshControl refreshing={loading} onRefresh={() => { setLoading(true); void load(); }} tintColor="#2f7d6b" />}>
        {/* 상태 카드 */}
        <View className="mb-3 mt-1 rounded-2xl border border-line bg-hanji-card p-4 dark:border-line-dark dark:bg-hanji-cardDark">
          <View className="flex-row items-center gap-2">
            <Ionicons name="server" size={18} color="#2f7d6b" />
            <Text className="font-bodyb text-[14px] text-ink dark:text-ink-dark">DB: {status?.database ?? "…"}</Text>
          </View>
          <Text className="mt-2 font-body text-[13px] text-ink-soft dark:text-ink-softDark">
            최근 백업: {status?.last ? `${fmtTime(status.last.at)} · ${fmtBytes(status.last.bytes)}` : "없음"}
          </Text>
          <Text className="mt-0.5 font-body text-[13px] text-ink-soft dark:text-ink-softDark">
            보관 개수: {status?.count ?? 0} · 다음 자동실행: {status ? fmtTime(status.nextRunAt) : "-"}
          </Text>
        </View>

        {/* 지금 백업 */}
        <Pressable onPress={runBackup} disabled={busy} className={`mb-4 flex-row items-center justify-center gap-2 rounded-2xl py-3.5 ${busy ? "bg-line/60 dark:bg-line-dark" : "bg-celadon active:opacity-80"}`}>
          {busy ? <ActivityIndicator color="#fff" /> : <Ionicons name="cloud-upload" size={18} color="#fff" />}
          <Text className="font-bodyb text-[15px] text-white">지금 백업</Text>
        </Pressable>

        <Text className="mb-2 font-bodyb text-[12px] text-ink-soft dark:text-ink-softDark">백업 목록 {list.length}</Text>
        {list.length === 0 && !loading ? <EmptyBox>백업 없음</EmptyBox> : null}
        {list.map((b) => (
          <View key={b.name} className="mb-2 rounded-2xl border border-line bg-hanji-card p-3.5 dark:border-line-dark dark:bg-hanji-cardDark">
            <Text numberOfLines={1} className="font-bodyb text-[13.5px] text-ink dark:text-ink-dark">{b.name}</Text>
            <Text className="mt-0.5 font-body text-[12px] text-ink-soft dark:text-ink-softDark">{fmtTime(b.at)} · {fmtBytes(b.bytes)}</Text>
            <View className="mt-2 flex-row gap-2">
              <Pressable onPress={() => download(b.name)} className="flex-row items-center gap-1 rounded-xl border border-line px-3 py-1.5 active:opacity-60 dark:border-line-dark">
                <Ionicons name="download" size={15} color="#2f7d6b" /><Text className="font-bodym text-[12.5px] text-celadon dark:text-celadon-dark">다운로드</Text>
              </Pressable>
              <Pressable onPress={() => { setTarget(b); setConfirmText(""); }} className="flex-row items-center gap-1 rounded-xl border border-vermilion/40 px-3 py-1.5 active:opacity-60">
                <Ionicons name="refresh-circle" size={15} color="#b23a26" /><Text className="font-bodym text-[12.5px] text-vermilion">복원</Text>
              </Pressable>
            </View>
          </View>
        ))}
        <View className="h-8" />
      </ScrollView>

      {/* 복원 확인 모달 */}
      <Modal visible={!!target} transparent animationType="fade" onRequestClose={() => setTarget(null)}>
        <View className="flex-1 items-center justify-center bg-black/50 px-6">
          <View className="w-full rounded-2xl bg-hanji p-5 dark:bg-hanji-dark">
            <Text className="font-bodyb text-[16px] text-vermilion">⚠ 복원 — 파괴적 작업</Text>
            <Text className="mt-2 font-body text-[13px] text-ink dark:text-ink-dark">현재 DB를 아래 백업 시점으로 덮어씁니다. 복원 직전 자동 안전백업이 만들어집니다.</Text>
            <Text numberOfLines={1} className="mt-2 font-bodyb text-[12.5px] text-ink-soft dark:text-ink-softDark">{target?.name}</Text>
            <Text className="mt-3 font-body text-[12.5px] text-ink-soft dark:text-ink-softDark">확인을 위해 DB 이름 <Text className="font-bodyb text-ink dark:text-ink-dark">{status?.database}</Text> 을(를) 입력하세요:</Text>
            <TextInput value={confirmText} onChangeText={setConfirmText} autoCapitalize="none" autoCorrect={false} placeholder={status?.database} placeholderTextColor="#a39a88" className="mt-2 rounded-xl border border-line bg-hanji-card px-3.5 py-2.5 font-body text-[15px] text-ink dark:border-line-dark dark:bg-hanji-cardDark dark:text-ink-dark" />
            <View className="mt-4 flex-row justify-end gap-2">
              <Pressable onPress={() => { setTarget(null); setConfirmText(""); }} className="rounded-xl px-4 py-2 active:opacity-60"><Text className="font-bodyb text-[14px] text-ink-soft dark:text-ink-softDark">취소</Text></Pressable>
              <Pressable onPress={doRestore} disabled={!canRestore || busy} className={`rounded-xl px-4 py-2 ${canRestore && !busy ? "bg-vermilion active:opacity-80" : "bg-line/60 dark:bg-line-dark"}`}>
                <Text className={`font-bodyb text-[14px] ${canRestore && !busy ? "text-white" : "text-ink-soft"}`}>{busy ? "복원 중…" : "복원 실행"}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
