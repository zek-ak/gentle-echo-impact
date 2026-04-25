import { motion } from "framer-motion";

interface ProgressRingProps {
  percentage: number;
  size?: number;
  strokeWidth?: number;
  label?: string;
  sublabel?: string;
  color?: "gold" | "emerald" | "xp" | "church-blue";
}

const colorMap = {
  gold: { stroke: "hsl(42, 55%, 52%)", glow: "hsl(42, 55%, 52%)" },
  emerald: { stroke: "hsl(155, 60%, 40%)", glow: "hsl(155, 60%, 40%)" },
  xp: { stroke: "hsl(270, 60%, 55%)", glow: "hsl(270, 60%, 55%)" },
  "church-blue": { stroke: "hsl(217, 54%, 27%)", glow: "hsl(217, 54%, 27%)" },
};

const ProgressRing = ({ percentage, size = 160, strokeWidth = 10, label, sublabel, color = "gold" }: ProgressRingProps) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;
  const colors = colorMap[color];

  return (
    <div className="relative inline-flex flex-col items-center justify-center">
      <svg width={size} height={size} className="transform -rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="hsl(var(--muted))"
          strokeWidth={strokeWidth}
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={colors.stroke}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset }}
          transition={{ duration: 1.5, ease: "easeOut" }}
          style={{ filter: `drop-shadow(0 0 8px ${colors.glow})` }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <motion.span
          className="text-3xl font-bold font-body text-foreground"
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.5, duration: 0.5 }}
        >
          {Math.round(percentage)}%
        </motion.span>
        {label && <span className="text-xs text-muted-foreground mt-1">{label}</span>}
        {sublabel && <span className="text-[10px] text-muted-foreground">{sublabel}</span>}
      </div>
    </div>
  );
};

export default ProgressRing;
