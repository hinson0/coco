import { useOfflineContext } from "@/lib/offline-context";
import { QK } from "@/lib/queryKeys";
import type { UpdateProfileInput, UserProfile } from "@coco/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "./useAuth";

export function useProfile() {
  const { db } = useOfflineContext();
  const { user } = useAuth();
  const userId = user?.id;

  return useQuery({
    queryKey: [QK.profile, userId],
    queryFn: async (): Promise<UserProfile | null> => {
      if (!db || !userId) return null;
      return db.getFirstAsync<UserProfile>(
        "SELECT * FROM user_profiles WHERE id = ?",
        userId,
      );
    },
    enabled: !!db && !!userId,
  });
}

export function useEnsureProfile() {
  const { db } = useOfflineContext();
  const { user } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      if (!db || !user) return null;
      const userId = user.id;
      const nickname = user.email?.split("@")[0] ?? "CoCo 用户";
      const now = new Date().toISOString();
      await db.runAsync(
        `INSERT OR IGNORE INTO user_profiles 
        (id, nickname, avatar_type, avatar_value, created_at, updated_at) 
        VALUES (?, ?, 'emoji', '🌿', ?, ?)`,
        userId,
        nickname,
        now,
        now,
      );
      return db.getFirstAsync<UserProfile>(
        "SELECT * FROM user_profiles WHERE id = ?",
        userId,
      );
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QK.profile] });
    },
  });
}

export function useUpdateProfile() {
  const { db } = useOfflineContext();
  const { user } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: UpdateProfileInput) => {
      if (!db || !user) throw new Error("Database or user not available");
      const userId = user.id;
      const now = new Date().toISOString();
      const nickname =
        input.nickname ?? user.email?.split("@")[0] ?? "CoCo 用户";
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
        now,
      );
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QK.profile] });
    },
  });
}
