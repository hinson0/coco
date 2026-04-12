plugins {
  id("com.android.library")
  id("org.jetbrains.kotlin.android")
}

android {
  namespace = "expo.modules.mangoad"
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

dependencies {
  implementation("expo:expo-modules-core:+")
  // TODO: 拿到���果 SDK 后添加真实依赖
  // implementation("com.mangolm:ad-sdk:x.x.x")
}
