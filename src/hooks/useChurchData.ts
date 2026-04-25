import { useQuery } from "@tanstack/react-query";
import { getSupabaseClient, getCurrentUser, getUserPledges, getUserContributions, getUserProfile } from "@/lib/supabase/database";

interface PublicDashboardData {
  total_collected: number;
  active_members: number;
  best_group: { name: string; total: number; members: number } | null;
  groups_leaderboard: Array<{ id: string; name: string; total: number; member_count: number }> | null;
  current_project: {
    id: string;
    name: string;
    description: string | null;
    target_amount: number;
    collected_amount: number;
    status: string;
  } | null;
}

export const usePublicDashboard = () => {
  return useQuery({
    queryKey: ["public-dashboard"],
    queryFn: async (): Promise<PublicDashboardData> => {
      const { data, error } = await getSupabaseClient().rpc("get_public_dashboard");
      if (error) {
        console.error("Failed to fetch public dashboard RPC:", error.message);
        return null as unknown as PublicDashboardData;
      }
      return data as unknown as PublicDashboardData;
    },
    refetchInterval: 30000,
  });
};

export const useMemberDashboard = (userId: string | undefined) => {
  const profileQuery = useQuery({
    queryKey: ["profile", userId],
    queryFn: async () => {
      if (!userId) return null;
      return await getUserProfile(userId);
    },
    enabled: !!userId,
  });

  const contributionsQuery = useQuery({
    queryKey: ["contributions", userId],
    queryFn: async () => {
      if (!userId) return [];
      return await getUserContributions(userId);
    },
    enabled: !!userId,
  });

  const pledgesQuery = useQuery({
    queryKey: ["pledges", userId],
    queryFn: async () => {
      if (!userId) return [];
      return await getUserPledges(userId);
    },
    enabled: !!userId,
  });

  const badgesQuery = useQuery({
    queryKey: ["user-badges", userId],
    queryFn: async () => {
      if (!userId) return [];
      const client = getSupabaseClient();
      const { data: allBadges } = await client.from("badges").select("*");
      const { data: earnedBadges } = await client
        .from("user_badges")
        .select("badge_id")
        .eq("user_id", userId!);
      const earnedIds = new Set(earnedBadges?.map((b) => b.badge_id) || []);
      return (allBadges || []).map((b) => ({ ...b, earned: earnedIds.has(b.id) }));
    },
    enabled: !!userId,
  });

  // groupMembersQuery REMOVED

  return { profileQuery, contributionsQuery, pledgesQuery, badgesQuery };
};

export const useProjects = () => {
  return useQuery({
    queryKey: ["projects"],
    queryFn: async () => {
      const client = getSupabaseClient();
      const { data, error } = await client
        .from("projects")
        .select("*")
        .eq("status", "ongoing")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
};
