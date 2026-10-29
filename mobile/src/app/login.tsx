import { useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { api } from "@/lib/api";
import { authStore } from "@/lib/auth";
import { Seal } from "@/components/ui";

export default function Login() {
  const router = useRouter();
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  // 최초 로그인 강제 비밀번호 변경(웹 LoginScreen 동일) — 변경 전까지 앱 진입 불가.
  const [forceReset, setForceReset] = useState(false);
  const [newPw, setNewPw] = useState("");
  const [newPw2, setNewPw2] = useState("");

  const submit = async () => {
    if (busy) return;
    setBusy(true); setErr(null);
    try {
      const res = await api.post<{ accessToken: string; refreshToken: string; mustResetPassword?: boolean }>("/auth/login", { loginId, password });
      // 토큰 먼저 저장 — 이어지는 change-password 호출이 인증 상태로 나가야 함(웹과 동일).
      await authStore.setTokens(res.accessToken, res.refreshToken);
      await authStore.setLoginId(loginId);
      if (res.mustResetPassword) { setForceReset(true); setBusy(false); return; }
      router.replace("/(tabs)");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "로그인 실패");
      setBusy(false);
    }
  };

  const changePw = async () => {
    if (busy) return;
    setErr(null);
    if (newPw.length < 8) { setErr("새 비밀번호는 8자 이상이어야 합니다."); return; }
    if (newPw !== newPw2) { setErr("새 비밀번호가 일치하지 않습니다."); return; }
    setBusy(true);
    try {
      // currentPassword = 방금 로그인에 쓴 임시 비밀번호.
      await api.post("/auth/change-password", { currentPassword: password, newPassword: newPw });
      router.replace("/(tabs)");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "변경 실패");
      setBusy(false);
    }
  };

  const input = "rounded-2xl border border-line bg-hanji-card px-4 py-3.5 font-body text-[16px] text-ink dark:border-line-dark dark:bg-hanji-cardDark dark:text-ink-dark";

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} className="flex-1 bg-hanji dark:bg-hanji-dark">
      <View className="flex-1 justify-center px-7">
        <View className="mb-10 items-center">
          <Seal size={64} />
          <Text className="mt-5 font-display text-[30px] leading-tight text-ink dark:text-ink-dark">불사 · 회원관리</Text>
          <View className="mt-2 h-[3px] w-10 rounded-full bg-celadon" />
          <Text className="mt-3 font-body text-[13px] tracking-wide text-ink-soft dark:text-ink-softDark">사찰 통합 관리 시스템</Text>
        </View>

        {forceReset ? (
          <View className="gap-3.5">
            <View className="rounded-2xl bg-celadon-soft px-4 py-3 dark:bg-celadon-deep/40">
              <Text className="font-bodym text-[13px] leading-relaxed text-celadon dark:text-celadon-dark">최초 로그인입니다. 임시 비밀번호를 새 비밀번호로 변경해 주세요(8자 이상).</Text>
            </View>
            <View>
              <Text className="mb-1.5 font-bodym text-[12.5px] text-ink-soft dark:text-ink-softDark">새 비밀번호</Text>
              <TextInput value={newPw} onChangeText={setNewPw} secureTextEntry autoCapitalize="none" autoCorrect={false} autoFocus className={input} placeholderTextColor="#a39a88" placeholder="새 비밀번호 (8자 이상)" />
            </View>
            <View>
              <Text className="mb-1.5 font-bodym text-[12.5px] text-ink-soft dark:text-ink-softDark">새 비밀번호 확인</Text>
              <TextInput value={newPw2} onChangeText={setNewPw2} secureTextEntry autoCapitalize="none" autoCorrect={false} onSubmitEditing={changePw} className={input} placeholderTextColor="#a39a88" placeholder="새 비밀번호 다시 입력" />
            </View>
            {err ? <Text className="font-bodym text-[13px] text-vermilion">{err}</Text> : null}
            <Pressable onPress={changePw} disabled={busy} className="mt-2 items-center rounded-2xl bg-celadon py-4 shadow-md active:opacity-80 dark:bg-celadon-deep">
              {busy ? <ActivityIndicator color="#fff" /> : <Text className="font-bodyb text-[16px] text-hanji-card">비밀번호 변경 후 시작</Text>}
            </Pressable>
          </View>
        ) : (
          <View className="gap-3.5">
            <View>
              <Text className="mb-1.5 font-bodym text-[12.5px] text-ink-soft dark:text-ink-softDark">아이디</Text>
              <TextInput value={loginId} onChangeText={setLoginId} autoCapitalize="none" autoCorrect={false} className={input} placeholderTextColor="#a39a88" placeholder="아이디" />
            </View>
            <View>
              <Text className="mb-1.5 font-bodym text-[12.5px] text-ink-soft dark:text-ink-softDark">비밀번호</Text>
              <TextInput value={password} onChangeText={setPassword} secureTextEntry onSubmitEditing={submit} className={input} placeholderTextColor="#a39a88" placeholder="비밀번호" />
            </View>
            {err ? <Text className="font-bodym text-[13px] text-vermilion">{err}</Text> : null}
            <Pressable onPress={submit} disabled={busy} className="mt-2 items-center rounded-2xl bg-celadon py-4 shadow-md active:opacity-80 dark:bg-celadon-deep">
              {busy ? <ActivityIndicator color="#fff" /> : <Text className="font-bodyb text-[16px] text-hanji-card">로그인</Text>}
            </Pressable>
          </View>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}
