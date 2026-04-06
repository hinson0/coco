# CategoryPicker 优化设计

## 背景

ManualEntryForm 中的分类选择器存在以下问题：
- 支出分类 9 个，超出 2 行（4列×2行=8个）的理想布局
- 排序不符合使用频率（购物、餐饮应优先）
- "通讯"分类不需要
- 备注输入框被键盘遮盖

## 改动范围

仅客户端，不涉及数据库或 API 变更。

### 1. CategoryPicker.tsx — 排序与过滤

**过滤：** 从显示列表中移除"通讯"分类。

**排序：** 定义支出分类的固定排序优先级：

```
购物 → 餐饮 → 交通 → 娱乐 → 居住 → 医疗 → 教育 → 其他支出
```

规则：
- 按优先级数组索引排序
- "其他支出"固定最后
- 不在数组中的分类排在"其他支出"之前
- 收入分类（当前 3 个）无需特殊排序，保持现状

### 2. ManualEntryForm.tsx — 键盘遮盖修复

将 `ScrollView` 包裹在 `KeyboardAvoidingView` 中：
- iOS: `behavior="padding"`
- 确保备注输入框在键盘弹出时自动滚动可见

### 3. constants/categories.ts — 清理

从 `CATEGORY_COLOR_MAP` 中删除"通讯"条目。

## 不做的事

- 不修改数据库 categories 表
- 不修改 API 排序逻辑
- 不改变收入分类的排序或数量
