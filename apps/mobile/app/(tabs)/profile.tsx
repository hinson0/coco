import { View, Text, TouchableOpacity, StyleSheet, Alert, ScrollView } from "react-native";
import { useAuth } from "../../hooks/useAuth";
import { supabase } from "../../lib/supabase";

export default function ProfileScreen() {
  const { session, signOut } = useAuth();

  const handleExport = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const now = new Date();
      const startDate = new Date(now.getFullYear(), now.getMonth() - 3, 1).toISOString().slice(0, 10);
      const endDate = now.toISOString().slice(0, 10);
      const API_BASE = process.env.EXPO_PUBLIC_API_URL!;

      const resp = await fetch(`${API_BASE}/api/export?start_date=${startDate}&end_date=${endDate}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (resp.ok) {
        const csv = await resp.text();
        Alert.alert("导出成功", `已导出 ${csv.split("\\n").length - 1} 条记录`);
      } else {
        Alert.alert("导出失败", "请重试");
      }
    } catch {
      Alert.alert("导出失败", "网络错误");
    }
  };

  const handleSignOut = () => {
    Alert.alert("退出登录", "确定要退出吗？", [
      { text: "取消", style: "cancel" },
      { text: "退出", style: "destructive", onPress: signOut },
    ]);
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.pageTitle}>我的</Text>

      {/* Account info */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>账号信息</Text>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>邮箱</Text>
          <Text style={styles.infoValue}>{session?.user?.email ?? "-"}</Text>
        </View>
      </View>

      {/* Menu items */}
      <View style={styles.section}>
        <TouchableOpacity style={styles.menuItem}>
          <Text style={styles.menuIcon}>📂</Text>
          <Text style={styles.menuText}>分类管理</Text>
          <Text style={styles.menuArrow}>›</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.menuItem} onPress={handleExport}>
          <Text style={styles.menuIcon}>📥</Text>
          <Text style={styles.menuText}>导出数据 (CSV)</Text>
          <Text style={styles.menuArrow}>›</Text>
        </TouchableOpacity>
      </View>

      {/* Sign out */}
      <TouchableOpacity style={styles.logoutBtn} onPress={handleSignOut}>
        <Text style={styles.logoutText}>退出登录</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f172a", paddingTop: 50 },
  pageTitle: { color: "#fff", fontSize: 24, fontWeight: "700", paddingHorizontal: 16, marginBottom: 16 },
  section: { marginHorizontal: 16, marginBottom: 16, backgroundColor: "#1e293b", borderRadius: 12, overflow: "hidden" },
  sectionTitle: { color: "#94a3b8", fontSize: 12, padding: 14, paddingBottom: 0 },
  infoRow: { flexDirection: "row", justifyContent: "space-between", padding: 14 },
  infoLabel: { color: "#94a3b8", fontSize: 14 },
  infoValue: { color: "#fff", fontSize: 14 },
  menuItem: { flexDirection: "row", alignItems: "center", padding: 14, borderBottomWidth: 1, borderBottomColor: "#334155" },
  menuIcon: { fontSize: 18, marginRight: 12 },
  menuText: { color: "#fff", fontSize: 14, flex: 1 },
  menuArrow: { color: "#64748b", fontSize: 18 },
  logoutBtn: { margin: 16, padding: 14, borderRadius: 12, backgroundColor: "#1e293b", alignItems: "center" },
  logoutText: { color: "#ef4444", fontSize: 16, fontWeight: "600" },
});
