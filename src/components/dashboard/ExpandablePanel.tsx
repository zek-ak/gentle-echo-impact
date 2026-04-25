import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, ChevronUp, X } from "lucide-react";
import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface ExpandablePanelProps {
  id: string;
  title: string;
  icon: ReactNode;
  isOpen: boolean;
  onToggle: () => void;
  children: ReactNode;
  variant?: "default" | "gradient";
  /** Max height (in px) for the expandable content area before it becomes scrollable. Defaults to 480. */
  maxContentHeight?: number;
}

const ExpandablePanel = ({
  id,
  title,
  icon,
  isOpen,
  onToggle,
  children,
  variant = "default",
  maxContentHeight = 480,
}: ExpandablePanelProps) => {
  return (
    <motion.div
      className={cn(
        "relative overflow-hidden rounded-2xl border",
        variant === "gradient"
          ? "border-white/20 bg-white/5"
          : "border-border/50 bg-card"
      )}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      {/* Header - Always Visible */}
      <button
        onClick={onToggle}
        className={cn(
          "w-full flex items-center justify-between p-4 pr-14 transition-colors",
          variant === "gradient"
            ? "hover:bg-white/5 text-white"
            : "hover:bg-accent text-foreground"
        )}
      >
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "w-10 h-10 rounded-xl flex items-center justify-center",
              variant === "gradient"
                ? "bg-white/10 text-white"
                : "bg-primary/10 text-primary"
            )}
          >
            {icon}
          </div>
          <span className="font-semibold">{title}</span>
        </div>
        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          {isOpen ? (
            <ChevronUp className="w-5 h-5 text-muted-foreground" />
          ) : (
            <ChevronDown className="w-5 h-5 text-muted-foreground" />
          )}
        </motion.div>
      </button>

      {/* Close X — only when open, top-right rounded */}
      <AnimatePresence>
        {isOpen && (
          <motion.button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggle();
            }}
            aria-label="Close"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.15 }}
            className={cn(
              "absolute top-3 right-3 z-10 w-8 h-8 rounded-full flex items-center justify-center transition-colors",
              variant === "gradient"
                ? "bg-white/10 hover:bg-white/20 text-white border border-white/20"
                : "bg-muted hover:bg-muted/80 text-foreground border border-border"
            )}
          >
            <X className="w-4 h-4" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Content - Expandable & scrollable */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
          >
            <div
              className={cn(
                "px-4 pb-4 overflow-y-auto",
                variant === "gradient" ? "text-white" : "text-foreground"
              )}
              style={{ maxHeight: maxContentHeight }}
            >
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default ExpandablePanel;

