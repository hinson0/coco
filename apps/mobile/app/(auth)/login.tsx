import { router } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { AuthButton } from "../../components/auth/AuthButton";
import { AuthInput } from "../../components/auth/AuthInput";
import { AppText } from "../../components/ui/AppText";
import { Card } from "../../components/ui/Card";
import { colors } from "../../constants/theme";
import { useAuth } from "../../hooks/useAuth";

type Tab = "phone" | "email";

export default function LoginScreen() {
  const [tab, setTab] = useState<Tab>("phone");

  // 邮箱登录
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // 手机号登录
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [countdown, setCountdown] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [loading, setLoading] = useState(false);
  const { signIn, sendSmsCode, smsSignIn } = useAuth();

  // 倒计时
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

  const handlePhoneLogin = async () => {
    if (!phone.trim() || !code.trim()) {
      Alert.alert("登录失败", "请填写手机号和验证码");
      return;
    }
    setLoading(true);
    try {
      await smsSignIn(phone.trim(), code.trim());
      Keyboard.dismiss();
      router.replace("/");
    } catch (e: unknown) {
      Alert.alert("登录失败", e instanceof Error ? e.message : "未知错误");
    } finally {
      setLoading(false);
    }
  };

  const handleEmailLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert("登录失败", "请填写邮箱和密码");
      return;
    }
    setLoading(true);
    try {
      await signIn(email.trim(), password);
      Keyboard.dismiss();
      router.replace("/");
    } catch (e: unknown) {
      Alert.alert("登录失败", e instanceof Error ? e.message : "未知错误");
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
        <View style={styles.hero}>
          <AppText size="3xl" style={styles.logo}>
            🌿
          </AppText>
          <AppText size="6xl" weight="bold" style={styles.appName}>
            CoCo
          </AppText>
          <AppText size="lg" color={colors.textLighter} style={styles.tagline}>
            AI 智能记账助手
          </AppText>
        </View>

        <Card radius="xl" padding={24} style={styles.card}>
          {/* Tab 切换 */}
          <View style={styles.tabRow}>
            <Pressable
              style={[styles.tab, tab === "phone" && styles.tabActive]}
              onPress={() => setTab("phone")}
            >
              <AppText
                size="xl"
                weight={tab === "phone" ? "semibold" : "regular"}
                color={tab === "phone" ? colors.sage : colors.textLighter}
              >
                手机号登录
              </AppText>
            </Pressable>
            <Pressable
              style={[styles.tab, tab === "email" && styles.tabActive]}
              onPress={() => setTab("email")}
            >
              <AppText
                size="xl"
                weight={tab === "email" ? "semibold" : "regular"}
                color={tab === "email" ? colors.sage : colors.textLighter}
              >
                邮箱登录
              </AppText>
            </Pressable>
          </View>

          {tab === "phone" ? (
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
              <AuthButton
                title="登录"
                onPress={handlePhoneLogin}
                loading={loading}
              />
            </View>
          ) : (
            <View style={styles.inputGroup}>
              <AuthInput
                placeholder="邮箱"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
              <AuthInput
                placeholder="密码"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
              />
              <AuthButton
                title="登录"
                onPress={handleEmailLogin}
                loading={loading}
              />
            </View>
          )}
        </Card>

        {tab === "email" && (
          <View style={styles.linkRow}>
            <AppText size="xl" color={colors.textLight}>
              还没有账号？
            </AppText>
            <Pressable onPress={() => router.push("/(auth)/register")}>
              <AppText size="xl" color={colors.sage} weight="semibold">
                去注册
              </AppText>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.cream,
  },
  content: {
    flexGrow: 1,
    justifyContent: "flex-start",
    paddingHorizontal: 0,
    paddingTop: 100,
    paddingBottom: 40,
  },
  hero: {
    alignItems: "center",
    marginBottom: 32,
    gap: 4,
  },
  logo: {
    fontSize: 72,
    lineHeight: 80,
    textAlign: "center",
  },
  appName: {
    textAlign: "center",
  },
  tagline: {
    textAlign: "center",
    marginTop: 4,
  },
  card: {
    marginHorizontal: 24,
  },
  tabRow: {
    flexDirection: "row",
    marginBottom: 16,
    gap: 0,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    paddingBottom: 8,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  tabActive: {
    borderBottomColor: colors.sage,
  },
  inputGroup: {
    gap: 12,
  },
  codeRow: {
    flexDirection: "row",
    gap: 8,
  },
  codeInput: {
    flex: 1,
  },
  sendBtn: {
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.sage,
    borderRadius: 12,
    height: 48,
  },
  sendBtnDisabled: {
    borderColor: colors.creamDark,
  },
  linkRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 20,
    gap: 4,
  },
});
