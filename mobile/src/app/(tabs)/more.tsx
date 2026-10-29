import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useColorScheme } from "nativewind";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { authStore } from "@/lib/auth";
import { useLive } from "@/lib/live";
import { fmt } from "@/lib/util";
import { currentRoles, isAdmin, canEdit, roleLabel } from "@/lib/roles";
import { ScreenHeader } from "@/components/ui";

type Item = { icon: keyof typeof Ionicons.glyphMap; label: string; onPress?: () => void; soon?: boolean; danger?: boolean; right?: React.ReactNode };

const Row = ({ it }: { it: Item }) => (
  <Pressable onPress={it.soon ? undefined : it.onPress} disabled={it.soon} className={`mb-2 flex-row items-center gap-3 rounded-2xl border border-line bg-hanji-card p-4 dark:border-line-dark dark:bg-hanji-cardDark ${it.soon ? "opacity-50" : "active:opacity-70"}`}>
    <Ionicons name={it.icon} size={20} color={it.danger ? "#b23a26" : "#2f7d6b"} />
    <Text className={`flex-1 font-bodyb text-[15px] ${it.danger ? "text-vermilion" : "text-ink dark:text-ink-dark"}`}>{it.label}</Text>
    {it.soon ? <Text className="font-bodym text-[11px] text-ink-soft dark:text-ink-softDark">준비중</Text> : it.right}
  </Pressable>
);
const Section = ({ title, items }: { title: string; items: Item[] }) => (
  <View className="mt-2"><Text className="mb-2 ml-1 font-bodyb text-[12px] text-ink-soft dark:text-ink-softDark">{title}</Text>{items.map((it) => <Row key={it.label} it={it} />)}</View>
);

export default function MoreScreen() {
  const { colorScheme, toggleColorScheme } = useColorScheme();
  const router = useRouter();
  const live = useLive(true);
  const dark = colorScheme === "dark";
  const roles = currentRoles();
  const admin = isAdmin(roles);
  const editable = canEdit(roles);
  const loginId = authStore.getLoginId();
  const logout = () => Alert.alert("로그아웃", "로그아웃 할까요?", [
    { text: "취소", style: "cancel" },
    { text: "로그아웃", style: "destructive", onPress: async () => { await authStore.clear(); router.replace("/login"); } },
  ]);

  const work: Item[] = [
    { icon: "grid", label: "대시보드", onPress: () => router.push("/reports") },
  ];
  const adminItems: Item[] = [
    { icon: "pricetags", label: "공통코드", onPress: () => router.push("/admin/codes") },
    { icon: "flame", label: "불사목록", onPress: () => router.push("/admin/items") },
    { icon: "person", label: "포교원장", onPress: () => router.push("/admin/missionaries") },
    { icon: "people", label: "사원", onPress: () => router.push("/admin/staff") },
    { icon: "shield-checkmark", label: "역할·권한", onPress: () => router.push("/admin/roles") },
    { icon: "key", label: "계정 관리", onPress: () => router.push("/admin/accounts") },
    { icon: "server", label: "백업 관리", onPress: () => router.push("/admin/backup") },
  ];
  const settings: Item[] = [
    { icon: "key", label: "비밀번호 변경", onPress: () => router.push("/account/password") },
    { icon: "swap-horizontal", label: "탭 편집", onPress: () => router.push("/tabs-edit") },
    { icon: dark ? "moon" : "sunny", label: "다크 모드", onPress: toggleColorScheme, right: <Text className={`font-bodyb text-sm ${dark ? "text-celadon dark:text-celadon-dark" : "text-ink-soft"}`}>{dark ? "ON" : "OFF"}</Text> },
    { icon: "log-out", label: "로그아웃", onPress: logout, danger: true },
  ];

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-hanji dark:bg-hanji-dark">
      <ScreenHeader title="더보기" subtitle={`불사 · 회원관리 · 회원 ${fmt(live.members.length)}명`} />
      <ScrollView className="flex-1 px-5" contentContainerStyle={{ paddingBottom: 24 }}>
        <View className="mt-3 flex-row items-center gap-3 rounded-2xl border border-line bg-hanji-card p-4 dark:border-line-dark dark:bg-hanji-cardDark">
          <View className="h-11 w-11 items-center justify-center rounded-full bg-celadon-soft dark:bg-celadon-deep/40"><Ionicons name="person" size={20} color="#2f7d6b" /></View>
          <View className="flex-1">
            <Text className="font-bodyb text-[15px] text-ink dark:text-ink-dark">{loginId ?? "—"}</Text>
            <Text className="mt-0.5 font-bodym text-[12px] text-ink-soft dark:text-ink-softDark">{roleLabel(roles) || "권한 없음"}</Text>
          </View>
        </View>
        <Section title="업무" items={work} />
        {admin ? <Section title="관리자" items={adminItems} /> : null}
        <Section title="설정" items={settings} />
        <Text className="mt-3 text-center font-body text-[11px] text-ink-soft dark:text-ink-softDark">불사 · 회원관리 · 네이티브 (Expo)</Text>
      </ScrollView>
    </SafeAreaView>
  );
}
