import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, radii, spacing } from "../../constants/theme";
import { useOfflineContext } from "../../lib/offline-context";
import { AppText } from "../ui/AppText";

interface ExportSheetProps {
  readonly visible: boolean;
  readonly onClose: () => void;
}

interface ExportRow {
  occurred_at: string;
  type: string;
  category_name: string;
  category_icon: string;
  amount: number;
  note: string;
  source: string;
  account_name: string | null;
  raw_input: string | null;
  ai_confidence: number | null;
  created_at: string;
}

const SOURCE_LABELS: Record<string, string> = {
  manual: "手动",
  rule: "规则",
  ocr: "拍照识别",
  asr: "语音识别",
  text: "文字识别",
};

function escapeCsvField(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function buildCsv(rows: ExportRow[]): string {
  const headers = [
    "日期",
    "时间",
    "类型",
    "分类",
    "分类图标",
    "金额",
    "备注",
    "来源",
    "账户",
    "原始输入",
    "AI置信度",
    "创建时间",
  ];

  const lines = [headers.join(",")];

  for (const r of rows) {
    const date = r.occurred_at.slice(0, 10);
    const time = r.occurred_at.slice(11, 16);
    const typeLabel = r.type === "expense" ? "支出" : "收入";
    const sign = r.type === "expense" ? "-" : "";
    const source = SOURCE_LABELS[r.source] ?? r.source;
    const confidence =
      r.ai_confidence != null ? `${Math.round(r.ai_confidence * 100)}%` : "";

    const fields = [
      date,
      time,
      typeLabel,
      escapeCsvField(r.category_name),
      escapeCsvField(r.category_icon),
      `${sign}${r.amount.toFixed(2)}`,
      escapeCsvField(r.note || ""),
      source,
      escapeCsvField(r.account_name || ""),
      escapeCsvField(r.raw_input || ""),
      confidence,
      r.created_at.slice(0, 19).replace("T", " "),
    ];
    lines.push(fields.join(","));
  }

  return "\uFEFF" + lines.join("\n");
}

export function ExportSheet({ visible, onClose }: ExportSheetProps) {
  const { db, userId } = useOfflineContext();
  const insets = useSafeAreaInsets();
  const [exporting, setExporting] = useState(false);

  async function handleExport() {
    if (!db || !userId) return;
    setExporting(true);
    try {
      const rows = await db.getAllAsync<ExportRow>(
        `SELECT
          t.occurred_at,
          t.type,
          c.name AS category_name,
          c.icon AS category_icon,
          t.amount,
          t.note,
          t.source,
          a.name AS account_name,
          t.raw_input,
          t.ai_confidence,
          t.created_at
        FROM transactions t
        LEFT JOIN categories c ON t.category_id = c.id
        LEFT JOIN accounts a ON t.account_id = a.id
        WHERE t.user_id = ? AND t.deleted_at IS NULL
        ORDER BY t.occurred_at DESC`,
        userId,
      );

      if (rows.length === 0) {
        Alert.alert("暂无数据", "还没有记账记录可以导出");
        return;
      }

      const csv = buildCsv(rows);
      const now = new Date();
      const timestamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
      const filePath = `${FileSystem.cacheDirectory}棉花记_${timestamp}.csv`;

      await FileSystem.writeAsStringAsync(filePath, csv, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      const available = await Sharing.isAvailableAsync();
      if (!available) {
        Alert.alert("分享不可用", "当前设备不支持分享功能");
        return;
      }

      onClose();
      // 延迟一下让 Modal 关闭动画完成后再弹出系统分享
      setTimeout(async () => {
        try {
          await Sharing.shareAsync(filePath, {
            mimeType: "text/csv",
            UTI: "public.comma-separated-values-text",
          });
        } catch {
          Alert.alert("分享失败", "请重试");
        }
      }, 300);
    } catch {
      Alert.alert("导出失败", "请重试");
    } finally {
      setExporting(false);
    }
  }

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
              导出报表
            </AppText>
            <TouchableOpacity onPress={onClose} activeOpacity={0.7}>
              <AppText size="2xl" color={colors.textLighter}>
                ✕
              </AppText>
            </TouchableOpacity>
          </View>

          {/* 说明 */}
          <View style={styles.body}>
            <View style={styles.infoRow}>
              <AppText size="3xl">📄</AppText>
              <View style={styles.infoText}>
                <AppText size="xl" weight="medium">
                  CSV 格式
                </AppText>
                <AppText size="base" color={colors.textLight}>
                  可用 Excel、WPS、Numbers 打开
                </AppText>
              </View>
            </View>
            <View style={styles.infoRow}>
              <AppText size="3xl">📋</AppText>
              <View style={styles.infoText}>
                <AppText size="xl" weight="medium">
                  全部记录
                </AppText>
                <AppText size="base" color={colors.textLight}>
                  包含日期、分类、金额、备注、来源等字段
                </AppText>
              </View>
            </View>
          </View>

          {/* 导出按钮 */}
          <TouchableOpacity
            style={[styles.exportBtn, exporting && styles.exportBtnDisabled]}
            activeOpacity={0.8}
            onPress={handleExport}
            disabled={exporting}
          >
            {exporting ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <AppText size="xl" weight="semibold" color={colors.white}>
                导出并分享
              </AppText>
            )}
          </TouchableOpacity>
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
    gap: 16,
    paddingBottom: spacing.xxl,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  infoText: {
    flex: 1,
    gap: 2,
  },
  exportBtn: {
    marginHorizontal: spacing.xxl,
    backgroundColor: colors.sage,
    borderRadius: radii.lg,
    paddingVertical: 16,
    alignItems: "center",
  },
  exportBtnDisabled: {
    opacity: 0.6,
  },
});
