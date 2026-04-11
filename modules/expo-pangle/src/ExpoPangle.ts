import { requireNativeModule, EventEmitter } from 'expo-modules-core';
import type {
  PangleInitConfig,
  SplashAdResult,
  RewardedVideoResult,
  AdErrorEvent,
} from './ExpoPangle.types';

const NativeModule = requireNativeModule('ExpoPangle');
const emitter = new EventEmitter(NativeModule);

export async function init(config: PangleInitConfig): Promise<void> {
  return NativeModule.init(config.appId);
}

export async function showSplashAd(slotId: string): Promise<SplashAdResult> {
  return NativeModule.showSplashAd(slotId);
}

export async function loadRewardedVideo(slotId: string): Promise<void> {
  return NativeModule.loadRewardedVideo(slotId);
}

export async function showRewardedVideo(): Promise<RewardedVideoResult> {
  return NativeModule.showRewardedVideo();
}

export function onAdLoaded(callback: () => void) {
  return emitter.addListener('onAdLoaded', callback);
}

export function onAdClosed(callback: () => void) {
  return emitter.addListener('onAdClosed', callback);
}

export function onAdError(callback: (event: AdErrorEvent) => void) {
  return emitter.addListener('onAdError', callback);
}
