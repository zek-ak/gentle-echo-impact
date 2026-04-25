import { getSupabaseClient, initializeSupabaseClient } from './client';

export interface User {
  id: string;
  phone: string;
  full_name: string;
  role: string;
}

export interface Pledge {
  id: string;
  user_id: string;
  pledge_amount: number;
  year: number;
  created_at: string;
}

export interface Contribution {
  id: string;
  user_id: string;
  project_id?: string;
  amount: number;
  method: string;
  created_at: string;
}

export interface Profile {
  id: string;
  user_id: string;
  phone: string;
  full_name: string;
  role?: string;
  annual_goal: number | null;
  total_contributed: number | null;
  level?: string;
  group_id?: string;
  groups?: { name: string };
}

// Ensure Supabase client has the correct token before operations
async function ensureSessionValid() {
  initializeSupabaseClient();
}

// Safe user getter
export async function getCurrentUser(): Promise<User | null> {
  try {
    const { data: { user }, error } = await getSupabaseClient().auth.getUser();
    if (error || !user) {
      console.warn('No authenticated user:', error?.message);
      return null;
    }
    return {
      id: user.id,
      phone: user.phone || '',
      full_name: user.user_metadata?.full_name || '',
      role: user.user_metadata?.role || 'member'
    };
  } catch (error) {
    console.error('Error getting current user:', error);
    return null;
  }
}

async function resolveProfileId(userId: string): Promise<string | null> {
  const client = getSupabaseClient();

  const { data: profileByUserId } = await client
    .from('profiles')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle();

  if (profileByUserId?.id) return profileByUserId.id;

  const { data: profileById } = await client
    .from('profiles')
    .select('id')
    .eq('id', userId)
    .maybeSingle();

  return profileById?.id ?? null;
}

// Safe pledges getter
export async function getUserPledges(userId: string): Promise<Pledge[]> {
  try {
    const profileId = await resolveProfileId(userId);
    if (!profileId) return [];

    const { data, error } = await getSupabaseClient()
      .from('pledges')
      .select('*')
      .eq('user_id', profileId)
      .order('year', { ascending: false });

    if (error) {
      console.error('Error fetching pledges:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Error in getUserPledges:', error);
    return [];
  }
}

// Safe pledge creation
export async function createOrUpdatePledge(
  userId: string, // session.user_id = auth.users.id
  amount: number,
  year: number
): Promise<{ success: boolean; error?: string }> {
  const supabase = getSupabaseClient();
  
  try {
    // Ensure the Supabase client has the correct auth token
    await ensureSessionValid();

    const profileId = await resolveProfileId(userId);
    if (!profileId) {
      throw new Error(`No profile found for user_id: ${userId}`);
    }

    const { data: existing } = await supabase
      .from('pledges')
      .select('id')
      .eq('user_id', profileId)
      .eq('year', year)
      .maybeSingle();

    if (existing) {
      // Update existing
      const { error } = await supabase
        .from('pledges')
        .update({ pledge_amount: amount })
        .eq('id', existing.id);

      if (error) throw error;
      console.log('[PLEDGE] Updated existing pledge:', existing.id);
    } else {
      // Create new
      const { data: newPledge, error } = await supabase
        .from('pledges')
        .insert({
          user_id: profileId,
          pledge_amount: amount,
          year: year
        })
        .select()
        .single();

      if (error) throw error;
      console.log('[PLEDGE] Created new pledge:', newPledge.id);
    }

    const { error: profileGoalError } = await supabase
      .from('profiles')
      .update({ annual_goal: amount })
      .eq('id', profileId);

    if (profileGoalError) {
      console.warn('Failed to update profile annual_goal:', profileGoalError);
    }

    return { success: true };
  } catch (error: any) {
    console.error('Error creating/updating pledge:', error);
    return { success: false, error: error.message };
  }
}

// Safe contributions getter
export async function getUserContributions(userId: string): Promise<Contribution[]> {
  try {
    const profileId = await resolveProfileId(userId);
    if (!profileId) return [];

    const { data, error } = await getSupabaseClient()
      .from('contributions')
      .select('*, projects(name)')
      .eq('user_id', profileId)
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) {
      console.error('Error fetching contributions:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Error in getUserContributions:', error);
    return [];
  }
}

// Safe profile getter
export async function getUserProfile(userId: string): Promise<Profile | null> {
  try {
    const { data, error } = await getSupabaseClient()
      .from('profiles')
      .select('*')
      .or(`id.eq.${userId},user_id.eq.${userId}`)
      .maybeSingle();

    if (error) {
      console.error('Error fetching profile:', error);
      return null;
    }

    return data as Profile;
  } catch (error) {
    console.error('Error in getUserProfile:', error);
    return null;
  }
}

// Safe contribution creation
export async function createContribution(
  userId: string,
  amount: number,
  method: string,
  projectId?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const profileId = await resolveProfileId(userId);
    if (!profileId) {
      throw new Error('No profile found for contribution');
    }

    const { error } = await getSupabaseClient()
      .from('contributions')
      .insert({
        user_id: profileId,
        amount: amount,
        method: method,
        project_id: projectId || null
      });

    if (error) throw error;

    return { success: true };
  } catch (error: any) {
    console.error('Error creating contribution:', error);
    return { success: false, error: error.message };
  }
}
export { getSupabaseClient };
