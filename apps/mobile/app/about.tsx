import { View, ScrollView, StyleSheet, Alert, Linking } from 'react-native';
import { TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import { AppText } from '../components/ui/AppText';
import { Card } from '../components/ui/Card';
import { MenuItem } from '../components/shared/MenuItem';
import { colors } from '../constants/theme';

const version = Constants.expoConfig?.version ?? '1.0.0';

const features = [
  { emoji: '🤖', label: 'AI 智能记账' },
  { emoji: '🎤', label: '语音记账' },
  { emoji: '📸', label: '小票识别' },
  { emoji: '📊', label: '预算管理与统计' },
  { emoji: '💰', label: '多账户管理' },
  { emoji: '📤', label: '报表导出' },
];

export default function AboutScreen() {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <AppText size="2xl">←</AppText>
        </TouchableOpacity>
        <AppText size="2xl" weight="semibold">关于棉花记</AppText>
        <View style={styles.backBtn} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Logo 区 */}
        <View style={styles.logoSection}>
          <AppText style={{ fontSize: 60 }}>🍃</AppText>
          <AppText size="4xl" weight="bold" color={colors.text}>棉花记</AppText>
          <AppText size="base" color={colors.textLighter}>v{version}</AppText>
        </View>

        {/* 功能亮点区 */}
        <View style={styles.section}>
          <AppText size="base" weight="medium" color={colors.textLighter} style={styles.sectionTitle}>
            功能亮点
          </AppText>
          <Card padding={0}>
            {features.map((item, index) => (
              <View key={item.label}>
                <View style={styles.featureRow}>
                  <AppText size="2xl">{item.emoji}</AppText>
                  <AppText size="xl" weight="medium" color={colors.text}>{item.label}</AppText>
                </View>
                {index < features.length - 1 && <View style={styles.divider} />}
              </View>
            ))}
          </Card>
        </View>

        {/* 更多操作区 */}
        <View style={styles.section}>
          <Card padding={0}>
            <MenuItem
              icon="🔄"
              iconBg={colors.sagePale}
              title="检查更新"
              onPress={() => Alert.alert('提示', '已是最新版本')}
            />
            <View style={styles.divider} />
            <MenuItem
              icon="📋"
              iconBg={colors.honeyPale}
              title="用户协议"
              onPress={() => Linking.openURL('https://example.com/terms')}
            />
            <View style={styles.divider} />
            <MenuItem
              icon="🔒"
              iconBg={colors.lavenderPale}
              title="隐私政策"
              onPress={() => Linking.openURL('https://example.com/privacy')}
            />
          </Card>
        </View>

        {/* 底部版权信息 */}
        <View style={styles.footer}>
          <AppText size="sm" color={colors.textLighter}>联系我们: feedback@example.com</AppText>
          <AppText size="sm" color={colors.textLighter} style={{ marginTop: 4 }}>© 2025 棉花记</AppText>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.cream,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  backBtn: {
    width: 40,
    alignItems: 'flex-start',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
  },
  logoSection: {
    alignItems: 'center',
    paddingTop: 40,
    paddingBottom: 30,
    gap: 6,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    marginBottom: 10,
    marginLeft: 4,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 18,
    gap: 12,
  },
  divider: {
    height: 1,
    backgroundColor: colors.creamDark,
    marginHorizontal: 18,
  },
  footer: {
    alignItems: 'center',
    paddingTop: 24,
    paddingBottom: 8,
  },
});
