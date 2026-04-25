import { motion } from "framer-motion";
import { ReactNode } from "react";

interface StatsCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: ReactNode;
  variant?: "default" | "gold" | "emerald" | "navy";
}

const variantStyles = {
  default: "church-card",
  gold: "bg-gold text-white",
  emerald: "bg-emerald text-white",
  navy: "bg-church-blue text-white",
};

const StatsCard = ({ title, value, subtitle, icon, variant = "default" }: StatsCardProps) => {
  return (
    <motion.div
      className={`p-5 rounded-lg ${variantStyles[variant]} ${variant === "default" ? "shadow-neu" : ""}`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -3, scale: 1.03, transition: { duration: 0.2 } }}
      style={variant === "default" ? { boxShadow: "var(--shadow-card)" } : undefined}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className={`text-sm font-medium ${variant === "default" ? "text-muted-foreground" : "opacity-90"}`}>
            {title}
          </p>
          <p className="text-2xl font-bold font-display mt-1">{value}</p>
          {subtitle && (
            <p className={`text-xs mt-1 ${variant === "default" ? "text-muted-foreground" : "opacity-75"}`}>
              {subtitle}
            </p>
          )}
        </div>
        {icon && (
          <div className={`text-2xl ${variant === "default" ? "text-church-blue" : ""}`}>
            {icon}
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default StatsCard;
