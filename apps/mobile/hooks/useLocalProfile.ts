// Profile 数据的本地 CRUD hook（查询、首次初始化、更新昵称/头像）
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useOfflineContext } from "@/lib/offline-context";
import { useAuth } from "./useAuth";
import type { UserProfile, UpdateProfileInput } from "@coco/shared";

export function useProfile() {
  const { db } = useOfflineContext();
  const { session } = useAuth();
  const userId = session?.user?.id;

  return useQuery({
    queryKey: ["profile", userId],
    queryFn: async (): Promise<UserProfile | null> => {
      if (!db || !userId) return null;
      return db.getFirstAsync<UserProfile>(
        "SELECT * FROM user_profiles WHERE id = ?",
        userId
      );
    },
    enabled: !!db && !!userId,
  });
}

// 确保 profile 记录存在。在 profile.tsx 和 profile-edit.tsx 中都应调用。
// 使用 INSERT OR IGNORE 保证幂等，不依赖 mutation 的执行时机。
export function useEnsureProfile() {
  const { db } = useOfflineContext();
  const { session } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      if (!db || !session?.user) return null;
      const userId = session.user.id;
      const nickname = session.user.email?.split("@")[0] ?? "棉花用户";
      const now = new Date().toISOString();
      // INSERT OR IGNORE：如果 id 已存在则静默跳过，不报错也不覆盖
      await db.runAsync(
        "INSERT OR IGNORE INTO user_profiles (id, nickname, avatar_type, avatar_value, created_at, updated_at) VALUES (?, ?, 'emoji', '🌿', ?, ?)",
        userId,
        nickname,
        now,
        now
      );
      return db.getFirstAsync<UserProfile>(
        "SELECT * FROM user_profiles WHERE id = ?",
        userId
      );
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["profile"] });
    },
  });
}

// UPSERT：记录不存在时自动创建，存在时更新。
// 解决 db/session 异步初始化导致 ensureProfile 可能未执行的竞态问题。
export function useUpdateProfile() {
  const { db } = useOfflineContext();
  const { session } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: UpdateProfileInput) => {
      if (!db || !session?.user) throw new Error("Database or session not available");
      const userId = session.user.id;
      const now = new Date().toISOString();
      const nickname = input.nickname ?? session.user.email?.split("@")[0] ?? "棉花用户";
      const avatarType = input.avatar_type ?? "emoji";
      const avatarValue = input.avatar_value ?? "🌿";

      await db.runAsync(
        `INSERT INTO user_profiles (id, nickname, avatar_type, avatar_value, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           nickname = excluded.nickname,
           avatar_type = excluded.avatar_type,
           avatar_value = excluded.avatar_value,
           updated_at = excluded.updated_at`,
        userId,
        nickname,
        avatarType,
        avatarValue,
        now,
        now
      );
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["profile"] });
    },
  });
}
