import { withAndroidManifest, type ConfigPlugin } from "expo/config-plugins";

const withAutoBookkeeping: ConfigPlugin = (config) => {
  config = withAndroidManifest(config, (mod) => {
    const mainApp = mod.modResults.manifest.application?.[0];
    if (!mainApp) return mod;

    const services = mainApp.service ?? [];
    const serviceName = ".NotificationListenerServiceImpl";
    const alreadyExists = services.some(
      (s: any) => s.$?.["android:name"] === serviceName,
    );

    if (!alreadyExists) {
      services.push({
        $: {
          "android:name": serviceName,
          "android:permission":
            "android.permission.BIND_NOTIFICATION_LISTENER_SERVICE",
          "android:exported": "false",
        },
        "intent-filter": [
          {
            action: [
              {
                $: {
                  "android:name":
                    "android.service.notification.NotificationListenerService",
                },
              },
            ],
          },
        ],
      } as any);
    }

    mainApp.service = services;
    return mod;
  });

  return config;
};

export default withAutoBookkeeping;
