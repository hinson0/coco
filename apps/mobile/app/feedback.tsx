import { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Keyboard,
  Linking,
  ScrollView,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppText } from "../components/ui/AppText";
import { colors, radii, shadows } from "../constants/theme";

const FEEDBACK_TYPES = ["功能建议", "Bug报告", "其他"] as const;
const MAX_LENGTH = 500;
const MIN_LENGTH = 10;

export default function FeedbackScreen() {
  const insets = useSafeAreaInsets();
  const [feedbackType, setFeedbackType] = useState<string>(FEEDBACK_TYPES[0]);
  const [content, setContent] = useState("");
  const [contact, setContact] = useState("");
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    const showSub = Keyboard.addListener("keyboardDidShow", (e) =>
      setKeyboardHeight(e.endCoordinates.height),
    );
    const hideSub = Keyboard.addListener("keyboardDidHide", () =>
      setKeyboardHeight(0),
    );
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const canSubmit = content.trim().length >= MIN_LENGTH;

  const handleSubmit = () => {
    const email = "feedback@example.com";
    const subject = encodeURIComponent(`【${feedbackType}】CoCo 反馈`);
    const body = encodeURIComponent(`${content}\n\n联系方式：${contact}`);
    const url = `mailto:${email}?subject=${subject}&body=${body}`;
    Linking.openURL(url).catch(() => {
      Alert.alert("提示", `请发送邮件至 ${email}`);
    });
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.iconBtn}
          activeOpacity={0.75}
        >
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <AppText size="2xl" weight="bold" color={colors.text}>
          意见反馈
        </AppText>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView style={styles.scrollView} keyboardShouldPersistTaps="handled">
        {/* 反馈类型选择 */}
        <View style={styles.section}>
          <AppText
            size="lg"
            weight="semibold"
            color={colors.text}
            style={styles.label}
          >
            反馈类型
          </AppText>
          <View style={styles.tagsRow}>
            {FEEDBACK_TYPES.map((type) => {
              const selected = feedbackType === type;
              return (
                <TouchableOpacity
                  key={type}
                  onPress={() => setFeedbackType(type)}
                  style={[
                    styles.tag,
                    {
                      backgroundColor: selected
                        ? colors.sage
                        : colors.creamDark,
                    },
                  ]}
                >
                  <AppText
                    size="md"
                    weight="medium"
                    color={selected ? colors.white : colors.textLight}
                  >
                    {type}
                  </AppText>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* 问题描述 */}
        <View style={styles.section}>
          <AppText
            size="lg"
            weight="semibold"
            color={colors.text}
            style={styles.label}
          >
            问题描述
          </AppText>
          <View>
            <TextInput
              style={styles.textArea}
              multiline
              maxLength={MAX_LENGTH}
              placeholder="请描述你的问题或建议..."
              placeholderTextColor={colors.textLighter}
              value={content}
              onChangeText={setContent}
              textAlignVertical="top"
            />
            <AppText
              size="sm"
              color={colors.textLighter}
              style={styles.charCount}
            >
              {content.length}/{MAX_LENGTH}
            </AppText>
          </View>
        </View>

        {/* 联系方式 */}
        <View style={styles.section}>
          <AppText
            size="lg"
            weight="semibold"
            color={colors.text}
            style={styles.label}
          >
            联系方式（选填）
          </AppText>
          <TextInput
            style={styles.input}
            placeholder="邮箱或微信号"
            placeholderTextColor={colors.textLighter}
            value={contact}
            onChangeText={setContact}
          />
        </View>
      </ScrollView>

      {/* 底部提交按钮 */}
      <View
        style={[
          styles.bottomBar,
          {
            paddingBottom:
              keyboardHeight > 0 ? keyboardHeight : insets.bottom + 20,
          },
        ]}
      >
        <TouchableOpacity
          style={[
            styles.submitButton,
            !canSubmit && styles.submitButtonDisabled,
          ]}
          onPress={handleSubmit}
          disabled={!canSubmit}
          activeOpacity={0.8}
        >
          <AppText size="xl" weight="bold" color={colors.white}>
            提交反馈
          </AppText>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.cream,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: radii.md,
    backgroundColor: colors.white,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    ...shadows.md,
  },
  backArrow: { fontSize: 18, color: colors.text, lineHeight: 22 },
  scrollView: {
    flex: 1,
  },
  section: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  label: {
    marginBottom: 10,
  },
  tagsRow: {
    flexDirection: "row",
    gap: 10,
  },
  tag: {
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 20,
  },
  textArea: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.creamDark,
    borderRadius: 12,
    padding: 14,
    height: 150,
    fontSize: 14,
    color: colors.text,
    textAlignVertical: "top",
  },
  charCount: {
    position: "absolute",
    right: 14,
    bottom: 10,
  },
  input: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.creamDark,
    borderRadius: 12,
    padding: 14,
    fontSize: 14,
    color: colors.text,
  },
  bottomBar: {
    paddingHorizontal: 20,
    paddingTop: 12,
    backgroundColor: colors.cream,
  },
  submitButton: {
    backgroundColor: colors.sage,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
});
