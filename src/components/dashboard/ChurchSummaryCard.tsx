import { motion } from "framer-motion";
import { Target, TrendingUp, Percent } from "lucide-react";
import SlideCard from "@/components/dashboard/SlideCard";

interface ChurchSummaryCardProps {
  annualGoal: number;
  totalCollected: number;
  currency?: string;
}

const ChurchSummaryCard = ({ 
  annualGoal, 
  totalCollected, 
  currency = "TZS" 
}: ChurchSummaryCardProps) => {
  const progress = annualGoal > 0 ? (totalCollected / annualGoal) * 100 : 0;
  const remaining = Math.max(0, annualGoal - totalCollected);

  return (
    <SlideCard>
      {/* Content */}
      <div className="relative z-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="text-white/60 text-sm font-medium">Church Annual Goal</p>
            <h2 className="text-2xl font-bold mt-1">{currency} {annualGoal.toLocaleString()}</h2>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center">
            <Target className="w-6 h-6 text-amber-400" />
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-white/70 text-sm">Progress</span>
            <span className="text-amber-400 font-bold">{progress.toFixed(1)}%</span>
          </div>
          <div className="h-3 bg-white/10 rounded-full overflow-hidden">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-amber-400 to-amber-300"
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(progress, 100)}%` }}
              transition={{ duration: 1, delay: 0.3, ease: "easeOut" }}
              style={{
                boxShadow: "0 0 12px rgba(251, 191, 36, 0.5)",
              }}
            />
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white/5 rounded-2xl p-4 backdrop-blur-sm">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
              <span className="text-white/60 text-xs">Collected</span>
            </div>
            <p className="text-xl font-bold text-emerald-400">
              {currency} {totalCollected.toLocaleString()}
            </p>
          </div>
          <div className="bg-white/5 rounded-2xl p-4 backdrop-blur-sm">
            <div className="flex items-center gap-2 mb-1">
              <Percent className="w-4 h-4 text-amber-400" />
              <span className="text-white/60 text-xs">Remaining</span>
            </div>
            <p className="text-xl font-bold">
              {currency} {remaining.toLocaleString()}
            </p>
          </div>
        </div>
      </div>
    </SlideCard>
  );
};

export default ChurchSummaryCard;

