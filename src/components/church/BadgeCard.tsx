import { motion } from "framer-motion";
import { Star, Flame, Target, Rocket, Trophy, Gem, Sparkles, Check } from "lucide-react";

const ICON_MAP: Record<string, React.FC<{ className?: string }>> = {
  Star, Flame, Target, Rocket, Trophy, Gem, Sparkles,
};

interface BadgeCardProps {
  icon: string;
  name: string;
  description: string;
  earned: boolean;
}

const BadgeCard = ({ icon, name, description, earned }: BadgeCardProps) => {
  const IconComponent = ICON_MAP[icon] || Star;

  return (
    <motion.div
      className={`relative flex flex-col items-center p-4 rounded-2xl text-center transition-all duration-300 ${
        earned
          ? "glass-card-hover"
          : "bg-muted/50 opacity-50 grayscale"
      }`}
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: earned ? 1 : 0.5, scale: 1 }}
      whileHover={earned ? { scale: 1.05 } : undefined}
    >
      {earned && (
        <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-accent flex items-center justify-center">
          <Check className="w-3 h-3 text-accent-foreground" />
        </div>
      )}
      <IconComponent className="w-8 h-8 mb-2 text-primary" />
      <p className="text-sm font-semibold text-foreground">{name}</p>
      <p className="text-xs text-muted-foreground mt-1">{description}</p>
    </motion.div>
  );
};

export default BadgeCard;
