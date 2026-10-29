import { Redirect } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import { useAuth } from "@/lib/use-auth";

export default function Index() {
  const { authed, ready } = useAuth();
  if (!ready) {
    return (
      <View className="flex-1 items-center justify-center bg-hanji dark:bg-hanji-dark">
        <ActivityIndicator color="#2f7d6b" />
      </View>
    );
  }
  return <Redirect href={authed ? "/(tabs)" : "/login"} />;
}
