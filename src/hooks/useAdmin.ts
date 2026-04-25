import { useQuery } from "@tanstack/react-query";
import { getSupabaseClient } from "@/lib/supabase/database";

/**
 * Returns true when the current session user has the `admin` or
 * `super_admin` role. The `user_roles.user_id` column references
 * `profiles.id`, so we resolve the auth user id to a profile id first.
 */
export const useIsAdmin = (authUserId: string | undefined) => {
  return useQuery({
    queryKey: ["is-admin", authUserId],
    queryFn: async (): Promise<boolean> => {
      if (!authUserId) return false;
      const client = getSupabaseClient();

      // Resolve to profile.id (user_roles FK target)
      const { data: profile } = await client
        .from("profiles")
        .select("id")
        .or(`id.eq.${authUserId},user_id.eq.${authUserId}`)
        .maybeSingle();

      const profileId = profile?.id;
      if (!profileId) return false;

      const { data, error } = await client
        .from("user_roles")
        .select("role")
        .eq("user_id", profileId)
        .in("role", ["admin", "super_admin"]);
      if (error) {
        console.warn("useIsAdmin error:", error.message);
        return false;
      }
      return (data?.length ?? 0) > 0;
    },
    enabled: !!authUserId,
    staleTime: 60_000,
  });
};
