// 用户个人资料类型定义，供多端共享（头像 + 昵称）
export type AvatarType = "emoji" | "image";

export interface UserProfile {
  readonly id: string;
  readonly nickname: string | null;
  readonly avatar_type: AvatarType;
  readonly avatar_value: string;
  readonly created_at: string;
  readonly updated_at: string;
}

export interface UpdateProfileInput {
  readonly nickname?: string;
  readonly avatar_type?: AvatarType;
  readonly avatar_value?: string;
}
