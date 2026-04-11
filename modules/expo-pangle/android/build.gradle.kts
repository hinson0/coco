// modules/expo-pangle/android/build.gradle.kts
plugins {
  id("com.android.library")
  id("org.jetbrains.kotlin.android")
}

android {
  namespace = "expo.modules.pangle"
  compileSdk = 34
  defaultConfig {
    minSdk = 24
  }
  compileOptions {
    sourceCompatibility = JavaVersion.VERSION_17
    targetCompatibility = JavaVersion.VERSION_17
  }
  kotlinOptions {
    jvmTarget = "17"
  }
}

repositories {
  // 穿山甲 Maven 仓库 — 地址需核实
  maven { url = uri("https://artifact.bytedance.com/repository/pangle") }
}

dependencies {
  implementation("expo:expo-modules-core:+")
  // 穿山甲中国版 SDK — 版本号需核实
  implementation("com.pangle.cn:ads-sdk-pro:6.+")
}
