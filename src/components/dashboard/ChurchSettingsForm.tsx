import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Settings, Loader2, Save, Trophy } from "lucide-react";
import {
  useChurchSettings,
  useUpdateChurchSettings,
} from "@/hooks/useChurchSettings";

const ChurchSettingsForm = () => {
  const settingsQuery = useChurchSettings();
  const updateMutation = useUpdateChurchSettings();

  const [annualGoal, setAnnualGoal] = useState("");
  const [bestGroupName, setBestGroupName] = useState<string>("");
  const [bestGroupPct, setBestGroupPct] = useState<string>("");

  useEffect(() => {
    if (settingsQuery.data) {
      setAnnualGoal(String(settingsQuery.data.annual_goal ?? ""));
      setBestGroupName(settingsQuery.data.best_group_name ?? "");
      setBestGroupPct(
        settingsQuery.data.best_group_percentage != null
          ? String(settingsQuery.data.best_group_percentage)
          : ""
      );
    }
  }, [settingsQuery.data]);

  const formatCurrency = (n: number) => n.toLocaleString("en-TZ");

  const handleSubmit = () => {
    const num = parseInt(annualGoal || "0", 10);
    if (num < 0) return;
    const pctNum = bestGroupPct === "" ? null : Math.max(0, Math.min(100, parseFloat(bestGroupPct)));
    updateMutation.mutate({
      annual_goal: num,
      best_group_name: bestGroupName.trim() || null,
      best_group_percentage: pctNum,
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-white">
        <Settings className="w-5 h-5" />
        <h3 className="font-semibold">Church Settings ({new Date().getFullYear()})</h3>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-white">
          Church Annual Goal (TZS)
        </label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
            TZS
          </span>
          <input
            type="text"
            value={annualGoal ? formatCurrency(parseInt(annualGoal) || 0) : ""}
            onChange={(e) => setAnnualGoal(e.target.value.replace(/[^0-9]/g, ""))}
            placeholder="0"
            className="w-full h-10 pl-12 pr-3 rounded-lg border-2 bg-white/95 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-white/20 border-border/50 focus:border-amber-400"
          />
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-white flex items-center gap-1">
          <Trophy className="w-4 h-4 text-amber-400" />
          Best Performing Group
        </label>
        <input
          type="text"
          value={bestGroupName}
          onChange={(e) => setBestGroupName(e.target.value)}
          placeholder="e.g. Vijana"
          maxLength={120}
          className="w-full h-10 px-3 rounded-lg border-2 bg-white/95 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-white/20 border-border/50 focus:border-amber-400"
        />
        <p className="text-xs text-white/50">
          Andika jina la kikundi kinachoongoza kwa sasa.
        </p>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-white">
          Best Group Performance (%)
        </label>
        <div className="relative">
          <input
            type="number"
            min={0}
            max={100}
            step="0.1"
            value={bestGroupPct}
            onChange={(e) => setBestGroupPct(e.target.value)}
            placeholder="0"
            className="w-full h-10 pl-3 pr-8 rounded-lg border-2 bg-white/95 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-white/20 border-border/50 focus:border-amber-400"
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
            %
          </span>
        </div>
        <p className="text-xs text-white/50">
          Asilimia ya ufanisi wa kikundi (0 - 100).
        </p>
      </div>

      <motion.button
        onClick={handleSubmit}
        disabled={updateMutation.isPending}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        className="w-full py-2.5 px-4 rounded-lg bg-gradient-to-r from-amber-500/30 to-amber-600/30 border border-amber-400/40 text-amber-100 font-medium flex items-center justify-center gap-2 transition-all disabled:opacity-50"
      >
        {updateMutation.isPending ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Saving...
          </>
        ) : (
          <>
            <Save className="w-4 h-4" />
            Save Settings
          </>
        )}
      </motion.button>
    </div>
  );
};

export default ChurchSettingsForm;
