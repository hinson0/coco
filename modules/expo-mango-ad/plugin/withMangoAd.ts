import {
  withInfoPlist,
  withAndroidManifest,
  type ConfigPlugin,
} from 'expo/config-plugins';

const withMangoAd: ConfigPlugin<{ appId?: string } | void> = (config) => {
  // iOS: 添加 ATT 权限描述
  config = withInfoPlist(config, (mod) => {
    mod.modResults.NSUserTrackingUsageDescription =
      '为了给您展示更相关的广告内容，我们需要获取您的广告标识符';
    return mod;
  });

  // Android: 添加网络权���
  config = withAndroidManifest(config, (mod) => {
    const permissions = mod.modResults.manifest['uses-permission'] ?? [];
    const needed = [
      'android.permission.INTERNET',
      'android.permission.ACCESS_NETWORK_STATE',
    ];
    for (const perm of needed) {
      if (!permissions.some((p: any) => p.$?.['android:name'] === perm)) {
        permissions.push({ $: { 'android:name': perm } });
      }
    }
    mod.modResults.manifest['uses-permission'] = permissions;
    return mod;
  });

  return config;
};

export default withMangoAd;
