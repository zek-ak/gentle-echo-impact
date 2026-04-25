import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";

interface XPPopupProps {
  amount: number;
  show: boolean;
  onComplete?: () => void;
}

const XPPopup = ({ amount, show, onComplete }: XPPopupProps) => {
  const [visible, setVisible] = useState(show);

  useEffect(() => {
    if (show) {
      setVisible(true);
      const timer = setTimeout(() => {
        setVisible(false);
        onComplete?.();
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [show, onComplete]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="fixed top-24 right-6 z-50 gradient-xp text-primary-foreground px-6 py-3 rounded-2xl font-bold text-lg shadow-lg flex items-center gap-2"
          initial={{ opacity: 0, scale: 0.5, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, y: -30, scale: 0.8 }}
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
        >
          +{amount} XP <Sparkles className="w-5 h-5" />
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default XPPopup;
