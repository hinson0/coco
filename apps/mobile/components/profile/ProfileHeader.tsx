import { View, TouchableOpacity, Image, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { AppText } from '../ui/AppText';
import { colors, shadows } from '../../constants/theme';
import type { AvatarType } from '@coco/shared';

interface ProfileHeaderProps {
  readonly name: string;
  readonly daysCount: number;
  readonly avatarType?: AvatarType;
  readonly avatarValue?: string;
  readonly onAvatarPress?: () => void;
  readonly onSettingsPress?: () => void;
}

export function ProfileHeader({ name, daysCount, avatarType = 'emoji', avatarValue = '🌿', onAvatarPress, onSettingsPress }: ProfileHeaderProps) {
  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={onAvatarPress} activeOpacity={0.8}>
        <LinearGradient
          colors={[colors.sagePale, colors.coralPale]}
          style={styles.avatar}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          {avatarType === 'image' ? (
            <Image source={{ uri: avatarValue }} style={styles.avatarImage} />
          ) : (
            <AppText size="3xl">{avatarValue}</AppText>
          )}
        </LinearGradient>
      </TouchableOpacity>
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
    overflow: 'hidden',
  },
  avatarImage: {
    width: 72,
    height: 72,
    borderRadius: 24,
  },
  name: {
    textAlign: 'center',
    marginBottom: 4,
  },
  subtitle: {
    textAlign: 'center',
  },
});
