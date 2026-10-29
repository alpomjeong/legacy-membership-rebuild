import type { ColorValue } from "react-native";
import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useColorScheme } from "nativewind";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ALL_TABS, useTabIds } from "@/lib/nav";

// 탭 아이콘 컴포넌트 팩토리(모듈 스코프 + 명명 컴포넌트 → display-name/정적컴포넌트 규칙 충족).
const icon = (name: keyof typeof Ionicons.glyphMap) => {
  const TabIcon = ({ color, size }: { color: ColorValue; size: number }) => (
    <Ionicons name={name} size={size - 1} color={color as string} />
  );
  return TabIcon;
};

export default function TabsLayout() {
  const { colorScheme } = useColorScheme();
  const dark = colorScheme === "dark";
  const insets = useSafeAreaInsets();
  const selected = useTabIds();
  return (
    <Tabs screenOptions={{
      headerShown: false,
      tabBarActiveTintColor: dark ? "#4cae95" : "#2f7d6b",
      tabBarInactiveTintColor: dark ? "#6f675a" : "#b0a690",
      tabBarStyle: { backgroundColor: dark ? "#221e16" : "#fffdf8", borderTopColor: dark ? "#332d22" : "#e8e0cf", borderTopWidth: 1, paddingTop: 6, paddingBottom: Math.max(insets.bottom, 8), height: 58 + insets.bottom },
      tabBarLabelStyle: { fontFamily: "NotoSansKR_700Bold", fontSize: 10.5, marginTop: 1 },
    }}>
      {ALL_TABS.map((t) => (
        <Tabs.Screen key={t.id} name={t.id} options={{ title: t.title, tabBarIcon: icon(t.icon), href: selected.includes(t.id) ? undefined : null }} />
      ))}
      <Tabs.Screen name="more" options={{ title: "더보기", tabBarIcon: icon("ellipsis-horizontal") }} />
    </Tabs>
  );
}
