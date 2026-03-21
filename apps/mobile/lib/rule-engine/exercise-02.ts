/**
 * 练习 2：async/await 与错误处理
 *
 * 目标：实现一个带重试逻辑的异步请求封装
 *
 * 用法示例：
 *   const data = await fetchWithRetry(() => api.get("/transactions"), 3)
 *   // 最多尝试 3 次，成功则返回结果，全部失败则抛出最后一个错误
 *
 * Python 等价逻辑：
 *   async def fetch_with_retry(request_fn, max_retries=3):
 *       last_error = None
 *       for i in range(max_retries):
 *           try:
 *               return await request_fn()
 *           except Exception as e:
 *               last_error = e
 *       raise last_error
 *
 * 提示：
 *   - TS 的 for 循环：for (let i = 0; i < n; i++) { ... }
 *   - throw ≈ raise
 *   - unknown 类型 ≈ Python 的 Any，表示"我不知道这是什么类型"
 */

// T 是泛型参数 ≈ Python 的 TypeVar("T")
// 意思是：requestFn 返回 Promise<T>，fetchWithRetry 也返回 Promise<T>

export const fetchWithRetry = async <T>(
  requestFn: () => Promise<T>,
  maxRetries: number = 3,
): Promise<T> => {
  let lastError = null;
  for (let index = 0; index < maxRetries; index++) {
    try {
      return await requestFn();
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
};
