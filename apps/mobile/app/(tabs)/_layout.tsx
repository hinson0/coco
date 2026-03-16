import { Tabs } from "expo-router";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { router } from "expo-router";

function AiButton() {
  return (
    <TouchableOpacity style={styles.aiWrapper} onPress={() => router.push("/chat")}>
      <View style={styles.aiButton}>
        <Text style={styles.aiText}>AI</Text>
      </View>
      <Text style={styles.aiLabel}>记账</Text>
    </TouchableOpacity>
  );
}

function TabIcon({ emoji }: { readonly emoji: string }) {
  return <Text style={{ fontSize: 20 }}>{emoji}</Text>;
}

export default function TabLayout() {
  return (
    <Tabs screenOptions={{
      tabBarStyle: {
        backgroundColor: "#fff",
        borderTopColor: "#E5E7EB",
        height: 60,
        paddingBottom: 8,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.04,
        shadowRadius: 8,
        elevation: 4,
      },
      tabBarActiveTintColor: "#2D9B83",
      tabBarInactiveTintColor: "#94a3b8",
      headerShown: false,
    }}>
      <Tabs.Screen name="index" options={{ title: "首页", tabBarIcon: () => <TabIcon emoji="🏠" /> }} />
      <Tabs.Screen name="stats" options={{ title: "统计", tabBarIcon: () => <TabIcon emoji="📊" /> }} />
      <Tabs.Screen name="ai-placeholder" options={{
        title: "",
        tabBarButton: () => <AiButton />,
      }} />
      <Tabs.Screen name="budget" options={{ title: "预算", tabBarIcon: () => <TabIcon emoji="🎯" /> }} />
      <Tabs.Screen name="profile" options={{ title: "我的", tabBarIcon: () => <TabIcon emoji="👤" /> }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  aiWrapper: { top: -18, justifyContent: "center", alignItems: "center" },
  aiButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#2D9B83",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#2D9B83",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
  },
  aiText: { color: "#fff", fontSize: 15, fontWeight: "800" },
  aiLabel: { color: "#2D9B83", fontSize: 9, fontWeight: "600", marginTop: 3 },
});
