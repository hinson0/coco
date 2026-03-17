import { Tabs } from 'expo-router';
import { BottomTabBar } from '../../components/shared/BottomTabBar';

export default function TabLayout() {
  return (
    <Tabs
      tabBar={(props) => <BottomTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="index" options={{ title: '首页' }} />
      <Tabs.Screen name="stats" options={{ title: '统计' }} />
      <Tabs.Screen name="ai-placeholder" options={{ title: '' }} />
      <Tabs.Screen name="bills" options={{ title: '账单' }} />
      <Tabs.Screen name="profile" options={{ title: '我的' }} />
    </Tabs>
  );
}
