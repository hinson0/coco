import { View } from "react-native";
import { Tabs } from "expo-router";
import { BottomTabBar } from "../../components/shared/BottomTabBar";

export default function TabLayout() {
  return (
    <View style={{ flex: 1 }}>
      <Tabs
        tabBar={(props) => <BottomTabBar {...props} />}
        screenOptions={{ headerShown: false }}
      >
        <Tabs.Screen name="diary" options={{ title: "账单" }} />
        <Tabs.Screen name="stats" options={{ title: "统计" }} />
        <Tabs.Screen name="ai-placeholder" options={{ title: "" }} />
        <Tabs.Screen name="bills" options={{ title: "自动" }} />
        <Tabs.Screen name="profile" options={{ title: "我的" }} />
      </Tabs>
    </View>
  );
}
