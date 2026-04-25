import { createSupabaseClient } from "./supabase/client";
import { getSession } from "./auth";

// Helper to get authenticated Supabase client
const getAuthenticatedClient = async () => {
  const session = getSession();
  return createSupabaseClient(session?.access_token);
};

// ============================================================================
// PROJECT SERVICES
// ============================================================================

export interface ChurchProject {
  id: string;
  name: string;
  description: string | null;
  target_amount: number;
  collected_amount: number;
  owner_id: string;
  status: "ongoing" | "completed" | "paused" | "cancelled";
  created_at: string;
  updated_at: string;
}

export interface ProjectCreateInput {
  name: string;
  description?: string;
  target_amount: number;
}

/**
 * Get all church projects (anyone can view)
 */
export const getAllProjects = async (): Promise<ChurchProject[]> => {
  const client = createSupabaseClient();
  const { data, error } = await client
    .from("projects")
    .select("*")
    .eq("status", "ongoing")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching projects:", error);
    throw error;
  }

  return data || [];
};

/**
 * Get all projects (including completed/paused/cancelled) - Admin view
 */
export const getAllProjectsAdmin = async (): Promise<ChurchProject[]> => {
  const client = createSupabaseClient();
  const { data, error } = await client
    .from("projects")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching all projects:", error);
    throw error;
  }

  return data || [];
};

/**
 * Get single project by ID
 */
export const getProjectById = async (projectId: string): Promise<ChurchProject | null> => {
  const client = createSupabaseClient();
  const { data, error } = await client
    .from("projects")
    .select("*")
    .eq("id", projectId)
    .maybeSingle();

  if (error) {
    console.error("Error fetching project:", error);
    throw error;
  }

  return data || null;
};

/**
 * Create a new project (anyone can create for now)
 * owner_id is set to current user automatically
 */
export const createProject = async (input: ProjectCreateInput, userId: string): Promise<ChurchProject> => {
  const client = await getAuthenticatedClient();
  
  const { data, error } = await client
    .from("projects")
    .insert({
      name: input.name,
      description: input.description || null,
      target_amount: input.target_amount,
      owner_id: userId,
      status: "ongoing",
    })
    .select()
    .single();

  if (error) {
    console.error("Error creating project:", error);
    throw error;
  }

  return data;
};

/**
 * Update project (only creator or admin)
 */
export const updateProject = async (
  projectId: string,
  updates: Partial<ProjectCreateInput> & { status?: string }
): Promise<ChurchProject> => {
  const client = await getAuthenticatedClient();

  const { data, error } = await client
    .from("projects")
    .update(updates)
    .eq("id", projectId)
    .select()
    .single();

  if (error) {
    console.error("Error updating project:", error);
    throw error;
  }

  return data;
};

/**
 * Delete project (only creator or admin)
 */
export const deleteProject = async (projectId: string): Promise<void> => {
  const client = await getAuthenticatedClient();

  const { error } = await client
    .from("projects")
    .delete()
    .eq("id", projectId);

  if (error) {
    console.error("Error deleting project:", error);
    throw error;
  }
};

// ============================================================================
// CONTRIBUTION SERVICES
// ============================================================================

export interface Contribution {
  id: string;
  user_id: string;
  project_id: string | null;
  amount: number;
  method: "mobile_money" | "bank_transfer" | "cash" | "check" | "other";
  reference: string | null;
  created_at: string;
  updated_at: string;
}

export interface ContributionCreateInput {
  project_id?: string | null;
  amount: number;
  method: "mobile_money" | "bank_transfer" | "cash" | "check" | "other";
  reference?: string;
}

/**
 * Create a contribution (current user)
 */
export const createContribution = async (
  input: ContributionCreateInput,
  userId: string
): Promise<Contribution> => {
  const client = await getAuthenticatedClient();

  const { data, error } = await client
    .from("contributions")
    .insert({
      user_id: userId,
      project_id: input.project_id || null,
      amount: input.amount,
      method: input.method,
      reference: input.reference || null,
    })
    .select()
    .single();

  if (error) {
    console.error("Error creating contribution:", error);
    throw error;
  }

  return data;
};

/**
 * Get user's contributions
 */
export const getUserContributions = async (userId: string): Promise<Contribution[]> => {
  const client = createSupabaseClient();

  const { data, error } = await client
    .from("contributions")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching contributions:", error);
    throw error;
  }

  return data || [];
};

/**
 * Get total contributed amount for a user
 */
export const getUserTotalContributed = async (userId: string): Promise<number> => {
  const client = createSupabaseClient();

  const { data, error } = await client
    .from("contributions")
    .select("amount")
    .eq("user_id", userId)
    .eq("status", "completed");

  if (error) {
    console.error("Error calculating total:", error);
    throw error;
  }

  return (data || []).reduce((sum, c) => sum + (c.amount || 0), 0);
};

// ============================================================================
// GROUP SERVICES
// ============================================================================

export interface Group {
  id: string;
  name: string;
  description: string | null;
  leader_id: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Get all groups
 */
export const getAllGroups = async (): Promise<Group[]> => {
  const client = createSupabaseClient();

  const { data, error } = await client
    .from("groups")
    .select("*")
    .order("name", { ascending: true });

  if (error) {
    console.error("Error fetching groups:", error);
    throw error;
  }

  return data || [];
};

/**
 * Get group members (profiles in group)
 */
export const getGroupMembers = async (groupId: string) => {
  const client = createSupabaseClient();

  const { data, error } = await client
    .from("profiles")
    .select("*, contributions(amount)")
    .eq("group_id", groupId)
    .order("full_name", { ascending: true });

  if (error) {
    console.error("Error fetching group members:", error);
    throw error;
  }

  return data || [];
};

// ============================================================================
// USER ROLE SERVICES
// ============================================================================

export interface UserRole {
  id: string;
  user_id: string;
  role: "member" | "group_leader" | "finance_admin" | "admin" | "super_admin";
  assigned_by: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Check if user has a specific role
 */
export const checkUserRole = async (userId: string, role: string): Promise<boolean> => {
  const client = createSupabaseClient();

  const { data, error } = await client
    .from("user_roles")
    .select("id")
    .eq("user_id", userId)
    .eq("role", role)
    .maybeSingle();

  if (error) {
    console.error("Error checking role:", error);
    return false;
  }

  return !!data;
};

/**
 * Get all roles for a user
 */
export const getUserRoles = async (userId: string): Promise<UserRole[]> => {
  const client = createSupabaseClient();

  const { data, error } = await client
    .from("user_roles")
    .select("*")
    .eq("user_id", userId);

  if (error) {
    console.error("Error fetching user roles:", error);
    return [];
  }

  return data || [];
};

/**
 * Check if user is admin or super_admin
 */
export const isAdmin = async (userId: string): Promise<boolean> => {
  const roles = await getUserRoles(userId);
  return roles.some((r) => r.role === "admin" || r.role === "super_admin");
};

/**
 * Check if user is super_admin
 */
export const isSuperAdmin = async (userId: string): Promise<boolean> => {
  return checkUserRole(userId, "super_admin");
};
