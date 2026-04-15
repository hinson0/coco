import { getAuthRedirectTarget } from "../auth-redirect";

describe("getAuthRedirectTarget", () => {
  // 场景 1: 未就绪时不做任何重定向
  it("isReady=false 时返回 null（不重定向）", () => {
    expect(getAuthRedirectTarget(false, false, undefined)).toBeNull();
    expect(getAuthRedirectTarget(true, false, undefined)).toBeNull();
    expect(getAuthRedirectTarget(false, false, "(auth)")).toBeNull();
  });

  // 场景 2: 未登录 + 不在 auth 页面 → 跳转登录页
  it("未登录且不在 auth 组时，重定向到登录页", () => {
    expect(getAuthRedirectTarget(false, true, "(tabs)")).toBe("/(auth)/login");
    expect(getAuthRedirectTarget(false, true, undefined)).toBe("/(auth)/login");
    expect(getAuthRedirectTarget(false, true, "manual-entry")).toBe(
      "/(auth)/login",
    );
  });

  // 场景 3: 未登录 + 已在 auth 页面 → 不重定向（留在登录/注册页）
  it("未登录但已在 auth 组时，返回 null（不重定向）", () => {
    expect(getAuthRedirectTarget(false, true, "(auth)")).toBeNull();
  });

  // 场景 4: 已登录 + 在 auth 页面 → 跳转主页
  it("已登录但在 auth 组时，重定向到主页", () => {
    expect(getAuthRedirectTarget(true, true, "(auth)")).toBe("/");
  });

  // 场景 5: 已登录 + 不在 auth 页面 → 不重定向（正常使用）
  it("已登录且不在 auth 组时，返回 null（不重定向）", () => {
    expect(getAuthRedirectTarget(true, true, "(tabs)")).toBeNull();
    expect(getAuthRedirectTarget(true, true, undefined)).toBeNull();
    expect(getAuthRedirectTarget(true, true, "manual-entry")).toBeNull();
  });
});
