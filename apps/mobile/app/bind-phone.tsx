import { router } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { AuthButton } from "../components/auth/AuthButton";
import { AuthInput } from "../components/auth/AuthInput";
import { AppText } from "../components/ui/AppText";
import { Card } from "../components/ui/Card";
import { colors } from "../constants/theme";
import { useAuth } from "../hooks/useAuth";
import { apiFetch } from "../lib/api";

export default function BindPhoneScreen() {
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [countdown, setCountdown] = useState(0);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const { sendSmsCode } = useAuth();

  useEffect(() => {
    if (countdown <= 0) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }
    timerRef.current = setInterval(() => {
      setCountdown((prev) => prev - 1);
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [countdown]);

  const handleSendCode = useCallback(async () => {
    const trimmed = phone.trim();
    if (!/^1[3-9]\d{9}$/.test(trimmed)) {
      Alert.alert("提示", "请输入正确的手机号");
      return;
    }
    try {
      await sendSmsCode(trimmed);
      setCountdown(60);
    } catch (e: unknown) {
      Alert.alert("发送失败", e instanceof Error ? e.message : "未知错误");
    }
  }, [phone, sendSmsCode]);

  const handleBind = async () => {
    if (!phone.trim() || !code.trim()) {
      Alert.alert("提示", "请填写手机号和验证码");
      return;
    }
    setLoading(true);
    try {
      await apiFetch("/auth/bind/phone", {
        method: "POST",
        body: JSON.stringify({ phone: phone.trim(), code: code.trim() }),
      });
      Alert.alert("绑定成功", "手机号绑定成功", [
        { text: "好的", onPress: () => router.back() },
      ]);
    } catch (e: unknown) {
      Alert.alert("绑定失败", e instanceof Error ? e.message : "未知错误");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <AppText size="3xl" weight="bold" style={styles.title}>
          绑定手机号
        </AppText>

        <Card radius="xl" padding={24} style={styles.card}>
          <View style={styles.inputGroup}>
            <AuthInput
              placeholder="手机号"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
            />
            <View style={styles.codeRow}>
              <View style={styles.codeInput}>
                <AuthInput
                  placeholder="验证码"
                  value={code}
                  onChangeText={setCode}
                  keyboardType="number-pad"
                />
              </View>
              <Pressable
                style={[
                  styles.sendBtn,
                  countdown > 0 && styles.sendBtnDisabled,
                ]}
                onPress={handleSendCode}
                disabled={countdown > 0}
              >
                <AppText
                  size="base"
                  weight="semibold"
                  color={countdown > 0 ? colors.textLighter : colors.sage}
                >
                  {countdown > 0 ? `${countdown}s` : "发送验证码"}
                </AppText>
              </Pressable>
            </View>
          </View>
          <AuthButton title="绑定" onPress={handleBind} loading={loading} />
        </Card>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cream },
  content: { paddingTop: 80, paddingBottom: 40 },
  title: { textAlign: "center", marginBottom: 24 },
  card: { marginHorizontal: 24 },
  inputGroup: { gap: 12, marginBottom: 16 },
  codeRow: { flexDirection: "row", gap: 8 },
  codeInput: { flex: 1 },
  sendBtn: {
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.sage,
    borderRadius: 12,
    height: 48,
  },
  sendBtnDisabled: { borderColor: colors.creamDark },
});
