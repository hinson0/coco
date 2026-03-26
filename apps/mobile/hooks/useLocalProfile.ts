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

export function useInitProfile() {
  const { db } = useOfflineContext();
  const { session } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      if (!db || !session?.user) throw new Error("Database or session not available");
      const userId = session.user.id;

      const existing = await db.getFirstAsync<UserProfile>(
        "SELECT * FROM user_profiles WHERE id = ?",
        userId
      );
      if (existing) return existing;

      const nickname = session.user.email?.split("@")[0] ?? "棉花用户";
      const now = new Date().toISOString();
      await db.runAsync(
        "INSERT INTO user_profiles (id, nickname, avatar_type, avatar_value, created_at, updated_at) VALUES (?, ?, 'emoji', '🌿', ?, ?)",
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

export function useUpdateProfile() {
  const { db } = useOfflineContext();
  const { session } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: UpdateProfileInput) => {
      if (!db || !session?.user) throw new Error("Database or session not available");
      const userId = session.user.id;
      const now = new Date().toISOString();

      const fields: string[] = ["updated_at = ?"];
      const values: (string | number)[] = [now];
      if (input.nickname !== undefined) { fields.push("nickname = ?"); values.push(input.nickname); }
      if (input.avatar_type !== undefined) { fields.push("avatar_type = ?"); values.push(input.avatar_type); }
      if (input.avatar_value !== undefined) { fields.push("avatar_value = ?"); values.push(input.avatar_value); }

      values.push(userId);
      await db.runAsync(
        `UPDATE user_profiles SET ${fields.join(", ")} WHERE id = ?`,
        ...values
      );
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["profile"] });
    },
  });
}
