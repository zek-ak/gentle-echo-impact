import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createSupabaseClient } from "../../lib/supabase/client.ts";
import { FolderKanban, Plus, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import confetti from "canvas-confetti";

interface Project {
  id: string;
  name: string;
  description: string | null;
  target_amount: number;
  collected_amount: number;
  owner_id: string;
  status: string;
  created_at: string;
  updated_at: string;
}

interface ProjectsViewProps {
  userId?: string;
  isAdmin?: boolean;
}

const ProjectsView = ({ userId, isAdmin = false }: ProjectsViewProps) => {
  const queryClient = useQueryClient();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [description, setDescription] = useState("");
  const [targetAmount, setTargetAmount] = useState("");

  // Fetch all projects
  const projectsQuery = useQuery({
    queryKey: ["projects"],
    queryFn: async () => {
      const client = createSupabaseClient();
      const { data, error } = await client
        .from("projects")
        .select("*")
        .eq("status", "ongoing")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data || []) as Project[];
    },
  });

  // Create project mutation
  const createMutation = useMutation({
    mutationFn: async () => {
      if (!projectName || !targetAmount || !userId) {
        throw new Error("Missing required fields");
      }

      const numericAmount = parseInt(targetAmount, 10);
      if (numericAmount <= 0) {
        throw new Error("Amount must be greater than 0");
      }

      // Get the current session for authenticated requests
      const { getSession } = await import("@/lib/auth");
      const session = getSession();

      const client = createSupabaseClient(session?.access_token);
      
      // Give setSession time to process
      await new Promise(resolve => setTimeout(resolve, 50));
      
      const { data, error } = await client
        .from("projects")
        .insert({
          name: projectName,
          description: description || null,
          target_amount: numericAmount,
          owner_id: userId,
          status: "ongoing",
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (newProject) => {
      queryClient.setQueryData(["projects"], (old: Project[] | undefined) => {
        return [newProject, ...(old || [])];
      });
      
      confetti({
        particleCount: 60,
        spread: 60,
        origin: { y: 0.6 },
        colors: ["#d4a017", "#2d8a56", "#7c3aed"],
      });
      
      setProjectName("");
      setDescription("");
      setTargetAmount("");
      setShowCreateForm(false);
    },
    onError: (error: any) => {
      console.error("Project create error:", error);
    },
  });

  const formatCurrency = (amt: number): string => amt.toLocaleString("en-TZ");
  const getProgressPercent = (project: Project) => 
    project.target_amount > 0 ? (project.collected_amount / project.target_amount) * 100 : 0;

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTargetAmount(e.target.value.replace(/[^0-9]/g, ""));
  };

  return (
    <div className="space-y-4">
      {/* Create Button - Admin only */}
      {isAdmin && !showCreateForm && (
        <motion.button
          onClick={() => setShowCreateForm(true)}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-rose-500/20 to-rose-600/20 border border-rose-400/40 text-rose-600 dark:text-rose-400 font-medium flex items-center justify-center gap-2 transition-all hover:shadow-lg"
        >
          <Plus className="w-5 h-5" />
          Create New Project
        </motion.button>
      )}
      {!isAdmin && (
        <div className="text-xs text-white/50 text-center pb-1">
          View-only — only admins can create or edit projects.
        </div>
      )}

      {/* Create Form */}
      {isAdmin && showCreateForm && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-3"
        >
          <h3 className="font-semibold text-white flex items-center gap-2">
            <FolderKanban className="w-5 h-5" />
            Create Church Project
          </h3>

          <div className="space-y-2">
            <label className="text-sm font-medium text-white">Project Name</label>
            <input
              type="text"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="e.g., Building Fund, Renovation Project"
              className="w-full h-10 px-3 rounded-lg border-2 bg-white/95 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-white/20 border-border/50 focus:border-rose-400"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-white">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the project, its purpose, and expected impact..."
              rows={3}
              className="w-full px-3 py-2 rounded-lg border-2 bg-white/95 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-white/20 border-border/50 focus:border-rose-400 resize-none"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-white">Target Amount (TZS)</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">TZS</span>
              <input
                type="text"
                value={targetAmount ? formatCurrency(parseInt(targetAmount) || 0) : ""}
                onChange={handleAmountChange}
                placeholder="0"
                className="w-full h-10 pl-12 pr-3 rounded-lg border-2 bg-white/95 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-white/20 border-border/50 focus:border-rose-400"
              />
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <motion.button
              onClick={() => createMutation.mutate()}
              disabled={createMutation.isPending || !projectName || !targetAmount}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="flex-1 py-2 px-3 rounded-lg bg-gradient-to-r from-rose-500/20 to-rose-600/20 text-rose-600 dark:text-rose-400 font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {createMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  Create Project
                </>
              )}
            </motion.button>

            <button
              onClick={() => setShowCreateForm(false)}
              className="flex-1 py-2 px-3 rounded-lg bg-white/5 text-white/70 font-medium transition-all hover:bg-white/10"
            >
              Cancel
            </button>
          </div>
        </motion.div>
      )}

      {/* Projects List */}
      <div className="space-y-3">
        {projectsQuery.isLoading && (
          <div className="flex justify-center py-8">
            <div className="text-center">
              <Loader2 className="w-6 h-6 animate-spin mx-auto text-white/50 mb-2" />
              <p className="text-sm text-white/50">Loading projects...</p>
            </div>
          </div>
        )}

        {projectsQuery.error && (
          <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 flex gap-3">
            <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-amber-100">Failed to load projects</p>
              <p className="text-xs text-amber-200/70">Please try again later</p>
            </div>
          </div>
        )}

        {projectsQuery.data && projectsQuery.data.length === 0 ? (
          <div className="text-center py-8">
            <FolderKanban className="w-12 h-12 mx-auto text-white/30 mb-3" />
            <p className="text-white/70">No active projects yet</p>
            <p className="text-sm text-white/50">Create the first project to get started</p>
          </div>
        ) : (
          projectsQuery.data?.map((project, index) => {
            const progress = getProgressPercent(project);
            const remaining = project.target_amount - project.collected_amount;

            return (
              <motion.div
                key={project.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-3"
              >
                {/* Header */}
                <div>
                  <h4 className="font-semibold text-white text-lg">{project.name}</h4>
                  {project.description && (
                    <p className="text-sm text-white/60 mt-1">{project.description}</p>
                  )}
                </div>

                {/* Progress Bar */}
                <div className="space-y-2">
                  <div className="flex justify-between items-baseline">
                    <span className="text-xs font-medium text-white/70">Target: TZS {formatCurrency(project.target_amount)}</span>
                    <span className="text-xs font-medium text-emerald-400">{progress.toFixed(1)}%</span>
                  </div>

                  <div className="h-2.5 bg-white/10 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full rounded-full bg-gradient-to-r from-rose-400 to-rose-500"
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(progress, 100)}%` }}
                      transition={{ duration: 0.8 }}
                    />
                  </div>

                  <div className="flex justify-between text-xs text-white/50">
                    <span>Collected: TZS {formatCurrency(project.collected_amount)}</span>
                    <span>{remaining > 0 ? `Remaining: TZS ${formatCurrency(remaining)}` : "✓ Reached"}</span>
                  </div>
                </div>

                {/* Status Badge */}
                {progress >= 100 && (
                  <div className="flex items-center gap-2 text-xs bg-emerald-500/20 text-emerald-400 px-2 py-1 rounded-full w-fit">
                    <CheckCircle2 className="w-4 h-4" />
                    Target Reached!
                  </div>
                )}
              </motion.div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default ProjectsView;
