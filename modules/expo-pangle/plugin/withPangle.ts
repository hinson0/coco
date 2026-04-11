import {
  withInfoPlist,
  withAndroidManifest,
  type ConfigPlugin,
} from 'expo/config-plugins';

const withPangle: ConfigPlugin<{ appId?: string } | void> = (config, props) => {
  // iOS: 添加 ATT 权限描述 + SKAdNetwork
  config = withInfoPlist(config, (mod) => {
    mod.modResults.NSUserTrackingUsageDescription =
      '为了给您展示更相关的广告内容，我们需要获取您的广告标识符';

    // 穿山甲 SKAdNetwork ID
    const skAdNetworkItems = mod.modResults.SKAdNetworkItems ?? [];
    const pangleSkAdId = { SKAdNetworkIdentifier: '238da6jt44.skadnetwork' };
    if (!skAdNetworkItems.some((item: any) => item.SKAdNetworkIdentifier === pangleSkAdId.SKAdNetworkIdentifier)) {
      skAdNetworkItems.push(pangleSkAdId);
    }
    mod.modResults.SKAdNetworkItems = skAdNetworkItems;

    return mod;
  });

  // Android: 添加网络权限
  config = withAndroidManifest(config, (mod) => {
    const mainApp = mod.modResults.manifest.application?.[0];
    if (mainApp) {
      const providers = mainApp.provider ?? [];
      mainApp.provider = providers;
    }

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

export default withPangle;
