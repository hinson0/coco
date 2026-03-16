import { View, Text, StyleSheet } from "react-native";
import type { ChatMessage as ChatMessageType } from "@coco/shared";
import { BillCard } from "./BillCard";

interface Props {
  readonly message: ChatMessageType;
}

export function ChatMessage({ message }: Props) {
  const isUser = message.role === "user";

  const renderContent = () => {
    switch (message.content_type) {
      case "bill_card": {
        const tx = JSON.parse(message.content);
        return <BillCard transaction={tx} />;
      }
      case "audio":
        return (
          <View style={[styles.bubble, isUser ? styles.userBubble : styles.aiBubble]}>
            <Text style={isUser ? styles.userText : styles.aiText}>🎙️ 语音消息</Text>
          </View>
        );
      case "image":
        return (
          <View style={[styles.bubble, isUser ? styles.userBubble : styles.aiBubble]}>
            <Text style={isUser ? styles.userText : styles.aiText}>🧾 图片</Text>
          </View>
        );
      default:
        return (
          <View style={[styles.bubble, isUser ? styles.userBubble : styles.aiBubble]}>
            <Text style={isUser ? styles.userText : styles.aiText}>{message.content}</Text>
          </View>
        );
    }
  };

  return (
    <View style={[styles.row, isUser ? styles.rowRight : styles.rowLeft]}>
      {!isUser && (
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>AI</Text>
        </View>
      )}
      <View style={styles.contentWrapper}>
        {renderContent()}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", marginBottom: 10, alignItems: "flex-start" },
  rowLeft: { justifyContent: "flex-start" },
  rowRight: { justifyContent: "flex-end" },
  avatar: { width: 28, height: 28, borderRadius: 14, backgroundColor: "#2D9B83", justifyContent: "center", alignItems: "center", marginRight: 8 },
  avatarText: { color: "#fff", fontSize: 10, fontWeight: "800" },
  contentWrapper: { maxWidth: "80%" },
  bubble: { borderRadius: 12, padding: 10 },
  userBubble: { backgroundColor: "#2D9B83", borderTopRightRadius: 0 },
  aiBubble: {
    backgroundColor: "#fff", borderTopLeftRadius: 0,
    shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, elevation: 1,
  },
  userText: { color: "#fff", fontSize: 14 },
  aiText: { color: "#1e293b", fontSize: 14 },
});
