import { useEffect } from 'react';
import { ScrollView, View, StyleSheet, Alert } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '../../hooks/useAuth';
import { useLocalTransactions } from '../../hooks/useLocalTransactions';
import { useProfile, useEnsureProfile } from '../../hooks/useLocalProfile';
import { ProfileHeader } from '../../components/profile/ProfileHeader';
import { StatsStrip } from '../../components/profile/StatsStrip';
import { AiAssistantCard } from '../../components/profile/AiAssistantCard';
import { MenuItem } from '../../components/shared/MenuItem';
import { Card } from '../../components/ui/Card';
import { AppText } from '../../components/ui/AppText';
import { colors } from '../../constants/theme';
import type { Transaction } from '@coco/shared'; // used in computeStats param type

function computeStats(transactions: readonly Transaction[]) {
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  const monthlyCount = transactions.filter((t) => {
    const d = new Date(t.occurred_at);
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
  }).length;

  // compute consecutive days streak
  const uniqueDays = new Set(
    transactions.map((t) => new Date(t.occurred_at).toDateString())
  );
  let streak = 0;
  const today = new Date();
  for (let i = 0; i < 365; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    if (uniqueDays.has(d.toDateString())) {
      streak += 1;
    } else {
      break;
    }
  }

  // compute months with transactions (as budget-target proxy)
  const months = new Set(
    transactions.map((t) => {
      const d = new Date(t.occurred_at);
      return `${d.getFullYear()}-${d.getMonth()}`;
    })
  );
  const budgetMonths = months.size;

  return { monthlyCount, streak, budgetMonths };
}

export default function ProfileScreen() {
  const { session, signOut } = useAuth();
  const { data: txData } = useLocalTransactions();
  const transactions = txData?.data ?? [];
  const { monthlyCount, streak, budgetMonths } = computeStats(transactions);
  const { data: profile } = useProfile();
  const { mutate: ensureProfile } = useEnsureProfile();

  useEffect(() => { ensureProfile(); }, []);

  const userName = profile?.nickname ?? session?.user?.email?.split('@')[0] ?? '棉花用户';

  const handleSignOut = () => {
    Alert.alert('退出登录', '确定要退出吗？', [
      { text: '取消', style: 'cancel' },
      { text: '退出', style: 'destructive', onPress: signOut },
    ]);
  };

  const statsItems = [
    { value: String(monthlyCount), label: '本月笔数' },
    { value: String(streak), label: '连续记账' },
    { value: String(budgetMonths), label: '预算达标月' },
  ];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <ProfileHeader
        name={userName}
        daysCount={streak}
        avatarType={profile?.avatar_type}
        avatarValue={profile?.avatar_value}
        onAvatarPress={() => router.push('/profile-edit')}
      />

      <StatsStrip items={statsItems} />

      <AiAssistantCard />

      {/* 资产管理 */}
      <AppText size="base" color={colors.textLighter} weight="semibold" style={styles.sectionTitle}>
        资产管理
      </AppText>
      <Card padding={0} style={styles.menuCard}>
        <MenuItem icon="💳" iconBg={colors.sagePale} title="我的账户" onPress={() => router.push('/accounts')} />
        <View style={styles.separator} />
        <MenuItem icon="🎯" iconBg={colors.honeyPale} title="预算设置" onPress={() => router.push('/budget-manage')} />
        <View style={styles.separator} />
        <MenuItem icon="🏷️" iconBg={colors.coralPale} title="分类管理" onPress={() => router.push('/category-manage')} />
      </Card>

      {/* 工具 */}
      <AppText size="base" color={colors.textLighter} weight="semibold" style={styles.sectionTitle}>
        工具
      </AppText>
      <Card padding={0} style={styles.menuCard}>
        <MenuItem
          icon="📸"
          iconBg={colors.lavenderPale}
          title="小票识别"
          badge={{ text: 'NEW', variant: 'new' }}
        />
        <View style={styles.separator} />
        <MenuItem icon="📤" iconBg={colors.sagePale} title="导出报表" />
        <View style={styles.separator} />
        <MenuItem icon="🔔" iconBg={colors.honeyPale} title="记账提醒" />
      </Card>

      {/* 其他 */}
      <AppText size="base" color={colors.textLighter} weight="semibold" style={styles.sectionTitle}>
        其他
      </AppText>
      <Card padding={0} style={styles.menuCard}>
        <MenuItem
          icon="🌟"
          iconBg={colors.coralPale}
          title="升级Pro"
          badge={{ text: 'PRO', variant: 'pro' }}
        />
        <View style={styles.separator} />
        <MenuItem icon="💬" iconBg={colors.creamDark} title="意见反馈" />
        <View style={styles.separator} />
        <MenuItem icon="ℹ️" iconBg={colors.creamDark} title="关于棉花记" />
      </Card>

      {/* 退出登录 */}
      <Card style={styles.logoutCard}>
        <AppText
          size="2xl"
          weight="semibold"
          color="#DC2626"
          style={styles.logoutText}
          onPress={handleSignOut}
        >
          退出登录
        </AppText>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.cream,
  },
  content: {
    paddingBottom: 40,
  },
  sectionTitle: {
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 6,
    marginHorizontal: 20,
  },
  menuCard: {
    marginHorizontal: 20,
    marginBottom: 4,
    overflow: 'hidden',
  },
  separator: {
    height: 1,
    backgroundColor: colors.creamDark,
    marginHorizontal: 18,
  },
  logoutCard: {
    marginHorizontal: 20,
    marginTop: 20,
    marginBottom: 8,
    alignItems: 'center',
  },
  logoutText: {
    textAlign: 'center',
  },
});
