/**
 * 纯函数：根据认证状态和当前路由段，决定是否需要重定向。
 * 返回目标路径或 null（不需要重定向）。
 */
export function getAuthRedirectTarget(
  isAuthenticated: boolean,
  isReady: boolean,
  currentSegment: string | undefined,
): string | null {
  if (!isReady) return null;

  const inAuthGroup = currentSegment === "(auth)";

  if (!isAuthenticated && !inAuthGroup) return "/(auth)/login";
  if (isAuthenticated && inAuthGroup) return "/";

  return null;
}
