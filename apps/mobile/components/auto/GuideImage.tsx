import { Image } from "expo-image";
import { useState } from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import { AppText } from "../ui/AppText";
import { colors, radii } from "../../constants/theme";

interface GuideImageProps {
  readonly source: number;
  readonly label: string;
}

export function GuideImage({ source, label }: GuideImageProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <View style={styles.guideImageWrap}>
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => setExpanded(!expanded)}
        style={styles.guideImageBtn}
      >
        <AppText size="base" color={colors.sage}>
          {expanded ? "▼" : "▶"} {label}
        </AppText>
      </TouchableOpacity>
      {expanded ? (
        <Image source={source} style={styles.guideImage} contentFit="contain" />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  guideImageWrap: {
    marginTop: 8,
  },
  guideImageBtn: {
    paddingVertical: 6,
  },
  guideImage: {
    width: "100%",
    aspectRatio: 0.5,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.creamDark,
    marginTop: 6,
  },
});
