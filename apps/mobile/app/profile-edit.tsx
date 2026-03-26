// 用户资料编辑页面 — 修改头像和昵称
import { useState, useEffect } from "react";
import { View, TextInput, TouchableOpacity, StyleSheet, Alert, Image, ActivityIndicator, Keyboard } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import * as ImagePicker from "expo-image-picker";
import { useProfile, useUpdateProfile, useEnsureProfile } from "../hooks/useLocalProfile";
import { EmojiPicker } from "../components/shared/EmojiPicker";
import { AppText } from "../components/ui/AppText";
import { colors, radii, spacing, shadows } from "../constants/theme";
import type { AvatarType } from "@coco/shared";

export default function ProfileEditScreen() {
  const insets = useSafeAreaInsets();
  const { data: profile } = useProfile();
  const { mutateAsync: updateProfile } = useUpdateProfile();
  const { mutate: ensureProfile } = useEnsureProfile();

  useEffect(() => { ensureProfile(); }, []);

  const [nickname, setNickname] = useState("");
  const [avatarType, setAvatarType] = useState<AvatarType>("emoji");
  const [avatarValue, setAvatarValue] = useState("🌿");
  const [submitting, setSubmitting] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    const showSub = Keyboard.addListener("keyboardDidShow", (e) => setKeyboardHeight(e.endCoordinates.height));
    const hideSub = Keyboard.addListener("keyboardDidHide", () => setKeyboardHeight(0));
    return () => { showSub.remove(); hideSub.remove(); };
  }, []);

  useEffect(() => {
    if (profile) {
      setNickname(profile.nickname ?? "");
      setAvatarType(profile.avatar_type);
      setAvatarValue(profile.avatar_value);
    }
  }, [profile?.id]);

  const handlePickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setAvatarType("image");
      setAvatarValue(result.assets[0].uri);
    }
  };

  const handleAvatarPress = () => {
    Alert.alert("更换头像", undefined, [
      { text: "选择 Emoji", onPress: () => setShowEmojiPicker(true) },
      { text: "从相册选择", onPress: handlePickImage },
      { text: "取消", style: "cancel" },
    ]);
  };

  const handleSave = async () => {
    if (!nickname.trim()) {
      Alert.alert("昵称不能为空");
      return;
    }
    setSubmitting(true);
    try {
      await updateProfile({
        nickname: nickname.trim(),
        avatar_type: avatarType,
        avatar_value: avatarValue,
      });
      router.back();
    } catch {
      Alert.alert("保存失败", "请重试");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <AppText size="2xl">←</AppText>
        </TouchableOpacity>
        <AppText size="2xl" weight="semibold">编辑资料</AppText>
        <View style={{ width: 36 }} />
      </View>

      {/* Avatar */}
      <View style={styles.avatarSection}>
        <TouchableOpacity onPress={handleAvatarPress} activeOpacity={0.8}>
          <LinearGradient
            colors={[colors.sagePale, colors.coralPale]}
            style={styles.avatar}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            {avatarType === "image" ? (
              <Image source={{ uri: avatarValue }} style={styles.avatarImage} />
            ) : (
              <AppText style={{ fontSize: 40 }}>{avatarValue}</AppText>
            )}
          </LinearGradient>
        </TouchableOpacity>
        <AppText size="md" color={colors.sage} style={{ marginTop: 8 }}>点击更换头像</AppText>
      </View>

      {/* Nickname input */}
      <View style={styles.fieldCard}>
        <AppText size="md" color={colors.textLighter} style={{ marginBottom: 6 }}>昵称</AppText>
        <TextInput
          style={styles.input}
          value={nickname}
          onChangeText={(text) => setNickname(text.slice(0, 20))}
          placeholder="输入昵称"
          placeholderTextColor={colors.textLighter}
          maxLength={20}
        />
        <AppText size="sm" color={colors.textLighter} style={{ marginTop: 4, textAlign: "right" }}>
          {nickname.length}/20
        </AppText>
      </View>

      <EmojiPicker
        visible={showEmojiPicker}
        onSelect={(emoji) => { setAvatarType("emoji"); setAvatarValue(emoji); }}
        onClose={() => setShowEmojiPicker(false)}
      />

      <View style={[styles.bottomBar, { paddingBottom: (keyboardHeight > 0 ? keyboardHeight + 16 : insets.bottom) + 12 }]}>
        <TouchableOpacity
          style={[styles.saveBtn, submitting && styles.saveBtnDisabled]}
          onPress={handleSave}
          disabled={submitting}
          activeOpacity={0.8}
        >
          {submitting ? (
            <ActivityIndicator color={colors.white} size="small" />
          ) : (
            <AppText size="2xl" weight="semibold" color={colors.white}>保存</AppText>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.white },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.creamDark,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: radii.sm,
    backgroundColor: colors.cream, alignItems: "center", justifyContent: "center",
  },
  avatarSection: { alignItems: "center", paddingVertical: 32 },
  avatar: {
    width: 88, height: 88, borderRadius: 28,
    alignItems: "center", justifyContent: "center", overflow: "hidden",
  },
  avatarImage: { width: 88, height: 88, borderRadius: 28 },
  fieldCard: {
    marginHorizontal: spacing.xxl, backgroundColor: colors.cream,
    borderRadius: radii.md, padding: spacing.xl,
  },
  input: { fontSize: 16, color: colors.text, fontWeight: "500" },
  bottomBar: {
    paddingHorizontal: spacing.xl,
    paddingTop: 12,
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.creamDark,
  },
  saveBtn: {
    height: 48,
    borderRadius: radii.md,
    backgroundColor: colors.sage,
    alignItems: "center",
    justifyContent: "center",
    ...shadows.md,
  },
  saveBtnDisabled: {
    opacity: 0.6,
  },
  saveBtnText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: "600",
  },
});
