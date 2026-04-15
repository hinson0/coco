/**
 * useIAP — iOS In-App Purchase 购买流程封装。
 *
 * react-native-iap 是原生模块，在 Expo Go 中不可用，
 * 因此用 try/catch 动态 require（与 google-mobile-ads 同模式）。
 * 在 Expo Go 中所有 IAP 操作会静默降级。
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Platform } from "react-native";
import { apiFetch } from "../lib/api";
import { getProStatus } from "../lib/auth";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  type PlanType,
  planToSku,
  isSubscriptionSku,
  isIAPAvailable,
  ALL_SKUS,
  SUBSCRIPTION_SKUS,
  ONE_TIME_SKUS,
} from "../lib/iap/products";

// 动态加载 react-native-iap（Expo Go 兼容）
let RNIap: typeof import("react-native-iap") | null = null;
try {
  RNIap = require("react-native-iap");
} catch {
  // Expo Go: react-native-iap unavailable
}

type PurchaseState =
  | "idle"
  | "loading"
  | "purchasing"
  | "verifying"
  | "success"
  | "error";

interface UseIAPResult {
  /** 当前购买状态 */
  purchaseState: PurchaseState;
  /** 购买指定套餐 */
  purchase: (plan: PlanType) => Promise<void>;
  /** 恢复购买（换设备） */
  restore: () => Promise<void>;
  /** 错误信息 */
  errorMessage: string | null;
  /** IAP 是否可用（非 Expo Go + 支持的平台） */
  isAvailable: boolean;
}

const PRO_STATUS_KEY = "pro_status";

export function useIAP(): UseIAPResult {
  const [purchaseState, setPurchaseState] = useState<PurchaseState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const isAvailable = !!RNIap && isIAPAvailable();
  const cleanupRef = useRef<(() => void) | null>(null);

  // 初始化 IAP 连接
  useEffect(() => {
    if (!RNIap) return;

    RNIap.initConnection()
      .then(() => console.log("[IAP] 连接成功"))
      .catch((err) => console.warn("[IAP] 连接失败:", err));

    return () => {
      cleanupRef.current?.();
      RNIap?.endConnection();
    };
  }, []);

  // 购买指定套餐
  const purchase = useCallback(async (plan: PlanType) => {
    if (!RNIap) {
      Alert.alert("提示", "当前环境不支持支付，请使用正式版本");
      return;
    }

    setPurchaseState("loading");
    setErrorMessage(null);

    try {
      const sku = planToSku(plan);
      const isSub = isSubscriptionSku(sku);

      // 获取产品信息确认产品存在
      if (isSub) {
        const subs = await RNIap.getSubscriptions({ skus: [sku] });
        if (subs.length === 0) {
          throw new Error("产品不存在，请稍后再试");
        }
      } else {
        const products = await RNIap.getProducts({ skus: [sku] });
        if (products.length === 0) {
          throw new Error("产品不存在，请稍后再试");
        }
      }

      setPurchaseState("purchasing");

      // 设置购买监听
      const purchasePromise = new Promise<string>((resolve, reject) => {
        const updateSub = RNIap!.purchaseUpdatedListener(async (p) => {
          const receipt = p.transactionReceipt;
          if (receipt) {
            cleanup();
            resolve(receipt);
          }
        });

        const errorSub = RNIap!.purchaseErrorListener((err) => {
          cleanup();
          if (err.code === "E_USER_CANCELLED") {
            reject(new Error("USER_CANCELLED"));
          } else {
            reject(new Error(err.message ?? "购买失败"));
          }
        });

        function cleanup() {
          updateSub.remove();
          errorSub.remove();
          cleanupRef.current = null;
        }
        cleanupRef.current = cleanup;
      });

      // 发起购买请求
      if (isSub) {
        await RNIap.requestSubscription({
          sku,
          andDangerouslyFinishTransactionAutomaticallyIOS: false,
        });
      } else {
        await RNIap.requestPurchase({
          sku,
          andDangerouslyFinishTransactionAutomaticallyIOS: false,
        });
      }

      // 等待购买回调
      const receiptData = await purchasePromise;

      // 服务端验证
      setPurchaseState("verifying");
      const result = await apiFetch<{
        success: boolean;
        pro_status: {
          is_pro: boolean;
          is_trial: boolean;
          trial_days_left: number;
          pro_expires_at: string | null;
        };
        message: string;
      }>("/iap/verify-receipt", {
        method: "POST",
        body: JSON.stringify({
          receipt_data: receiptData,
          product_id: sku,
        }),
      });

      if (result.success) {
        // 更新本地 Pro 状态缓存
        await AsyncStorage.setItem(
          PRO_STATUS_KEY,
          JSON.stringify(result.pro_status),
        );

        // finishTransaction（验证成功后才调用）
        // 需要拿到 purchase 对象，从 getAvailablePurchases 中获取
        const purchases = await RNIap.getAvailablePurchases();
        for (const p of purchases) {
          if (p.productId === sku) {
            await RNIap.finishTransaction({ purchase: p, isConsumable: false });
          }
        }

        setPurchaseState("success");
        Alert.alert("购买成功", result.message);
      } else {
        throw new Error(result.message ?? "验证失败");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "购买失败";
      if (msg === "USER_CANCELLED") {
        setPurchaseState("idle");
        return;
      }
      setPurchaseState("error");
      setErrorMessage(msg);
      Alert.alert("购买失败", msg);
    }
  }, []);

  // 恢复购买
  const restore = useCallback(async () => {
    if (!RNIap) {
      Alert.alert("提示", "当前环境不支持此操作");
      return;
    }

    setPurchaseState("verifying");
    setErrorMessage(null);

    try {
      const purchases = await RNIap.getAvailablePurchases();
      if (purchases.length === 0) {
        setPurchaseState("idle");
        Alert.alert("提示", "没有找到可恢复的购买记录");
        return;
      }

      // 逐个验证
      let restored = false;
      for (const p of purchases) {
        if (p.transactionReceipt) {
          const result = await apiFetch<{
            success: boolean;
            pro_status: {
              is_pro: boolean;
              is_trial: boolean;
              trial_days_left: number;
              pro_expires_at: string | null;
            };
            message: string;
          }>("/iap/restore", {
            method: "POST",
            body: JSON.stringify({
              receipt_data: p.transactionReceipt,
              product_id: p.productId,
            }),
          });

          if (result.success && result.pro_status.is_pro) {
            await AsyncStorage.setItem(
              PRO_STATUS_KEY,
              JSON.stringify(result.pro_status),
            );
            restored = true;
          }
        }
      }

      if (restored) {
        setPurchaseState("success");
        Alert.alert("恢复成功", "Pro 会员已恢复！");
      } else {
        setPurchaseState("idle");
        Alert.alert("提示", "未找到有效的 Pro 购买记录");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "恢复失败";
      setPurchaseState("error");
      setErrorMessage(msg);
      Alert.alert("恢复失败", msg);
    }
  }, []);

  return { purchaseState, purchase, restore, errorMessage, isAvailable };
}
