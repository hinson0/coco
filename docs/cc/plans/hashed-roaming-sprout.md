# 计划：upgrade-pro 页面微调

## 问题
1. Hero 背景用了 `#1a3a28` 深森林绿，与 app 整体 cream/sage 风格不统一
2. 字体整体偏大，需适度收小

## 修改文件
`apps/mobile/app/upgrade-pro.tsx`（仅样式调整，无逻辑变动）

## 具体改动

### 1. 颜色修复
| 位置 | 改前 | 改后 |
|------|------|------|
| 根 View backgroundColor | `#1a3a28` | `colors.cream` |
| Hero LinearGradient colors | `['#1a3a28','#2d5a40','#3d6e50']` | `['#4a7a60','#6a9878','#7ba68a']`（app 现有 sage 色系） |

说明：`#7ba68a` 正是 `colors.sage`，渐变从稍深的 sage 变体到品牌色本身，完全在调色板范围内。

### 2. 字体缩小（约减 10-15%）
| 样式 | 改前 | 改后 |
|------|------|------|
| `crownEmoji` | 60px | 52px |
| `heroTitle` | 36px | 30px |
| `heroSubtitle` | 15px | 14px |
| `priceNumber` | 52px | 44px |
| `priceCurrency` | 24px | 22px |
| `priceUnit` | 16px | 15px |
| `planName` | 18px | 16px |
| `sectionTitle` | 18px | 17px |
| `featureTitle` | 16px | 15px |
| `ctaText` | 18px | 17px |

44px 的价格数字仍远大于原始 18px，保留了"大气"感，只是不再过于夸张。
