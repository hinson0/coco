export interface MangoAdInitConfig {
  appId: string;
}

export interface SplashAdResult {
  success: boolean;
}

export interface RewardedVideoResult {
  success: boolean;
  rewardVerify: boolean;
}

export interface AdErrorEvent {
  code: number;
  message: string;
}
