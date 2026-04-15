import { useEffect, useState } from "react";
import { getIsPro, getProStatus } from "../lib/auth";

export type ProStatus = {
  is_pro: boolean;
  is_trial: boolean;
  trial_days_left: number;
  pro_expires_at: string | null;
};

const DEFAULT_STATUS: ProStatus = {
  is_pro: false,
  is_trial: false,
  trial_days_left: 0,
  pro_expires_at: null,
};

/**
 * 非 hook 版本：在 useCallback 内部调用（如 useCheckAndConsume）。
 * 直接读 AsyncStorage，返回 Promise<boolean>。
 */
export async function getIsProFromCache(): Promise<boolean> {
  return getIsPro();
}

/** hook 版本：组件渲染时使用，获取完整 Pro 状态 */
export function useProStatus(): ProStatus {
  const [status, setStatus] = useState<ProStatus>(DEFAULT_STATUS);

  useEffect(() => {
    getProStatus().then((s) => {
      if (s) setStatus(s);
    });
  }, []);

  return status;
}

/** hook 版本：组件渲染时使用，只需要 boolean */
export function useIsPro(): boolean {
  const status = useProStatus();
  return status.is_pro;
}
