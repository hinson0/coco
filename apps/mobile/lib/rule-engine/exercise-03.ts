/**
 * 练习 3：interface、联合类型、判别联合
 *
 * 目标：为 CoCo 的 Operation Queue 定义类型安全的操作结构
 *
 * Python 等价逻辑：
 *   class CreateOp(BaseModel):
 *       type: Literal["create"]
 *       amount: float
 *       category: str
 *
 *   class UpdateOp(BaseModel):
 *       type: Literal["update"]
 *       id: str
 *       amount: float
 *
 *   class DeleteOp(BaseModel):
 *       type: Literal["delete"]
 *       id: str
 *
 *   Operation = Union[CreateOp, UpdateOp, DeleteOp]
 *
 *   def describe_operation(op: Operation) -> str:
 *       if op.type == "create":
 *           return f"新建: {op.category} {op.amount}元"
 *       elif op.type == "update":
 *           return f"更新: #{op.id} → {op.amount}元"
 *       else:
 *           return f"删除: #{op.id}"
 *
 * 提示：
 *   - interface 的字面量类型：type: "create"（不是 type: string）
 *   - 联合类型用 |：type Operation = CreateOp | UpdateOp | DeleteOp
 *   - switch 语法：switch (op.type) { case "create": ... break }
 *   - 模板字符串：`文字 ${变量}` ≈ f"文字 {变量}"
 */

interface CreateOp {
  type: "create";
  amount: number;
  category: string;
}
interface UpdateOp {
  type: "update";
  id: string;
  amount: number;
}
interface DeleteOp {
  type: "delete";
  id: string;
}

type Operation = CreateOp | UpdateOp | DeleteOp;

const describeOperation = (op: Operation) => {
  switch (op.type) {
    case "create":
      return `新建:${op.category}-${op.amount}`;
    case "update":
      return `更新:${op.id} - ${op.amount}`;
    case "delete":
      return `删除:${op.id}`;
  }
};
