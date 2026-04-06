# 默认分类不可编辑

## Context

分类管理页面中，系统预设的 12 个默认分类（`is_default = 1`）当前可以点击进入编辑页修改名称和图标。用户要求默认分类完全不可编辑——不能进入编辑页，只能查看。

## 修改文件

- `apps/mobile/app/category-manage.tsx`

## 方案

在分类列表的 `renderItem` 中，对 `is_default` 为 true 的分类：
- 移除 `onPress` 导航到编辑页的行为（不响应点击，或只显示不可编辑）
- 保持"预设"标签展示
- 移除右侧的 `›` 箭头（表示不可点击）

具体改动：将 `rowContent` 的 `TouchableOpacity` 改为条件渲染——默认分类用普通 `View`，自定义分类用 `TouchableOpacity` 带 `onPress` 导航。

## 验证

1. 打开分类管理页面
2. 点击默认分类（如"餐饮"）→ 无反应，不跳转
3. 点击自定义分类 → 正常跳转到编辑页
