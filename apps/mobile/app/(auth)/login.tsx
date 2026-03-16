import { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from "react-native";
import { useAuth } from "../../hooks/useAuth";
import { router } from "expo-router";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { signIn } = useAuth();

  const handleLogin = async () => {
    try {
      await signIn(email, password);
      router.replace("/(tabs)");
    } catch (e: any) {
      Alert.alert("登录失败", e.message);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>CoCo</Text>
      <Text style={styles.subtitle}>智能记账助手</Text>
      <TextInput style={styles.input} placeholder="邮箱" placeholderTextColor="#94a3b8" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
      <TextInput style={styles.input} placeholder="密码" placeholderTextColor="#94a3b8" value={password} onChangeText={setPassword} secureTextEntry />
      <TouchableOpacity style={styles.button} onPress={handleLogin}>
        <Text style={styles.buttonText}>登录</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => router.push("/(auth)/register")}>
        <Text style={styles.link}>没有账号？去注册</Text>
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
