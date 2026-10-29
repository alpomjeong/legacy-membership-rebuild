import { useMemo, useState } from "react";
import { ActivityIndicator, Alert, Pressable, RefreshControl, Text, TextInput, View } from "react-native";
import { FlashList } from "@shopify/flash-list";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { ScreenHeader } from "@/components/ui";

export function AdminListScreen<T extends { id: string }>({ title, subtitle, items, loading, onReload, search, renderRow, onAdd, onRow, onDelete, canDelete, addLabel = "추가" }: {
  title: string; subtitle?: string; items: T[]; loading: boolean; onReload: () => void;
  search?: (item: T, q: string) => boolean; renderRow: (item: T) => React.ReactNode;
  onAdd?: () => void; onRow?: (item: T) => void; onDelete?: (item: T) => Promise<void>; canDelete?: (item: T) => boolean; addLabel?: string;
}) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const list = useMemo(() => (q.trim() && search ? items.filter((it) => search(it, q.trim())) : items), [items, q, search]);
  const confirmDelete = (it: T) => Alert.alert("삭제", "삭제할까요?", [
    { text: "취소", style: "cancel" },
    { text: "삭제", style: "destructive", onPress: () => { void onDelete?.(it); } },
  ]);
  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-hanji dark:bg-hanji-dark">
      <View className="flex-row items-center justify-between pr-3">
        <View className="flex-1"><ScreenHeader title={title} subtitle={subtitle ?? `${items.length}건`} /></View>
        <View className="flex-row items-center gap-2">
          {onAdd ? <Pressable onPress={onAdd} hitSlop={8} className="flex-row items-center gap-1 active:opacity-60"><Ionicons name="add" size={18} color="#2f7d6b" /><Text className="font-bodyb text-[14px] text-celadon dark:text-celadon-dark">{addLabel}</Text></Pressable> : null}
          <Pressable onPress={() => router.back()} hitSlop={8} className="active:opacity-60"><Ionicons name="close" size={22} color="#a39a88" /></Pressable>
        </View>
      </View>
      {search ? (
        <View className="px-5 pb-2">
          <View className="flex-row items-center gap-2 rounded-2xl border border-line bg-hanji-card px-3.5 py-3 dark:border-line-dark dark:bg-hanji-cardDark">
            <Ionicons name="search" size={17} color="#a39a88" />
            <TextInput value={q} onChangeText={setQ} placeholder="검색" placeholderTextColor="#a39a88" autoCorrect={false} className="flex-1 font-body text-[15px] text-ink dark:text-ink-dark" />
          </View>
        </View>
      ) : null}
      {loading && items.length === 0 ? (
        <View className="flex-1 items-center justify-center"><ActivityIndicator color="#2f7d6b" /></View>
      ) : (
        <FlashList
          data={list}
          keyExtractor={(it) => it.id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 4, paddingBottom: 24 }}
          ItemSeparatorComponent={() => <View className="h-2" />}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={onReload} tintColor="#2f7d6b" />}
          renderItem={({ item }) => (
            <View className="flex-row items-center gap-2 rounded-2xl border border-line bg-hanji-card p-3.5 dark:border-line-dark dark:bg-hanji-cardDark">
              <Pressable onPress={() => onRow?.(item)} disabled={!onRow} className="flex-1 active:opacity-70">{renderRow(item)}</Pressable>
              {onDelete && (!canDelete || canDelete(item)) ? <Pressable onPress={() => confirmDelete(item)} hitSlop={8} className="p-1 active:opacity-60"><Ionicons name="trash-outline" size={18} color="#b23a26" /></Pressable> : null}
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}
