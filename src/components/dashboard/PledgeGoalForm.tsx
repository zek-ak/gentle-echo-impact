import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Target, Calendar, Loader2, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { createOrUpdatePledge, getCurrentUser } from "@/lib/supabase/database";
import { toast } from "sonner";

interface PledgeGoalFormProps {
  userId?: string;
  currentPledge?: { pledge_amount: number; year: number } | null;
  onSuccess?: () => void;
}

const PledgeGoalForm = ({
  userId,
  currentPledge,
  onSuccess
}: PledgeGoalFormProps) => {
  const [pledgeAmount, setPledgeAmount] = useState(currentPledge?.pledge_amount?.toString() || "");
  const [year, setYear] = useState(currentPledge?.year?.toString() || new Date().getFullYear().toString());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const currentYear = new Date().getFullYear();
  const years = [currentYear, currentYear + 1, currentYear + 2];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const amount = parseInt(pledgeAmount, 10);
    if (!amount || amount <= 0) {
      toast.error("Please enter a valid pledge amount");
      return;
    }

    // Get current user if userId not provided
    let targetUserId = userId;
    if (!targetUserId) {
      const user = await getCurrentUser();
      if (!user) {
        toast.error("You must be logged in to make a pledge");
        return;
      }
      targetUserId = user.id;
    }

    if (!targetUserId) {
      toast.error("Unable to identify user");
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await createOrUpdatePledge(targetUserId, amount, parseInt(year, 10));

      if (!result.success) {
        throw new Error(result.error || "Failed to save pledge");
      }

      setShowSuccess(true);
      toast.success("Pledge saved successfully!");
      onSuccess?.();
    } catch (error: any) {
      console.error("Pledge error:", error);
      toast.error(error.message || "Failed to save pledge. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatCurrency = (value: string): string => {
    const digits = value.replace(/[^0-9]/g, "");
    if (!digits) return "";
    return parseInt(digits, 10).toLocaleString();
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digits = e.target.value.replace(/[^0-9]/g, "");
    setPledgeAmount(digits);
  };

  if (showSuccess) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="text-center py-6"
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 200, damping: 15 }}
          className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center shadow-lg"
        >
          <CheckCircle2 className="w-8 h-8 text-white" />
        </motion.div>
        <h3 className="text-xl font-bold text-foreground mb-2">Pledge Confirmed!</h3>
        <p className="text-muted-foreground mb-4">
          You've pledged <span className="font-semibold text-emerald-500">TZS {parseInt(pledgeAmount || "0", 10).toLocaleString()}</span> for {year}
        </p>
        <button
          onClick={() => setShowSuccess(false)}
          className="text-primary hover:underline text-sm font-medium"
        >
          Make Another Pledge
        </button>
      </motion.div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <AnimatePresence mode="wait">
        {currentPledge && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl p-3 mb-4"
          >
            <p className="text-sm text-amber-800 dark:text-amber-200">
              Current pledge: <span className="font-bold">TZS {currentPledge.pledge_amount.toLocaleString()}</span> for {currentPledge.year}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Year Selection */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground flex items-center gap-2">
          <Calendar className="w-4 h-4 text-muted-foreground" />
          Pledge Year
        </label>
        <div className="grid grid-cols-3 gap-2">
          {years.map((y) => (
            <button
              key={y}
              type="button"
              onClick={() => setYear(y.toString())}
              className={cn(
                "py-2.5 px-3 rounded-xl text-sm font-medium transition-all duration-200",
                year === y.toString()
                  ? "bg-primary text-primary-foreground shadow-md"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              )}
            >
              {y}
            </button>
          ))}
        </div>
      </div>

      {/* Amount Input */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground flex items-center gap-2">
          <Target className="w-4 h-4 text-muted-foreground" />
          Pledge Amount (TZS)
        </label>
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">
            TZS
          </span>
          <input
            type="text"
            value={pledgeAmount ? formatCurrency(pledgeAmount) : ""}
            onChange={handleAmountChange}
            placeholder="0"
            className={cn(
              "w-full h-12 pl-16 pr-4 rounded-xl border-2 bg-background text-base font-medium transition-all duration-200",
              "focus:outline-none focus:ring-2 focus:ring-primary/20",
              pledgeAmount && parseInt(pledgeAmount, 10) > 0
                ? "border-primary/50 focus:border-primary"
                : "border-border focus:border-primary"
            )}
            inputMode="numeric"
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Set your annual giving goal for {year}
        </p>
      </div>

      {/* Quick Amount Buttons */}
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground">Quick select:</p>
        <div className="grid grid-cols-4 gap-2">
          {[10000, 25000, 50000, 100000].map((amount) => (
            <button
              key={amount}
              type="button"
              onClick={() => setPledgeAmount(amount.toString())}
              className="py-2 px-2 rounded-lg text-xs font-medium bg-muted hover:bg-muted/80 text-muted-foreground transition-colors"
            >
              {amount >= 1000 ? `${(amount / 1000)}K` : amount}
            </button>
          ))}
        </div>
      </div>

      {/* Submit Button */}
      <motion.button
        type="submit"
        disabled={isSubmitting || !pledgeAmount || parseInt(pledgeAmount, 10) <= 0}
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.99 }}
        className={cn(
          "w-full h-12 rounded-xl font-semibold text-base transition-all duration-200 flex items-center justify-center gap-2",
          isSubmitting || !pledgeAmount || parseInt(pledgeAmount, 10) <= 0
            ? "bg-muted text-muted-foreground cursor-not-allowed"
            : "gradient-gold text-primary-foreground shadow-lg hover:shadow-xl"
        )}
      >
        {isSubmitting ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            Saving...
          </>
        ) : (
          <>
            <Target className="w-5 h-5" />
            {currentPledge ? "Update Pledge" : "Make Pledge"}
          </>
        )}
      </motion.button>

    </form>
  );
};

export default PledgeGoalForm;

