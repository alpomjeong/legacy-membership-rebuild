import "@/global.css";
import { useState } from "react";
import { View } from "react-native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useFonts } from "expo-font";
import { NanumMyeongjo_700Bold, NanumMyeongjo_800ExtraBold } from "@expo-google-fonts/nanum-myeongjo";
import { NotoSansKR_400Regular, NotoSansKR_500Medium, NotoSansKR_700Bold } from "@expo-google-fonts/noto-sans-kr";

export default function RootLayout() {
  const [qc] = useState(() => new QueryClient({
    defaultOptions: { queries: { retry: 2, staleTime: 30_000, refetchOnWindowFocus: false } },
  }));
  const [fontsLoaded] = useFonts({
    NanumMyeongjo_700Bold, NanumMyeongjo_800ExtraBold,
    NotoSansKR_400Regular, NotoSansKR_500Medium, NotoSansKR_700Bold,
  });
  if (!fontsLoaded) return <View className="flex-1 bg-hanji dark:bg-hanji-dark" />;
  return (
    <QueryClientProvider client={qc}>
      <SafeAreaProvider>
        <StatusBar style="auto" />
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: "transparent" } }}>
          <Stack.Screen name="member/new" options={{ presentation: "modal", headerShown: false }} />
          <Stack.Screen name="member/edit/[id]" options={{ presentation: "modal", headerShown: false }} />
          <Stack.Screen name="counsel/new" options={{ presentation: "modal", headerShown: false }} />
          <Stack.Screen name="bulsa/new" options={{ presentation: "modal", headerShown: false }} />
          <Stack.Screen name="bulsa/edit/[id]" options={{ presentation: "modal", headerShown: false }} />
          <Stack.Screen name="tabs-edit" options={{ presentation: "modal", headerShown: false }} />
          <Stack.Screen name="account/password" options={{ presentation: "modal", headerShown: false }} />
          <Stack.Screen name="admin/codes/new" options={{ presentation: "modal", headerShown: false }} />
          <Stack.Screen name="admin/codes/edit/[id]" options={{ presentation: "modal", headerShown: false }} />
          <Stack.Screen name="admin/missionaries/new" options={{ presentation: "modal", headerShown: false }} />
          <Stack.Screen name="admin/missionaries/edit/[id]" options={{ presentation: "modal", headerShown: false }} />
          <Stack.Screen name="admin/items/new" options={{ presentation: "modal", headerShown: false }} />
          <Stack.Screen name="admin/items/edit/[id]" options={{ presentation: "modal", headerShown: false }} />
          <Stack.Screen name="admin/staff/new" options={{ presentation: "modal", headerShown: false }} />
          <Stack.Screen name="admin/staff/edit/[id]" options={{ presentation: "modal", headerShown: false }} />
          <Stack.Screen name="admin/accounts/new" options={{ presentation: "modal", headerShown: false }} />
          <Stack.Screen name="admin/accounts/edit/[id]" options={{ presentation: "modal", headerShown: false }} />
        </Stack>
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}
