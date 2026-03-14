import { Tabs } from "expo-router";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";

function DiamondButton() {
  return (
    <TouchableOpacity style={styles.diamondWrapper} onPress={() => router.push("/chat")}>
      <LinearGradient colors={["#f59e0b", "#ef4444"]} style={styles.diamond}>
        <View style={styles.diamondInner}>
          <Text style={styles.diamondText}>✦ AI</Text>
        </View>
      </LinearGradient>
      <Text style={styles.diamondLabel}>记账</Text>
    </TouchableOpacity>
  );
}

function TabIcon({ emoji }: { emoji: string }) {
  return (
    <View>
      <Text style={{ fontSize: 20 }}>{emoji}</Text>
    </View>
  );
}

export default function TabLayout() {
  return (
    <Tabs screenOptions={{
      tabBarStyle: { backgroundColor: "#1e293b", borderTopColor: "#334155", height: 60, paddingBottom: 8 },
      tabBarActiveTintColor: "#818cf8",
      tabBarInactiveTintColor: "#94a3b8",
      headerShown: false,
    }}>
      <Tabs.Screen name="index" options={{ title: "首页", tabBarIcon: () => <TabIcon emoji="🏠" /> }} />
      <Tabs.Screen name="stats" options={{ title: "统计", tabBarIcon: () => <TabIcon emoji="📊" /> }} />
      <Tabs.Screen name="ai-placeholder" options={{
        title: "",
        tabBarButton: () => <DiamondButton />,
      }} />
      <Tabs.Screen name="budget" options={{ title: "预算", tabBarIcon: () => <TabIcon emoji="🎯" /> }} />
      <Tabs.Screen name="profile" options={{ title: "我的", tabBarIcon: () => <TabIcon emoji="👤" /> }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  diamondWrapper: { top: -20, justifyContent: "center", alignItems: "center" },
  diamond: {
    width: 56, height: 56, borderRadius: 16, transform: [{ rotate: "45deg" }],
    backgroundColor: "#f59e0b", justifyContent: "center", alignItems: "center",
    shadowColor: "#f59e0b", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 10,
    elevation: 8,
  },
  diamondInner: { transform: [{ rotate: "-45deg" }], alignItems: "center" },
  diamondText: { color: "#fff", fontSize: 14, fontWeight: "800" },
  diamondLabel: { color: "#fbbf24", fontSize: 9, fontWeight: "600", marginTop: 3 },
});
