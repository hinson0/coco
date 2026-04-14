import { router } from "expo-router";
import { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { AuthButton } from "../../components/auth/AuthButton";
import { AuthInput } from "../../components/auth/AuthInput";
import { AppText } from "../../components/ui/AppText";
import { Card } from "../../components/ui/Card";
import { colors } from "../../constants/theme";
import { useAuth } from "../../hooks/useAuth";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { signIn } = useAuth();

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert("登录失败", "请填写邮箱和密码");
      return;
    }
    setLoading(true);
    try {
      await signIn(email.trim(), password);
      router.replace("/");
    } catch (e: any) {
      Alert.alert("登录失败", e.message);
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
          </View>
          <AuthButton title="登录" onPress={handleLogin} loading={loading} />
        </Card>

        <View style={styles.linkRow}>
          <AppText size="xl" color={colors.textLight}>
            还没有账号？
          </AppText>
          <TouchableOpacity
            onPress={() => router.push("/(auth)/register")}
            activeOpacity={0.7}
          >
            <AppText size="xl" color={colors.sage} weight="semibold">
              去注册
            </AppText>
          </TouchableOpacity>
        </View>
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
  inputGroup: {
    gap: 12,
    marginBottom: 16,
  },
  linkRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 20,
    gap: 4,
  },
});
