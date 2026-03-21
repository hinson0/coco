/**
 * 练习 5：React 组件基础
 *
 * 目标：实现一个交易卡片组件
 *
 * 预期效果：
 *   ┌──────────────────┐
 *   │ 餐饮        -35元 │   ← 支出红色
 *   │ 备注: 午饭        │   ← 可选，有 note 时才显示
 *   └──────────────────┘
 *
 *   ┌──────────────────┐
 *   │ 工资      +8000元 │   ← 收入绿色
 *   └──────────────────┘
 *
 * Python/FastAPI 类比：
 *   class TransactionCardProps(BaseModel):
 *       category: str
 *       amount: float
 *       is_income: bool = False
 *       note: Optional[str] = None
 *
 *   def render_card(props: TransactionCardProps) -> HTML:
 *       color = "green" if props.is_income else "red"
 *       sign = "+" if props.is_income else "-"
 *       html = f'<div><span style="color:{color}">{sign}{props.amount}元</span></div>'
 *       if props.note:
 *           html += f'<div>备注: {props.note}</div>'
 *       return html
 *
 * 提示：
 *   - import { View, Text } from "react-native"
 *   - style 是对象：style={{ color: "red", fontSize: 16 }}
 *   - 条件渲染：{note && <Text>...</Text>}
 *   - 三元表达式：{isIncome ? "+" : "-"}
 */
import { View, Text } from "react-native"

// TODO(human): 定义 Props interface，实现 TransactionCard 组件
