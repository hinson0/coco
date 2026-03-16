import { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from "react-native";
import { useAuth } from "../../hooks/useAuth";
import { router } from "expo-router";

export default function RegisterScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const { signUp } = useAuth();

  const handleRegister = async () => {
    if (password !== confirmPassword) {
      Alert.alert("注册失败", "两次密码不一致");
      return;
    }
    try {
      await signUp(email, password);
      Alert.alert("注册成功", "请检查邮箱完成验证", [
        { text: "好的", onPress: () => router.replace("/(auth)/login") },
      ]);
    } catch (e: any) {
      Alert.alert("注册失败", e.message);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>创建账号</Text>
      <Text style={styles.subtitle}>注册开始记账</Text>
      <TextInput style={styles.input} placeholder="邮箱" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" placeholderTextColor="#94a3b8" />
      <TextInput style={styles.input} placeholder="密码" value={password} onChangeText={setPassword} secureTextEntry placeholderTextColor="#94a3b8" />
      <TextInput style={styles.input} placeholder="确认密码" value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry placeholderTextColor="#94a3b8" />
      <TouchableOpacity style={styles.button} onPress={handleRegister}>
        <Text style={styles.buttonText}>注册</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => router.push("/(auth)/login")}>
        <Text style={styles.link}>已有账号？去登录</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", padding: 24, backgroundColor: "#F5F5F5" },
  title: { fontSize: 36, fontWeight: "800", color: "#2D9B83", textAlign: "center", marginBottom: 4 },
  subtitle: { fontSize: 14, color: "#94a3b8", textAlign: "center", marginBottom: 40 },
  input: { backgroundColor: "#fff", color: "#1e293b", padding: 14, borderRadius: 12, marginBottom: 12, fontSize: 16, borderWidth: 1, borderColor: "#E5E7EB" },
  button: { backgroundColor: "#2D9B83", padding: 16, borderRadius: 12, alignItems: "center", marginTop: 8 },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  link: { color: "#2D9B83", textAlign: "center", marginTop: 16 },
});
