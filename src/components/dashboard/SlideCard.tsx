import { motion } from "framer-motion";
import { ReactNode } from "react";

interface SlideCardProps {
  children: ReactNode;
  onClick?: () => void;
  bgImage?: string;
  className?: string;
}

const SlideCard = ({ children, onClick, bgImage, className = "" }: SlideCardProps) => {
  return (
    <motion.div
      className={`relative overflow-visible min-h-[50vh] sm:min-h-[60vh] cursor-pointer ${className}`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.02, transition: { duration: 0.2 } }}
      transition={{ duration: 0.5 }}
      onClick={onClick}
    >
      {/* Background Image Container - Top portion only */}
      <div className="absolute top-0 left-0 right-0 h-[55%] sm:h-[60%] rounded-t-3xl overflow-hidden">
        {bgImage && (
          <motion.div
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url(${bgImage})` }}
            animate={{ scale: 1.1 }}
            transition={{ duration: 20, ease: "linear", repeat: Infinity, repeatType: "reverse" }}
          />
        )}
        {/* Subtle overlay on image */}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/20" />
      </div>

      {/* Text Container - Gradient Card with overlap */}
      <div 
        className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] sm:w-[calc(100%-3rem)] max-w-[650px] -mb-8 sm:-mb-10 rounded-3xl px-7 sm:px-8 py-8 sm:py-10 text-white"
        style={{
          background: 'linear-gradient(160deg, hsl(217 54% 27%), hsl(217 45% 38%), hsl(220 40% 22%))',
          boxShadow: '0 10px 30px rgba(0, 0, 0, 0.25), 0 0 20px rgba(212, 160, 23, 0.1)',
        }}
      >
        <div className="relative z-10">{children}</div>
      </div>
    </motion.div>
  );
};

export default SlideCard;
