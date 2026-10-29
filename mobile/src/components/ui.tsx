/* 공용 UI 프리미티브 — 한지·청자 에디토리얼. 명조 디스플레이 + 청자 룰 시그니처. */
import { Text, View } from "react-native";

/** 화면 대형 헤더 — 명조 타이틀 + 청자 하이라이트 룰 + 부제. */
export function ScreenHeader({ title, subtitle, right }: { title: string; subtitle?: string; right?: React.ReactNode }) {
  return (
    <View className="px-5 pb-3 pt-3">
      <View className="flex-row items-end">
        <View className="flex-1">
          <Text className="font-display text-[27px] leading-[34px] text-ink dark:text-ink-dark">{title}</Text>
          {subtitle ? <Text className="mt-1 font-body text-[12px] text-ink-soft dark:text-ink-softDark">{subtitle}</Text> : null}
        </View>
        {right}
      </View>
      <View className="mt-2.5 h-[3px] w-10 rounded-full bg-celadon" />
    </View>
  );
}

/** 낙관(落款) — 주홍 인장 브랜드 마크. */
export function Seal({ size = 56, glyph = "佛" }: { size?: number; glyph?: string }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size * 0.26 }} className="items-center justify-center bg-vermilion shadow-lg">
      <Text style={{ fontSize: size * 0.5 }} className="font-display text-hanji-card">{glyph}</Text>
    </View>
  );
}

/** 섹션 제목(상세/그룹). */
export function SectionTitle({ title, count }: { title: string; count?: number }) {
  return (
    <View className="mb-2 flex-row items-center gap-2">
      <View className="h-3.5 w-1 rounded-full bg-celadon" />
      <Text className="font-bodyb text-[14px] text-ink dark:text-ink-dark">{title}</Text>
      {count != null ? <View className="rounded-full bg-celadon-soft px-2 py-0.5 dark:bg-celadon-deep/30"><Text className="font-bodyb text-[11px] text-celadon dark:text-celadon-dark">{count}</Text></View> : null}
    </View>
  );
}

export function EmptyBox({ children }: { children: React.ReactNode }) {
  return <Text className="rounded-2xl border border-dashed border-line py-6 text-center font-body text-[13px] text-ink-soft dark:border-line-dark dark:text-ink-softDark">{children}</Text>;
}
