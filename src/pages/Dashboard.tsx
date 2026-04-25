
import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import confetti from "canvas-confetti";
import { getSession, clearSession } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { useMemberDashboard, usePublicDashboard } from "@/hooks/useChurchData";
import { createSupabaseClient } from "../lib/supabase/client.ts";
// LEVELS removed - using Lucide icons directly
import Header from "@/components/church/Header";
import { cn } from "@/lib/utils";

// Dashboard Components
import OverviewCard from "@/components/dashboard/OverviewCard";
import ActionButtonsGrid, { actions } from "@/components/dashboard/ActionButtonsGrid";
import PledgeGoalForm from "@/components/dashboard/PledgeGoalForm";
import ProjectsView from "@/components/dashboard/ProjectsView";
import ChurchSettingsForm from "@/components/dashboard/ChurchSettingsForm";
import { useIsAdmin } from "@/hooks/useAdmin";
import { useChurchSettings, useChurchTotalCollected } from "@/hooks/useChurchSettings";

// Icons
import { 
  Wallet, 
  Target, 
  FileText, 
  Users, 
  FolderKanban, 
  BarChart3,
  Bell,
  Loader2,
  ArrowUpRight,
  CheckCircle2,
  X
} from "lucide-react";
import { toast } from "sonner";
import * as LucideIcons from "lucide-react";

const LEVEL_ICONS: Record<string, React.FC<{ className?: string }>> = {
  Sprout: LucideIcons.Sprout,
  Leaf: LucideIcons.Leaf,
  Hammer: LucideIcons.Hammer,
  Church: LucideIcons.Church,
  Crown: LucideIcons.Crown,
};

const LevelIcon = ({ name }: { name: string }) => {
  const Icon = LEVEL_ICONS[name] || LucideIcons.Sprout;
  return <Icon className="w-5 h-5 text-primary" />;
};



// ClickPesa Hosted Checkout Form
// User clicks "Contribute" → we ask ClickPesa for a hosted checkout URL → open in new tab.
// Hosted page lets them choose Mobile Money, Bank Transfer, or Card.
const PaymentForm = ({ userId, isSimulated }: { userId?: string; isSimulated: boolean }) => {
  const [phone, setPhone] = useState("");
  const [reference, setReference] = useState("");
  const [amount, setAmount] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentState, setPaymentState] = useState<"form" | "processing" | "success" | "error">("form");
  const [statusMessage, setStatusMessage] = useState<string>("");
  

  const formatPhoneNumber = (value: string): string => {
    const digits = value.replace(/\D/g, "").slice(0, 12);
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `${digits.slice(0, 3)} ${digits.slice(3)}`;
    if (digits.length <= 9) return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
    return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6, 9)} ${digits.slice(9)}`;
  };

  const formatCurrency = (amt: number): string => amt.toLocaleString("en-TZ");

  const pollStatus = async (orderReference: string, maxAttempts = 60): Promise<string> => {
    const session = getSession();
    const supabase = createSupabaseClient(session?.access_token);
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise((r) => setTimeout(r, 5000)); // poll every 5s, up to ~5min
      try {
        const { data, error } = await supabase.functions.invoke("clickpesa-status", {
          body: { orderReference },
        });
        if (error) {
          console.warn("[poll] error", error);
          continue;
        }
        const s = (data as any)?.status;
        setStatusMessage(`Payment status: ${s ?? "processing"}...`);
        if (s === "success") return "success";
        if (s === "failed" || s === "reversed") return s;
      } catch (e) {
        console.warn("[poll] exception", e);
      }
    }
    return "timeout";
  };

  const handleSubmit = async () => {
    const numericAmount = parseInt(amount, 10);
    if (!numericAmount || numericAmount < 500 || numericAmount > 3_000_000) {
      toast.error("Amount must be between TZS 500 and 3,000,000");
      return;
    }

    const cleanPhone = phone.replace(/\s/g, "");
    if (!cleanPhone || cleanPhone.length < 10) {
      toast.error("Enter a valid phone number");
      return;
    }

    setIsProcessing(true);
    setPaymentState("processing");
    setStatusMessage("Sending USSD push to your phone...");

    // Demo mode (guest dashboard)
    if (isSimulated) {
      await new Promise((r) => setTimeout(r, 1500));
      setPaymentState("success");
      confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 }, colors: ["#d4a017", "#2d8a56", "#7c3aed"] });
      toast.success("Contribution recorded! (Demo Mode)");
      setIsProcessing(false);
      return;
    }

    try {
      const session = getSession();
      const supabase = createSupabaseClient(session?.access_token);

      const { data, error } = await supabase.functions.invoke("clickpesa-initiate", {
        body: {
          amount: numericAmount,
          phone: cleanPhone,
          userId: userId ?? null,
          reference: reference || null,
        },
      });

      if (error || !(data as any)?.success) {
        const msg = (data as any)?.error || error?.message || "Failed to start payment";
        console.error("[clickpesa] initiate failed", error, data);
        setPaymentState("error");
        setStatusMessage(msg);
        toast.error(msg);
        setIsProcessing(false);
        return;
      }

      const orderReference: string = (data as any).orderReference;
      setStatusMessage("Check your phone and enter PIN to confirm payment.");
      toast.success("USSD push sent. Confirm on your phone.");

      const finalStatus = await pollStatus(orderReference);
      if (finalStatus === "success") {
        setPaymentState("success");
        confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 }, colors: ["#d4a017", "#2d8a56", "#7c3aed"] });
        toast.success("Contribution received!");
      } else if (finalStatus === "timeout") {
        setPaymentState("error");
        setStatusMessage("We didn't receive a confirmation in time. Check 'My Contributions' shortly.");
        toast.error("Timed out. We will update once ClickPesa confirms.");
      } else {
        setPaymentState("error");
        setStatusMessage(`Payment ${finalStatus}. Please try again.`);
        toast.error(`Payment ${finalStatus}`);
      }
    } catch (err: any) {
      console.error("[clickpesa] exception", err);
      setPaymentState("error");
      setStatusMessage(err?.message || "Unexpected error");
      toast.error(err?.message || "Unexpected error");
    } finally {
      setIsProcessing(false);
    }
  };

  if (paymentState === "processing") {
    return (
      <div className="text-center py-10 space-y-4">
        <Loader2 className="w-12 h-12 mx-auto text-gold animate-spin" />
        <h3 className="text-xl font-display text-white">Check Your Phone</h3>
        <p className="text-sm text-white/70 max-w-xs mx-auto">{statusMessage}</p>
      </div>
    );
  }

  if (paymentState === "success") {
    return (
      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-8">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center shadow-lg"
        >
          <CheckCircle2 className="w-10 h-10 text-white" />
        </motion.div>
        <h2 className="text-2xl font-display text-white mb-2">Contribution Received!</h2>
        <p className="text-sm text-white/70 mb-6">Thank you for your generous contribution.</p>
        <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 mb-6 text-left border border-white/10">
          <div className="flex justify-between py-2 border-b border-white/10">
            <span className="text-white/60">Amount</span>
            <span className="font-semibold text-gold-light text-lg">
              TZS {formatCurrency(parseInt(amount, 10) || 0)}
            </span>
          </div>
        </div>
        <motion.button
          onClick={() => { setPaymentState("form"); setAmount(""); setPhone(""); setReference(""); setStatusMessage(""); }}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="w-full py-3 px-6 rounded-xl gradient-gold text-primary-foreground font-semibold transition-all shadow-lg"
        >
          Make Another Contribution
        </motion.button>
      </motion.div>
    );
  }

  if (paymentState === "error") {
    return (
      <div className="text-center py-8 space-y-4">
        <div className="w-16 h-16 mx-auto rounded-full bg-red-500/20 flex items-center justify-center">
          <X className="w-8 h-8 text-red-400" />
        </div>
        <h3 className="text-xl font-display text-white">Payment Failed</h3>
        <p className="text-sm text-white/70 max-w-xs mx-auto">{statusMessage}</p>
        <button
          onClick={() => { setPaymentState("form"); setStatusMessage(""); }}
          className="w-full py-3 px-6 rounded-xl gradient-gold text-primary-foreground font-semibold"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-white/5 border border-white/10 p-3 text-xs text-white/70">
        You'll be redirected to ClickPesa's secure checkout page where you can pay with
        <strong className="text-white"> Mobile Money</strong>,
        <strong className="text-white"> Bank Transfer</strong>, or
        <strong className="text-white"> Card</strong>.
      </div>

      <div className="space-y-3">
        <div className="space-y-1">
          <label className="text-sm font-semibold text-white">
            Phone Number <span className="text-white/40 font-normal">(Optional)</span>
          </label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(formatPhoneNumber(e.target.value))}
            placeholder="2557XXXXXXXX"
            className="w-full h-11 px-4 rounded-xl border-2 bg-white/95 text-base font-medium focus:outline-none focus:ring-2 focus:ring-white/20 border-border/50 focus:border-gold"
            maxLength={16}
          />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-semibold text-white">
            Reference Note <span className="text-white/40 font-normal">(Optional)</span>
          </label>
          <input
            type="text"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            placeholder="e.g., Tithe, Offering"
            className="w-full h-11 px-4 rounded-xl border-2 bg-white/95 text-base font-medium focus:outline-none focus:ring-2 focus:ring-white/20 border-border/50 focus:border-gold"
          />
        </div>
      </div>

      <div className="space-y-1">
        <label className="text-sm font-semibold text-white">Amount (TZS)</label>
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-base text-muted-foreground font-medium">TZS</span>
          <input
            type="text"
            value={amount ? formatCurrency(parseInt(amount) || 0) : ""}
            onChange={(e) => setAmount(e.target.value.replace(/[^0-9]/g, ""))}
            placeholder="500"
            className="w-full h-11 pl-16 pr-4 rounded-xl border-2 bg-white/95 text-base font-medium focus:outline-none focus:ring-2 focus:ring-white/20 border-border/50 focus:border-gold"
          />
        </div>
        <p className="text-xs text-white/60">Minimum amount is TZS 500.</p>
      </div>

      <motion.button
        type="button"
        onClick={handleSubmit}
        disabled={isProcessing}
        whileHover={!isProcessing ? { scale: 1.01 } : {}}
        whileTap={!isProcessing ? { scale: 0.99 } : {}}
        className={`w-full h-12 rounded-xl font-semibold text-base transition-all flex items-center justify-center gap-2 ${
          isProcessing
            ? "bg-white/20 text-white/50 cursor-not-allowed"
            : "gradient-gold text-primary-foreground shadow-lg hover:shadow-xl"
        }`}
      >
        {isProcessing ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            Opening checkout...
          </>
        ) : (
          "Contribute Now"
        )}
      </motion.button>
    </div>
  );
};



const ContributionsList = ({ contributions }: { contributions: any[] }) => {
  if (contributions.length === 0) {
    return (
      <div className="text-center py-8">
        <Wallet className="w-12 h-12 mx-auto text-white/30 mb-3" />
        <p className="text-white/70">No contributions yet</p>
        <p className="text-sm text-white/50">Start contributing to see your history here</p>
      </div>
    );
  }

  return (
    <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
      {contributions.map((contribution: any) => (
        <motion.div
          key={contribution.id}
          className="flex items-center justify-between p-3 rounded-xl bg-white/5"
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
              <ArrowUpRight className="w-5 h-5 text-emerald-500" />
            </div>
            <div>
              <p className="font-semibold text-white">
                TZS {contribution.amount?.toLocaleString() || "0"}
              </p>
              <p className="text-xs text-white/50">
                {(contribution as any).projects?.name || "General Fund"} • {contribution.method || "Demo"}
              </p>
            </div>
            <p className="text-sm text-white/50">
              {contribution.created_at ? new Date(contribution.created_at).toLocaleDateString() : "Today"}
            </p>
          </div>
        </motion.div>
      ))}
    </div>
  );
};

// **GroupMembersList REMOVED** - No groups
// const GroupMembersList = ... (entire component deleted)

const ProjectsList = ({ projects }: { projects: any[] }) => {
  if (!projects || projects.length === 0) {
    return (
      <div className="text-center py-8">
        <FolderKanban className="w-12 h-12 mx-auto text-white/30 mb-3" />
        <p className="text-white/70">No active projects</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {projects.map((project: any) => {
        const progress = project.target_amount > 0 
          ? (project.collected_amount / project.target_amount) * 100 
          : 0;
        return (
          <motion.div
            key={project.id}
            className="p-4 rounded-xl bg-white/5 border border-white/10"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="flex items-start justify-between mb-3">
              <div>
                <h4 className="font-semibold text-white">{project.name}</h4>
                {project.description && (
                  <p className="text-sm text-white/50 mt-1">{project.description}</p>
                )}
              </div>
              <span className="px-2 py-1 rounded-full text-xs font-medium bg-emerald-500/20 text-emerald-400">
                {project.status || "Ongoing"}
              </span>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-white/50">Progress</span>
                <span className="font-medium text-white">{progress.toFixed(1)}%</span>
              </div>
              <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                <motion.div
                  className="h-full rounded-full bg-gradient-to-r from-amber-400 to-amber-300"
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(progress, 100)}%` }}
                  transition={{ duration: 0.8 }}
                />
              </div>
              <div className="flex justify-between text-xs text-white/50">
                <span>TZS {project.collected_amount?.toLocaleString() || 0}</span>
                <span>TZS {project.target_amount?.toLocaleString() || 0}</span>
              </div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
};

const ReportsSection = ({ profile, contributions }: { profile: any; contributions: any[] }) => {
  const completed = contributions.filter((c: any) => c.status === "completed");
  const totalContributed = completed.reduce((sum: number, c: any) => sum + (c.amount || 0), 0);
  const contributionCount = completed.length;
  const avgContribution = contributionCount > 0 ? totalContributed / contributionCount : 0;

  const stats = [
    { label: "Total Contributed", value: `TZS ${totalContributed.toLocaleString()}` },
    { label: "Contributions Made", value: contributionCount.toString() },
    { label: "Average Contribution", value: `TZS ${Math.round(avgContribution).toLocaleString()}` },
{ label: "Annual Goal", value: `TZS ${(profile?.annual_goal ?? 0)?.toLocaleString() || 0}` },
{ label: "Goal Progress", value: `${profile?.annual_goal && profile?.annual_goal > 0 ? Math.round(( (profile.total_contributed ?? 0) / profile.annual_goal ) * 100) : 0}%` },
    { label: "Current Level", value: profile?.level || "Seed Sower" },
  ];

  return (
    <div className="grid grid-cols-2 gap-3">
      {stats.map((stat, index) => (
        <motion.div
          key={stat.label}
          className="p-4 rounded-xl bg-white/5"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.05 }}
        >
          <p className="text-xs text-white/50 mb-1">{stat.label}</p>
          <p className="text-lg font-bold text-white">{stat.value}</p>
        </motion.div>
      ))}
    </div>
  );
};

const Dashboard = () => {
  const { logout: authLogout, isLoggingOut } = useAuth();
  const session = getSession();
  const navigate = useNavigate();
  
  const [activePanel, setActivePanel] = useState<string | null>(null);

  if (!session) {
    navigate("/");
    return null;
  }

  const queryUserId = session.user_id;

  const { data: publicData, isLoading: publicLoading, error: publicError } = usePublicDashboard();

  const { profileQuery, contributionsQuery, pledgesQuery } = useMemberDashboard(queryUserId);
  const { data: isAdmin = false } = useIsAdmin(queryUserId);
  const { data: churchSettings } = useChurchSettings();
  const { data: churchTotalCollected = 0 } = useChurchTotalCollected();

  // Handle null publicData gracefully (no more mock fallback)
  const safePublicData = publicData || { total_collected: 0, active_members: 0, best_group: null, groups_leaderboard: [], current_project: null };


  if (profileQuery.isLoading || contributionsQuery.isLoading || pledgesQuery.isLoading || publicLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (profileQuery.error || contributionsQuery.error || pledgesQuery.error || publicError) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-6">
          <div className="w-16 h-16 mx-auto mb-4 bg-red-100 rounded-full flex items-center justify-center">
            <X className="w-8 h-8 text-red-600" />
          </div>
          <h2 className="text-xl font-semibold text-foreground mb-2">Failed to Load Dashboard</h2>
          <p className="text-muted-foreground mb-4">
            Unable to load your dashboard data. Please try refreshing the page.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
          >
            Refresh Page
          </button>
        </div>
      </div>
    );
  }

  const profile = profileQuery.data;
  const contributions = contributionsQuery.data ?? [];
  const pledges = pledgesQuery.data ?? [];
        const groupName = profile?.full_name || session.user.full_name || "Church Member";

  // Get current year's pledge
  const currentYear = new Date().getFullYear();
  const currentPledge = pledges.find((p: any) => p.year === currentYear) || null;

  // Church-wide goal: from admin-managed church_settings (annual goal),
  // not from the current project. Total collected = sum of all contributions.
  const churchGoal = churchSettings?.annual_goal ?? 0;
  const churchCollected = churchTotalCollected;
  const bestGroup = (publicData as any)?.best_group;
  const projects = publicData?.current_project ? [publicData.current_project] : [];

  const balance = currentPledge ? Math.max(0, currentPledge.pledge_amount - (profile?.total_contributed || 0)) : 0;
  // groupProgress removed


  const handleAction = (actionId: string) => {
    setActivePanel(prev => prev === actionId ? null : actionId);
  };

  const closeDropdown = () => {
    setActivePanel(null);
  };

  const getDropdownContent = () => {
    switch (activePanel) {
      case "contribute":
        return (
          <div className="rounded-2xl p-4" style={{ background: "linear-gradient(135deg, #1e3a5f 0%, #0f2744 50%, #1a3a5c 100%)" }}>
            <PaymentForm userId={profile?.id} isSimulated={false} />
          </div>
        );

      case "pledge":
        return <PledgeGoalForm userId={profile?.id} currentPledge={currentPledge} onSuccess={() => {
          // Refresh pledges data after successful pledge
          pledgesQuery.refetch();
          profileQuery.refetch();
        }} />;
      case "my-contributions":
        return (
          <div className="rounded-2xl p-4" style={{ background: "linear-gradient(135deg, #1e3a5f 0%, #0f2744 50%, #1a3a5c 100%)" }}>
            <ContributionsList contributions={contributions} />
          </div>
        );
      
      case "projects":
        return (
          <div className="rounded-2xl p-4" style={{ background: "linear-gradient(135deg, #1e3a5f 0%, #0f2744 50%, #1a3a5c 100%)" }}>
            <ProjectsView userId={profile?.id} isAdmin={isAdmin} />
          </div>
        );
      case "reports":
        return <ReportsSection profile={profile} contributions={contributions} />;
      case "church-settings":
        return isAdmin ? (
          <div className="rounded-2xl p-4" style={{ background: "linear-gradient(135deg, #1e3a5f 0%, #0f2744 50%, #1a3a5c 100%)" }}>
            <ChurchSettingsForm />
          </div>
        ) : null;
      default:
        return null;
    }
  };

  const container = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.05 } },
  };
  const item = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 },
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <Header />
      
      <motion.div
        className="container mx-auto px-4 py-6 space-y-6"
        variants={container}
        initial="hidden"
        animate="show"
      >
        {/* Modern Welcome Card */}
        <motion.div 
          variants={item} 
          className="rounded-[20px] px-6 sm:px-8 py-8 sm:py-10 shadow-2xl"
          style={{
            background: 'linear-gradient(160deg, hsl(217 54% 27%), hsl(217 45% 38%), hsl(220 40% 22%))',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.3), 0 0 30px rgba(212, 160, 23, 0.15)',
          }}
        >
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
            {/* User Info */}
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full gradient-gold flex items-center justify-center text-primary-foreground font-bold text-lg sm:text-xl flex-shrink-0">
                {(profile?.full_name ?? "").split(" ").map((n: string) => n[0]).join("") || "U"}
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-display text-white mb-1">
                  Hello, {session.user.full_name?.split(" ")[0] || (profile?.full_name ?? "").split(" ")[0] || "User"}
                </h1>
                <p className="text-white/80 capitalize text-sm sm:text-base">
Member • Chuo Kikuu SDA Church
                </p>
              </div>
            </div>

            {/* Right Actions */}
            <div className="flex items-center gap-3 sm:gap-4 flex-shrink-0">
              <button 
                className="w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center relative transition-all duration-300 backdrop-blur-sm border border-white/20"
                title="Notifications"
              >
                <Bell className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-pulse" />
              </button>
              <button
                onClick={async () => {
                  clearSession();
                  navigate('/');
                }}
                className="px-4 sm:px-6 py-2 sm:py-2.5 bg-white/15 hover:bg-destructive/50 text-white text-sm sm:text-base rounded-lg transition-all duration-300 border border-white/20 hover:border-destructive/50 font-medium backdrop-blur-sm"
                title="Sign Out"
              >
                Sign Out
              </button>
            </div>
          </div>
        </motion.div>

        <motion.div variants={item}>
        <OverviewCard
          churchGoal={churchGoal}
          churchCollected={churchCollected}
          bestGroup={(bestGroup as any) ? {
            name: (bestGroup as any).name || "Unknown Group",
            percentage: (bestGroup as any).percentage ?? 0,
          } : null}
          myRemainingGoal={balance}
        />

        </motion.div>

        <motion.div variants={item}>
          <ActionButtonsGrid
            onAction={handleAction}
            activeAction={activePanel}
            onCloseDropdown={closeDropdown}
            isAdmin={isAdmin}
          />
        </motion.div>

        {/* Global logout overlay */}
        <AnimatePresence>
          {isLoggingOut && (
            <motion.div 
              className="fixed inset-0 z-[60] flex items-center justify-center bg-background/95 backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.8 }}
            >
              <motion.div 
                initial={{ scale: 0.8, opacity: 0 }} 
                animate={{ scale: 1, opacity: 1 }} 
                className="text-center p-8 rounded-2xl bg-card shadow-2xl max-w-sm mx-4"
              >
                <div className="w-16 h-16 mb-6 mx-auto border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
                <h3 className="text-xl font-semibold text-foreground mb-2">Signing Out</h3>
                <p className="text-muted-foreground">See you soon!</p>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* modal overlay for selected action */}
        <AnimatePresence>
          {activePanel && getDropdownContent() && (
            <motion.div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.6, ease: 'easeInOut' }}
              onClick={closeDropdown}
            >
              <motion.div
                className="relative w-[90vw] sm:w-full max-w-md rounded-3xl shadow-2xl overflow-hidden"
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                transition={{ duration: 0.6, ease: 'easeInOut' }}
                onClick={(e) => e.stopPropagation()}
                style={{ background: "linear-gradient(135deg, #1e3a5f 0%, #0f2744 50%, #1a3a5c 100%)" }}
              >
                <div className="relative p-4">
                  <button
                    type="button"
                    onClick={closeDropdown}
                    aria-label="Close panel"
                    className="absolute right-4 top-4 inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-black/40 text-white shadow-lg transition-colors hover:bg-white/10"
                  >
                    <X className="w-4 h-4" />
                  </button>
                  {actions.find(a => a.id === activePanel) && (
                    <div className="flex items-center gap-2 mb-4">
                      <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", actions.find(a => a.id === activePanel)!.color)}>
                        {actions.find(a => a.id === activePanel)!.icon}
                      </div>
                      <span className="font-medium text-white text-lg">
                        {actions.find(a => a.id === activePanel)!.label}
                      </span>
                    </div>
                  )}
                  {getDropdownContent()}
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
};

export default Dashboard;