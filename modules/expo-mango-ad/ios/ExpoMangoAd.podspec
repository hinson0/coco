Pod::Spec.new do |s|
  s.name           = 'ExpoMangoAd'
  s.version        = '0.1.0'
  s.summary        = '芒果聚合广告 Expo Module'
  s.homepage       = 'https://www.mangolm.com/'
  s.license        = 'MIT'
  s.author         = 'coco'
  s.source         = { git: '' }
  s.platform       = :ios, '15.1'
  s.swift_version  = '5.4'
  s.source_files   = '**/*.swift'

  s.dependency 'ExpoModulesCore'
  # TODO: 拿到芒果 SDK 后添加真实依赖
  # s.dependency 'MangoAdSDK', '~> x.x'
end
