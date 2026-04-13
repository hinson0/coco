import { Platform } from "react-native";

export interface GuideStep {
  readonly title: string;
  readonly description: string;
}

const BRAND_GUIDES: Record<string, readonly GuideStep[]> = {
  xiaomi: [
    {
      title: "开启自启动",
      description: "设置 → 应用设置 → 应用管理 → 找到 CoCo → 开启自启动",
    },
    {
      title: "关闭电池优化",
      description:
        "设置 → 电池与性能 → 应用省电策略 → 找到 CoCo → 选择「无限制」",
    },
    {
      title: "开启通知监听",
      description: "设置 → 通知管理 → 通知使用权 → 开启 CoCo",
    },
  ],
  huawei: [
    {
      title: "关闭电池优化",
      description:
        "设置 → 电池 → 应用启动管理 → 找到 CoCo → 关闭「自动管理」→ 开启全部开关",
    },
    {
      title: "开启通知监听",
      description: "设置 → 通知 → 通知使用权 → 开启 CoCo",
    },
  ],
  oppo: [
    {
      title: "开启自启动",
      description: "设置 → 应用管理 → 应用列表 → 找到 CoCo → 允许自启动",
    },
    {
      title: "关闭电池优化",
      description:
        "设置 → 电池 → 更多电池设置 → 优化电池使用 → 找到 CoCo → 不优化",
    },
    {
      title: "开启通知监听",
      description: "设置 → 通知与状态栏 → 通知使用权 → 开启 CoCo",
    },
  ],
  vivo: [
    {
      title: "关闭后台耗电限制",
      description: "设置 → 电池 → 后台高耗电 → 允许 CoCo 后台运行",
    },
    {
      title: "开启通知监听",
      description: "设置 → 通知与状态栏 → 通知使用权 → 开启 CoCo",
    },
  ],
  samsung: [
    {
      title: "开启通知监听",
      description: "设置 → 应用程序 → 特殊权限 → 通知访问权限 → 开启 CoCo",
    },
  ],
  default: [
    {
      title: "开启通知监听",
      description: "设置 → 应用和通知 → 特殊应用权限 → 通知使用权 → 开启 CoCo",
    },
  ],
};

export function getDeviceBrand(): string {
  if (Platform.OS !== "android") return "default";
  const brand = (Platform.constants as any)?.Brand?.toLowerCase() ?? "";
  return brand || "default";
}

export function getBrandGuideSteps(brand: string): readonly GuideStep[] {
  const normalized = brand.toLowerCase();

  if (
    normalized.includes("xiaomi") ||
    normalized.includes("redmi") ||
    normalized.includes("poco")
  ) {
    return BRAND_GUIDES.xiaomi;
  }
  if (normalized.includes("huawei") || normalized.includes("honor")) {
    return BRAND_GUIDES.huawei;
  }
  if (
    normalized.includes("oppo") ||
    normalized.includes("realme") ||
    normalized.includes("oneplus")
  ) {
    return BRAND_GUIDES.oppo;
  }
  if (normalized.includes("vivo") || normalized.includes("iqoo")) {
    return BRAND_GUIDES.vivo;
  }
  if (normalized.includes("samsung")) {
    return BRAND_GUIDES.samsung;
  }

  return BRAND_GUIDES.default;
}
