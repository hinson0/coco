Pod::Spec.new do |s|
  s.name           = 'ExpoPangle'
  s.version        = '1.0.0'
  s.summary        = 'Expo module for Pangle (CSJ) ads SDK'
  s.homepage       = 'https://github.com/user/expo-pangle'
  s.license        = 'MIT'
  s.author         = 'CoCo'
  s.source         = { git: '' }
  s.platform       = :ios, '15.1'
  s.swift_version  = '5.4'
  s.source_files   = '**/*.swift'

  s.dependency 'ExpoModulesCore'
  # 穿山甲中国版 SDK — 版本号需根据最新文档核实
  s.dependency 'Ads-CN', '~> 6.0'
end
