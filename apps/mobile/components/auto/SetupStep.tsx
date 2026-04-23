import { StyleSheet, TouchableOpacity, View } from "react-native";
import { AppText } from "../ui/AppText";
import { Card } from "../ui/Card";
import { PulseDot } from "../ui/PulseDot";
import { colors, radii } from "../../constants/theme";

interface SetupStepProps {
  readonly step: number;
  readonly title: string;
  readonly done: boolean;
  readonly onPress: () => void;
  readonly buttonLabel: string;
  readonly children?: React.ReactNode;
}

export function SetupStep({
  step,
  title,
  done,
  onPress,
  buttonLabel,
  children,
}: SetupStepProps) {
  return (
    <Card style={styles.stepCard}>
      <TouchableOpacity
        style={styles.stepHeader}
        activeOpacity={0.7}
        onPress={onPress}
      >
        <View style={styles.stepLeft}>
          <View style={[styles.stepNumber, done && styles.stepNumberDone]}>
            <AppText size="md" weight="bold" color={colors.white}>
              {step}
            </AppText>
          </View>
          <AppText size="xl" weight="semibold" color={colors.text}>
            {title}
          </AppText>
        </View>
        {done ? (
          <View style={styles.runningTag}>
            <PulseDot size={8} />
            <AppText size="md" weight="medium" color={colors.sage}>
              运行中
            </AppText>
          </View>
        ) : null}
      </TouchableOpacity>
      {!done ? (
        <View style={styles.stepBody}>
          {children}
          <TouchableOpacity
            style={styles.stepBtn}
            activeOpacity={0.8}
            onPress={onPress}
          >
            <AppText size="md" weight="semibold" color={colors.white}>
              {buttonLabel}
            </AppText>
          </TouchableOpacity>
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  stepCard: { marginBottom: 12 },
  stepHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  stepLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  stepNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.textLighter,
    justifyContent: "center",
    alignItems: "center",
  },
  stepNumberDone: {
    backgroundColor: colors.sage,
  },
  runningTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  stepBody: {
    marginLeft: 34,
  },
  stepBtn: {
    marginTop: 12,
    backgroundColor: colors.sage,
    borderRadius: radii.md,
    paddingVertical: 10,
    paddingHorizontal: 20,
    alignSelf: "flex-start",
  },
});
