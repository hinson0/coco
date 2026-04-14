import { View, ScrollView, StyleSheet } from "react-native";
import { TouchableOpacity } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppText } from "../components/ui/AppText";
import { Card } from "../components/ui/Card";
import { colors, radii, spacing } from "../constants/theme";

export default function AiHelpScreen() {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backBtn}
          activeOpacity={0.7}
        >
          <AppText size="2xl">←</AppText>
        </TouchableOpacity>
        <AppText size="2xl" weight="semibold">
          使用帮助
        </AppText>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + 40 },
        ]}
      >
        <AppText size="2xl" weight="bold" style={styles.title}>
          CoCo AI 能帮你做什么？
        </AppText>

        <AppText size="xl" color={colors.textLight} style={styles.paragraph}>
          三种方式快速记账，随时随地记录每一笔消费和收入。
        </AppText>

        {/* 文字记账 */}
        <View style={styles.featureItem}>
          <AppText size="3xl" style={styles.featureIcon}>
            ✏️
          </AppText>
          <View style={{ flex: 1 }}>
            <AppText size="xl" weight="semibold">
              文字记账
            </AppText>
            <AppText
              size="lg"
              color={colors.textLight}
              style={{ marginTop: 2 }}
            >
              直接输入"午饭 30"、"打车 15 元"、"工资 8000 收入"，AI
              自动识别金额、分类和类型
            </AppText>
          </View>
        </View>

        <Card style={styles.exampleCard}>
          <AppText size="base" color={colors.textLighter}>
            试试这样说：
          </AppText>
          <AppText size="lg" weight="medium" style={{ marginTop: 6 }}>
            "咖啡 28"
          </AppText>
          <AppText size="lg" weight="medium" style={{ marginTop: 4 }}>
            "地铁充值 200"
          </AppText>
          <AppText size="lg" weight="medium" style={{ marginTop: 4 }}>
            "收到转账 500 收入"
          </AppText>
        </Card>

        {/* 语音记账 */}
        <View style={styles.featureItem}>
          <AppText size="3xl" style={styles.featureIcon}>
            🎙️
          </AppText>
          <View style={{ flex: 1 }}>
            <AppText size="xl" weight="semibold">
              语音记账
            </AppText>
            <AppText
              size="lg"
              color={colors.textLight}
              style={{ marginTop: 2 }}
            >
              长按麦克风按钮说话，松手自动识别语音内容并记账
            </AppText>
          </View>
        </View>

        {/* 拍照记账 */}
        <View style={styles.featureItem}>
          <AppText size="3xl" style={styles.featureIcon}>
            📷
          </AppText>
          <View style={{ flex: 1 }}>
            <AppText size="xl" weight="semibold">
              拍小票记账
            </AppText>
            <AppText
              size="lg"
              color={colors.textLight}
              style={{ marginTop: 2 }}
            >
              点击相机按钮拍摄小票或截图，AI 自动识别金额并记账
            </AppText>
          </View>
        </View>

        {/* 手动记账 */}
        <View style={styles.featureItem}>
          <AppText size="3xl" style={styles.featureIcon}>
            📝
          </AppText>
          <View style={{ flex: 1 }}>
            <AppText size="xl" weight="semibold">
              手动记账
            </AppText>
            <AppText
              size="lg"
              color={colors.textLight}
              style={{ marginTop: 2 }}
            >
              点击下方"手动记账"按钮，手动填写金额、分类、日期等信息
            </AppText>
          </View>
        </View>

        {/* 自动记账 */}
        <View style={styles.featureItem}>
          <AppText size="3xl" style={styles.featureIcon}>
            🤖
          </AppText>
          <View style={{ flex: 1 }}>
            <AppText size="xl" weight="semibold">
              自动记账（Android）
            </AppText>
            <AppText
              size="lg"
              color={colors.textLight}
              style={{ marginTop: 2 }}
            >
              开启通知监听后，微信支付和支付宝的每一笔消费都会自动记录，无需手动操作
            </AppText>
          </View>
        </View>

        {/* 提示 */}
        <Card style={styles.tipCard}>
          <AppText size="lg" color={colors.text}>
            💡 小技巧
          </AppText>
          <AppText size="lg" color={colors.textLight} style={{ marginTop: 6 }}>
            不确定分类时直接输入金额即可，AI 会根据描述自动匹配最合适的分类。
          </AppText>
          <AppText size="lg" color={colors.textLight} style={{ marginTop: 6 }}>
            记错了？长按消息可以删除，点击记账卡片上的"编辑"可以修改。
          </AppText>
        </Card>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cream },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.creamDark,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: radii.sm,
    backgroundColor: colors.cream,
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    padding: spacing.xxl,
  },
  title: {
    marginBottom: spacing.lg,
  },
  paragraph: {
    marginBottom: spacing.xl,
  },
  featureItem: {
    flexDirection: "row",
    gap: 12,
    marginBottom: spacing.xl,
  },
  featureIcon: {
    width: 32,
  },
  exampleCard: {
    marginBottom: spacing.xl,
  },
  tipCard: {
    backgroundColor: colors.sagePale,
    borderRadius: radii.md,
    marginTop: spacing.lg,
  },
});
