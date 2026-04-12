import { Modal, View, StyleSheet, TouchableOpacity } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppText } from "../ui/AppText";
import { colors, radii, spacing } from "../../constants/theme";

interface EntitlementGateProps {
  readonly visible: boolean;
  readonly onClose: () => void;
  readonly featureLabel: string;
}

export function EntitlementGate({
  visible,
  onClose,
  featureLabel,
}: EntitlementGateProps) {
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <TouchableOpacity
          style={styles.overlayTouch}
          activeOpacity={1}
          onPress={onClose}
        />
        <View
          style={[
            styles.sheet,
            { paddingBottom: Math.max(insets.bottom, 16) + 24 },
          ]}
        >
          <View style={styles.header}>
            <AppText size="2xl" weight="semibold">
              权益不足
            </AppText>
            <TouchableOpacity onPress={onClose} activeOpacity={0.7}>
              <AppText size="2xl" color={colors.textLighter}>
                ✕
              </AppText>
            </TouchableOpacity>
          </View>

          <View style={styles.body}>
            <AppText size="3xl" style={styles.icon}>
              🔒
            </AppText>
            <AppText
              size="xl"
              weight="medium"
              color={colors.text}
              style={styles.msg}
            >
              {featureLabel}需要权益才能使用
            </AppText>
            <AppText size="base" color={colors.textLight} style={styles.msg}>
              观看广告即可免费解锁，或升级 Pro 无限使用
            </AppText>
          </View>

          <View style={styles.buttons}>
            <TouchableOpacity
              style={styles.adBtn}
              activeOpacity={0.8}
              onPress={() => {
                onClose();
                router.push("/(tabs)/bills");
              }}
            >
              <AppText size="xl" weight="semibold" color={colors.white}>
                🎬 去看广告
              </AppText>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.proBtn}
              activeOpacity={0.8}
              onPress={() => {
                onClose();
                router.push("/upgrade-pro");
              }}
            >
              <AppText size="xl" weight="semibold" color={colors.sage}>
                👑 升级 Pro
              </AppText>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.3)",
  },
  overlayTouch: { flex: 1 },
  sheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: radii.xxl,
    borderTopRightRadius: radii.xxl,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.xxl,
    paddingBottom: spacing.lg,
  },
  body: {
    alignItems: "center",
    paddingHorizontal: spacing.xxl,
    paddingBottom: spacing.xxl,
    gap: 8,
  },
  icon: { marginBottom: 4 },
  msg: { textAlign: "center" },
  buttons: { paddingHorizontal: spacing.xxl, gap: 12 },
  adBtn: {
    backgroundColor: colors.sage,
    borderRadius: radii.lg,
    paddingVertical: 16,
    alignItems: "center",
  },
  proBtn: {
    borderWidth: 1,
    borderColor: colors.sage,
    borderRadius: radii.lg,
    paddingVertical: 16,
    alignItems: "center",
  },
});
