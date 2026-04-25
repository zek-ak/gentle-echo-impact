import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import PaymentForm from "./PaymentForm";

interface PaymentDialogProps {
  open: boolean;
  onClose: () => void;
  userId?: string | null;
  isSimulated?: boolean;
  title?: string;
  subtitle?: string;
}

const PaymentDialog = ({
  open,
  onClose,
  userId = null,
  isSimulated = false,
  title = "Make a Contribution",
  subtitle = "Chuo Kikuu SDA Church",
}: PaymentDialogProps) => {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm px-3 sm:px-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="relative w-full max-w-md rounded-3xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col"
            initial={{ scale: 0.92, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.92, opacity: 0, y: 20 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundImage: "url(/sda_clean_super.png)",
              backgroundSize: "cover",
              backgroundPosition: "center",
            }}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-church-blue/95 via-church-blue/90 to-church-blue-dark/95" />

            <div className="relative z-10 p-5 sm:p-6 overflow-y-auto">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h2 className="text-lg sm:text-xl font-display text-white leading-tight">{title}</h2>
                  <p className="text-xs text-gold-light mt-0.5">{subtitle}</p>
                </div>
                <button
                  onClick={onClose}
                  aria-label="Close"
                  className="text-white/80 hover:text-white p-1 rounded-full hover:bg-white/10 transition-colors flex-shrink-0"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <PaymentForm userId={userId} isSimulated={isSimulated} />
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default PaymentDialog;
