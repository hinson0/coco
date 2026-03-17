import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { AppText } from '../ui/AppText';
import { colors, shadows } from '../../constants/theme';

interface ProfileHeaderProps {
  readonly name: string;
  readonly daysCount: number;
  readonly onSettingsPress?: () => void;
}

export function ProfileHeader({ name, daysCount, onSettingsPress }: ProfileHeaderProps) {
  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.settingsBtn} onPress={onSettingsPress} activeOpacity={0.7}>
        <AppText size="2xl">⚙️</AppText>
      </TouchableOpacity>
      <LinearGradient
        colors={[colors.sagePale, colors.coralPale]}
        style={styles.avatar}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <AppText size="3xl">🌿</AppText>
      </LinearGradient>
      <AppText size="4xl" weight="bold" style={styles.name}>{name}</AppText>
      <AppText size="md" color={colors.textLighter} style={styles.subtitle}>
        已记账 {daysCount} 天
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingTop: 54,
    paddingHorizontal: 24,
    paddingBottom: 24,
    backgroundColor: colors.cream,
  },
  settingsBtn: {
    position: 'absolute',
    top: 54,
    right: 24,
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.md,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  name: {
    textAlign: 'center',
    marginBottom: 4,
  },
  subtitle: {
    textAlign: 'center',
  },
});
