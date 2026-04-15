// 共享 Emoji 选择器组件，被 profile/category/account 三处复用
import { useState } from "react";
import {
  View,
  TouchableOpacity,
  FlatList,
  TextInput,
  StyleSheet,
  Modal,
} from "react-native";
import { AppText } from "../ui/AppText";
import { colors, radii, spacing } from "../../constants/theme";

const EMOJI_GROUPS: Record<string, string[]> = {
  常用: [
    "🍔",
    "🚗",
    "🛒",
    "🎮",
    "🏠",
    "💊",
    "📚",
    "📱",
    "💰",
    "📈",
    "💵",
    "📦",
    "🌿",
    "🎯",
    "🏷️",
  ],
  表情: [
    "😀",
    "😊",
    "😎",
    "🥳",
    "😍",
    "🤔",
    "😴",
    "🤑",
    "😇",
    "🥰",
    "😋",
    "🤓",
  ],
  食物: [
    "🍔",
    "🍕",
    "🍜",
    "🍣",
    "🍩",
    "☕",
    "🍺",
    "🧁",
    "🍇",
    "🥗",
    "🍰",
    "🧋",
  ],
  交通: [
    "🚗",
    "🚌",
    "🚀",
    "✈️",
    "🚲",
    "🛵",
    "🚇",
    "🚕",
    "⛵",
    "🏎️",
    "🚁",
    "🛴",
  ],
  物品: [
    "💰",
    "💳",
    "🏦",
    "💚",
    "💙",
    "🎒",
    "📱",
    "💻",
    "🎧",
    "📷",
    "🔑",
    "💎",
  ],
  自然: [
    "🌿",
    "🌸",
    "🌈",
    "⭐",
    "🌙",
    "☀️",
    "🍀",
    "🌻",
    "🌊",
    "🔥",
    "❄️",
    "🌺",
  ],
  活动: [
    "🎮",
    "⚽",
    "🏋️",
    "🎬",
    "🎵",
    "🎨",
    "📖",
    "🏕️",
    "🎲",
    "🧘",
    "🎭",
    "🎤",
  ],
};

interface EmojiPickerProps {
  readonly visible: boolean;
  readonly onSelect: (emoji: string) => void;
  readonly onClose: () => void;
}

export function EmojiPicker({ visible, onSelect, onClose }: EmojiPickerProps) {
  const [search, setSearch] = useState("");
  const [activeGroup, setActiveGroup] = useState("常用");

  const groups = Object.keys(EMOJI_GROUPS);
  const emojis = EMOJI_GROUPS[activeGroup] ?? [];

  const filteredEmojis = search
    ? Object.values(EMOJI_GROUPS)
        .flat()
        .filter((e, i, arr) => arr.indexOf(e) === i)
    : emojis;

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          {/* 标题栏 */}
          <View style={styles.header}>
            <AppText size="2xl" weight="semibold">
              选择图标
            </AppText>
            <TouchableOpacity onPress={onClose} activeOpacity={0.7}>
              <AppText size="2xl" color={colors.textLighter}>
                ✕
              </AppText>
            </TouchableOpacity>
          </View>

          {/* 搜索 */}
          <TextInput
            style={styles.search}
            placeholder="搜索 emoji..."
            placeholderTextColor={colors.textLighter}
            value={search}
            onChangeText={setSearch}
          />

          {/* 分组 Tab */}
          {!search && (
            <FlatList
              horizontal
              data={groups}
              keyExtractor={(item) => item}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.tabBar}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.tab, item === activeGroup && styles.tabActive]}
                  onPress={() => setActiveGroup(item)}
                  activeOpacity={0.7}
                >
                  <AppText
                    size="md"
                    weight={item === activeGroup ? "semibold" : "regular"}
                    color={
                      item === activeGroup ? colors.sage : colors.textLight
                    }
                  >
                    {item}
                  </AppText>
                </TouchableOpacity>
              )}
            />
          )}

          {/* Emoji 网格 */}
          <FlatList
            data={filteredEmojis}
            numColumns={6}
            keyExtractor={(item, index) => `${item}-${index}`}
            contentContainerStyle={styles.grid}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.emojiCell}
                onPress={() => {
                  onSelect(item);
                  onClose();
                  setSearch("");
                }}
                activeOpacity={0.6}
              >
                <AppText style={styles.emoji}>{item}</AppText>
              </TouchableOpacity>
            )}
          />
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
  sheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: radii.xxl,
    borderTopRightRadius: radii.xxl,
    maxHeight: "70%",
    paddingBottom: 32,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.xxl,
    paddingBottom: spacing.lg,
  },
  search: {
    marginHorizontal: spacing.xxl,
    backgroundColor: colors.cream,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontSize: 15,
    color: colors.text,
    marginBottom: spacing.lg,
  },
  tabBar: {
    paddingHorizontal: spacing.xxl,
    gap: 8,
    marginBottom: spacing.lg,
  },
  tab: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radii.sm,
  },
  tabActive: {
    backgroundColor: colors.sagePale,
  },
  grid: {
    paddingHorizontal: spacing.xxl,
  },
  emojiCell: {
    flex: 1,
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
    maxWidth: "16.666%",
  },
  emoji: {
    fontSize: 29,
  },
});
