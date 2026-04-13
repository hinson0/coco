// 穿山甲广告模块 — 暂停使用，保留空壳以允许编译通过
package expo.modules.pangle

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class ExpoPangleModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("ExpoPangle")
    // 广告功能已暂停，所有 API 返回空结果
  }
}
