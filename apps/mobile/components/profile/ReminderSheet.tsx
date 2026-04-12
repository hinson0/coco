import AsyncStorage from "@react-native-async-storage/async-storage";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useEffect, useState } from "react";
import {
  Alert,
  Modal,
  Platform,
  StyleSheet,
  Switch,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, radii, spacing } from "../../constants/theme";
import { AppText } from "../ui/AppText";

// 动态加载 expo-notifications（Expo Go 中不可用，静默降级）
let Notifications: typeof import("expo-notifications") | null = null;
try {
  Notifications = require("expo-notifications");
} catch {}

const STORAGE_KEY = "reminder_settings";
const NOTIFICATION_ID = "daily-reminder";

const REMINDER_MESSAGES = [
  "今天还没记账哦，花了多少记一笔吧 🌿",
  "别忘了记账～好习惯从每一天开始 ✨",
  "今日账单还空着呢，来记一笔吧 📝",
  "坚持记账，让每一分钱都有去处 💰",
  "记账时间到！回顾一下今天的花销吧 🧾",
  "棉花记提醒你：今天记账了吗？ 🌸",
];

interface ReminderSettings {
  enabled: boolean;
  hour: number;
  minute: number;
}

const DEFAULT_SETTINGS: ReminderSettings = {
  enabled: false,
  hour: 21,
  minute: 0,
};

async function loadSettings(): Promise<ReminderSettings> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return DEFAULT_SETTINGS;
  try {
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

async function saveSettings(settings: ReminderSettings): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

async function scheduleReminder(hour: number, minute: number): Promise<void> {
  if (!Notifications) return;
  try {
    await Notifications.cancelScheduledNotificationAsync(NOTIFICATION_ID).catch(
      () => {},
    );

    const message =
      REMINDER_MESSAGES[Math.floor(Math.random() * REMINDER_MESSAGES.length)];

    await Notifications.scheduleNotificationAsync({
      identifier: NOTIFICATION_ID,
      content: {
        title: "记账提醒",
        body: message,
        sound: true,
        ...(Platform.OS === "android" && { channelId: "reminder" }),
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour,
        minute,
      },
    });
  } catch {}
}

async function cancelReminder(): Promise<void> {
  if (!Notifications) return;
  try {
    await Notifications.cancelScheduledNotificationAsync(NOTIFICATION_ID);
  } catch {}
}

interface ReminderSheetProps {
  readonly visible: boolean;
  readonly onClose: () => void;
}

export function ReminderSheet({ visible, onClose }: ReminderSheetProps) {
  const insets = useSafeAreaInsets();
  const [enabled, setEnabled] = useState(false);
  const [hour, setHour] = useState(21);
  const [minute, setMinute] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [showPicker, setShowPicker] = useState(false);

  // 弹窗打开时加载设置
  useEffect(() => {
    if (visible) {
      loadSettings().then((s) => {
        setEnabled(s.enabled);
        setHour(s.hour);
        setMinute(s.minute);
        setLoaded(true);
      });
    } else {
      setLoaded(false);
      setShowPicker(false);
    }
  }, [visible]);

  async function handleToggle(value: boolean) {
    setEnabled(value);
    const settings: ReminderSettings = { enabled: value, hour, minute };
    await saveSettings(settings);
    if (value) {
      if (!Notifications) {
        Alert.alert(
          "提醒不可用",
          "当前环境不支持通知功能，请使用 development build",
        );
      }
      await scheduleReminder(hour, minute);
    } else {
      await cancelReminder();
    }
  }

  async function handleTimeChange(newHour: number, newMinute: number) {
    setHour(newHour);
    setMinute(newMinute);
    const settings: ReminderSettings = {
      enabled,
      hour: newHour,
      minute: newMinute,
    };
    await saveSettings(settings);
    if (enabled) {
      await scheduleReminder(newHour, newMinute);
    }
  }

  const timeLabel = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;

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
          {/* 标题栏 */}
          <View style={styles.header}>
            <AppText size="2xl" weight="semibold">
              记账提醒
            </AppText>
            <TouchableOpacity onPress={onClose} activeOpacity={0.7}>
              <AppText size="2xl" color={colors.textLighter}>
                ✕
              </AppText>
            </TouchableOpacity>
          </View>

          {loaded && (
            <View style={styles.body}>
              {/* 开关行 */}
              <View style={styles.row}>
                <View style={styles.rowLeft}>
                  <AppText size="3xl">🔔</AppText>
                  <View style={styles.rowText}>
                    <AppText size="xl" weight="medium">
                      每日提醒
                    </AppText>
                    <AppText size="base" color={colors.textLight}>
                      到时间推送通知，帮你养成记账习惯
                    </AppText>
                  </View>
                </View>
                <Switch
                  value={enabled}
                  onValueChange={handleToggle}
                  trackColor={{
                    false: colors.creamDark,
                    true: colors.sage,
                  }}
                  thumbColor={colors.white}
                />
              </View>

              {/* 时间选择行 */}
              {enabled && (
                <View style={styles.timeSection}>
                  <View style={styles.row}>
                    <View style={styles.rowLeft}>
                      <AppText size="3xl">⏰</AppText>
                      <View style={styles.rowText}>
                        <AppText size="xl" weight="medium">
                          提醒时间
                        </AppText>
                      </View>
                    </View>
                    {Platform.OS === "android" ? (
                      <TouchableOpacity
                        onPress={() => setShowPicker(true)}
                        activeOpacity={0.7}
                        style={styles.timeBtn}
                      >
                        <AppText
                          size="xl"
                          weight="semibold"
                          color={colors.sage}
                        >
                          {timeLabel}
                        </AppText>
                      </TouchableOpacity>
                    ) : null}
                  </View>

                  {/* iOS 内联 picker / Android 弹窗 picker */}
                  {Platform.OS === "ios" ? (
                    <DateTimePicker
                      value={new Date(2000, 0, 1, hour, minute)}
                      mode="time"
                      display="spinner"
                      locale="zh-CN"
                      onChange={(_, date) => {
                        if (date) {
                          handleTimeChange(date.getHours(), date.getMinutes());
                        }
                      }}
                      style={styles.iosPicker}
                    />
                  ) : (
                    showPicker && (
                      <DateTimePicker
                        value={new Date(2000, 0, 1, hour, minute)}
                        mode="time"
                        display="spinner"
                        onChange={(_, date) => {
                          setShowPicker(false);
                          if (date) {
                            handleTimeChange(
                              date.getHours(),
                              date.getMinutes(),
                            );
                          }
                        }}
                      />
                    )
                  )}
                </View>
              )}
            </View>
          )}
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
  overlayTouch: {
    flex: 1,
  },
  sheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: radii.xxl,
    borderTopRightRadius: radii.xxl,
    paddingBottom: 0,
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
    paddingHorizontal: spacing.xxl,
    gap: 8,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 8,
  },
  rowLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  timeSection: {
    gap: 0,
  },
  timeBtn: {
    backgroundColor: colors.sagePale,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: radii.md,
  },
  iosPicker: {
    height: 150,
    marginTop: -8,
  },
});
