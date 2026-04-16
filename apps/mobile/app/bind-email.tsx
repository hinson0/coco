import { router } from "expo-router";
import { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { AuthButton } from "../components/auth/AuthButton";
import { AuthInput } from "../components/auth/AuthInput";
import { AppText } from "../components/ui/AppText";
import { Card } from "../components/ui/Card";
import { colors } from "../constants/theme";
import { apiFetch } from "../lib/api";

export default function BindEmailScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleBind = async () => {
    if (!email.trim() || !password.trim() || !confirmPassword.trim()) {
      Alert.alert("提示", "请填写所有字段");
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert("提示", "两次密码不一致");
      return;
    }
    setLoading(true);
    try {
      await apiFetch("/auth/bind/email", {
        method: "POST",
        body: JSON.stringify({ email: email.trim(), password }),
      });
      Alert.alert("绑定成功", "邮箱绑定成功", [
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
          绑定邮箱
        </AppText>

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
            <AuthInput
              placeholder="确认密码"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
            />
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
});
