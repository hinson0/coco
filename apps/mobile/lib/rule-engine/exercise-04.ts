/**
 * 练习 4：工具类型 + 数组方法
 *
 * Python 等价逻辑：
 *
 *   # 类型派生 — Python 需要手动重新定义
 *   class CreateInput(BaseModel):
 *       amount: float
 *       category: str
 *       note: Optional[str] = None
 *
 *   class UpdateInput(BaseModel):
 *       id: str                          # 必填
 *       amount: Optional[float] = None   # 可选
 *       category: Optional[str] = None
 *       note: Optional[str] = None
 *
 *   # 按分类汇总
 *   def summarize_by_category(txs: list[Transaction]) -> dict[str, float]:
 *       result: dict[str, float] = {}
 *       for tx in txs:
 *           result[tx.category] = result.get(tx.category, 0) + tx.amount
 *       return result
 *
 * 提示：
 *   - Omit<Type, "field1" | "field2"> 去掉指定字段
 *   - Pick<Type, "field"> 只保留指定字段
 *   - Partial<Type> 所有字段变可选
 *   - & 交叉类型，合并两个类型
 *   - reduce 语法：arr.reduce((累加器, 当前元素) => 新累加器, 初始值)
 *   - ?? 运算符：a ?? b ≈ Python 的 a if a is not None else b
 */

interface Transaction {
    id: string;
    amount: number;
    category: string;
    note?: string;
    createdAt: string;
}

// TODO(human): 用工具类型派生 CreateInput（去掉 id 和 createdAt）
type CreateInput = Omit<Transaction, "id" | "createdAt">;

// TODO(human): 用工具类型派生 UpdateInput（id 必填，其余可选）
type UpdateInput = Pick<Transaction, "id"> & Partial<Omit<Transaction, "id">>;

// TODO(human): 实现按分类汇总金额
// 输入：[{category:"餐饮", amount:35}, {category:"交通", amount:15}, {category:"餐饮", amount:20}]
// 输出：{"餐饮": 55, "交通": 15}

type TransactionRecord = Record<string, number>;

export const summarizeByCategory = (
    transactions: Transaction[],
): TransactionRecord => {
    return transactions.reduce((acc, tx) => {
        acc[tx.category] = (acc[tx.category] ?? 0) + tx.amount;
        return acc;
    }, {} as TransactionRecord);
};

const transactions = [
    { id: "1", category: "餐饮", amount: 35, createdAt: "2026-03-21" },
    { id: "2", category: "交通", amount: 15, createdAt: "2026-03-21" },
    { id: "3", category: "餐饮", amount: 20, createdAt: "2026-03-21" },
];

const result = summarizeByCategory(transactions);
console.log(result);
