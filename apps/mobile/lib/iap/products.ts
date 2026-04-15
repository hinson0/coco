import { Platform } from "react-native";

/**
 * App Store Connect / Google Play 产品 ID。
 * 有资质后在对应平台后台创建这些产品，ID 必须一致。
 */
export const PRODUCT_IDS = {
  monthly: "com.coco.pro.monthly",
  yearly: "com.coco.pro.yearly",
  lifetime: "com.coco.pro.lifetime",
} as const;

/** 订阅类产品（月/年） */
export const SUBSCRIPTION_SKUS = [PRODUCT_IDS.monthly, PRODUCT_IDS.yearly];

/** 一次性购买产品（永久） */
export const ONE_TIME_SKUS = [PRODUCT_IDS.lifetime];

/** 所有产品 SKU */
export const ALL_SKUS = [...SUBSCRIPTION_SKUS, ...ONE_TIME_SKUS];

export type PlanType = keyof typeof PRODUCT_IDS;

/** 套餐选择 → 产品 ID */
export function planToSku(plan: PlanType): string {
  return PRODUCT_IDS[plan];
}

/** 产品 ID → 是否为订阅 */
export function isSubscriptionSku(sku: string): boolean {
  return SUBSCRIPTION_SKUS.includes(sku);
}

/** 运行平台是否支持 IAP */
export function isIAPAvailable(): boolean {
  return Platform.OS === "ios" || Platform.OS === "android";
}
