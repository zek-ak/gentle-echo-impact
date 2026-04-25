import { KeyboardEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, X } from "lucide-react";

interface ExpandableCardProps {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  isExpanded: boolean;
  onToggle: () => void;
  index: number;
  onContributeClick?: () => void;
}

const ease: [number, number, number, number] = [0.22, 1, 0.36, 1];

const ExpandableCard = ({ title, icon, children, isExpanded, onToggle, index }: ExpandableCardProps) => {
  const contentId = `expandable-card-content-${index}`;

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onToggle();
    }
  };

  const baseShadow = "0 18px 50px rgba(15, 23, 42, 0.14), 0 8px 24px rgba(59, 130, 246, 0.12);";
  const liftedShadow = "0 30px 80px rgba(15, 23, 42, 0.18), 0 12px 36px rgba(59, 130, 246, 0.16);";

  return (
    <motion.div
      role="button"
      tabIndex={0}
      aria-expanded={isExpanded}
      aria-controls={contentId}
      onClick={onToggle}
      onKeyDown={handleKeyDown}
      layout
      initial={false}
      animate={isExpanded ? {
        rotateY: 0,
        scale: 1,
        y: 0,
        boxShadow: liftedShadow,
      } : {
        rotateY: [0, -8, 8, 0],
        scale: [1, 0.995, 0.985, 1],
        boxShadow: baseShadow,
      }}
      transition={{
        rotateY: { duration: 0.34, ease },
        scale: { duration: 0.34, ease },
        default: { duration: 0.38, ease },
      }}
      whileHover={{
        y: -4,
        boxShadow: liftedShadow,
      }}
      whileTap={{
        scale: 0.982,
        y: 1,
      }}
      className="relative overflow-hidden cursor-pointer rounded-2xl sm:rounded-[24px] border border-blue-900/40 bg-church-blue/95 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-4 focus-visible:ring-offset-slate-950"
      style={{
        background: "linear-gradient(145deg, rgba(12, 41, 92, 0.98) 0%, rgba(13, 55, 118, 0.98) 45%, rgba(10, 63, 146, 0.9) 100%)",
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
      }}
    >
      <div className="relative z-10">
        <motion.div
          layout
          className="flex items-center justify-between gap-3 px-4 py-4 sm:px-6 sm:py-6 pr-12 sm:pr-16"
        >
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <div className="flex h-9 w-9 sm:h-11 sm:w-11 items-center justify-center rounded-xl sm:rounded-2xl bg-white/10 text-white shadow-inner flex-shrink-0">
              {icon}
            </div>
            <div className="min-w-0">
              <h3 className="text-white font-display text-sm sm:text-lg font-semibold tracking-tight truncate">{title}</h3>
            </div>
          </div>
          <motion.div
            animate={{ rotate: isExpanded ? 180 : 0 }}
            transition={{ duration: 0.25, ease }}
            className="text-white/85 flex-shrink-0"
          >
            <ChevronDown className="w-4 h-4 sm:w-5 sm:h-5" />
          </motion.div>
        </motion.div>

        {/* Rounded close X — top right, only when expanded */}
        <AnimatePresence>
          {isExpanded && (
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
              className="absolute top-4 right-4 z-20 w-8 h-8 rounded-full flex items-center justify-center bg-white/15 hover:bg-white/25 text-white border border-white/25 backdrop-blur-sm"
            >
              <X className="w-4 h-4" />
            </motion.button>
          )}
        </AnimatePresence>

        <motion.div
          layout
          className="overflow-hidden"
          transition={{ duration: 0.42, ease }}
        >
          <AnimatePresence initial={false}>
            {isExpanded && (
              <motion.div
                key="content"
                id={contentId}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.28, ease, delay: isExpanded ? 0.05 : 0 }}
                className="px-4 sm:px-6 pb-5 sm:pb-6 pt-3 sm:pt-4 border-t border-white/15 max-h-[420px] sm:max-h-[480px] overflow-y-auto break-words [overflow-wrap:anywhere]"
              >
                {children}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </motion.div>
  );
};

// Card 1: Chuo Kikuu Friends
export const ChuoKikuuFriendsCard = ({ isExpanded, onToggle, index }: { isExpanded: boolean; onToggle: () => void; index: number }) => {
  const whatsAppLink = "https://chat.whatsapp.com/example"; // Replace with actual WhatsApp group link

  return (
    <ExpandableCard
      title="Chuo Kikuu Friends"
      isExpanded={isExpanded}
      onToggle={onToggle}
      index={index}
    >
      <div className="space-y-4">
        <p className="text-white/90 leading-relaxed">
          Click to join the WhatsApp group for Chuo Kikuu Friends and stay connected with our community.
        </p>
        <a
          href={whatsAppLink}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex px-6 py-3 bg-green-500 hover:bg-green-600 text-white font-semibold rounded-lg transition-all duration-300 hover:scale-105"
          onClick={(e) => e.stopPropagation()}
        >
          Join WhatsApp Group
        </a>
      </div>
    </ExpandableCard>
  );
};

// Card 2: Impact
export const ImpactCard = ({ 
  isExpanded, 
  onToggle, 
  index,
  totalContributed = 0, 
  activeMembers = 0 
}: { 
  isExpanded: boolean; 
  onToggle: () => void; 
  index: number;
  totalContributed?: number; 
  activeMembers?: number 
}) => {
  const impactPoints = [
    "Supporting weekly worship services and spiritual programs",
    "Funding educational initiatives and Bible study materials",
    "Helping community outreach and welfare programs",
    "Maintaining church facilities and grounds",
    "Supporting missionary work and evangelism efforts",
  ];

  return (
    <ExpandableCard
      title="Impact"
      isExpanded={isExpanded}
      onToggle={onToggle}
      index={index}
    >
      <div className="space-y-4">
        <p className="text-white/90 leading-relaxed">
          Your contributions have made a significant difference in advancing the mission of Chuo Kikuu SDA Church. Here's how your generosity is helping:
        </p>
        <ul className="space-y-2">
          {impactPoints.map((point, idx) => (
            <li key={idx} className="flex items-start gap-2 text-white/85">
              <span className="w-2 h-2 rounded-full bg-gold mt-2 shrink-0" />
              <span>{point}</span>
            </li>
          ))}
        </ul>
      </div>
    </ExpandableCard>
  );
};

// 
export const CallToActionCard = ({ 
  isExpanded, 
  onToggle, 
  index,
  onContributeClick 
}: { 
  isExpanded: boolean; 
  onToggle: () => void; 
  index: number;
  onContributeClick?: () => void 
}) => {
  return (
    <ExpandableCard
      title="Call to Action"
      isExpanded={isExpanded}
      onToggle={onToggle}
      index={index}
    >
      <div className="space-y-4">
        <p className="text-white/90 leading-relaxed">
          Join us in building God's kingdom through your generous support. Every contribution, no matter the size, makes a meaningful impact in our church community and beyond.
        </p>
        <p className="text-white/90 leading-relaxed">
          Your faithfulness in giving helps us continue our mission of sharing God's love and making a difference in the lives of others.
        </p>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (onContributeClick) onContributeClick();
          }}
          className="relative inline-flex w-full items-center justify-center rounded-xl border border-white/15 bg-gold px-8 py-4 text-base font-semibold text-white transition duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] transform will-change-transform overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-white/20 focus-visible:ring-offset-4 focus-visible:ring-offset-slate-950 hover:-translate-y-0.5 hover:bg-gold-dark/95 active:scale-[0.98] active:bg-gold-dark/90"
          style={{
            backgroundImage: 'linear-gradient(135deg, hsl(var(--gold)) 0%, hsl(var(--gold-light)) 100%)',
            boxShadow: 'inset 0 0 0 1px rgba(255, 255, 255, 0.08)',
          }}
        >
          Press Here to Contribute
        </button>
      </div>
    </ExpandableCard>
  );
};

// Card 4: Current Projects
export const CurrentProjectsCard = ({ 
  isExpanded, 
  onToggle, 
  index,
  projects = [] 
}: { 
  isExpanded: boolean; 
  onToggle: () => void; 
  index: number;
  projects?: { name: string; description: string }[] 
}) => {
  const defaultProjects = [
    {
      name: "Church Building Fund",
      description: "Renovating and expanding our worship facility to serve more members",
    },
    {
      name: "Youth Ministry Program",
      description: "Supporting spiritual growth and leadership development for young people",
    },
    {
      name: "Community Outreach",
      description: "Reaching out to those in need with food, shelter, and spiritual support",
    },
    {
      name: "Digital Ministry",
      description: "Expanding our online presence to reach more people with the Gospel",
    },
  ];

  const displayProjects = projects.length > 0 ? projects : defaultProjects;

  return (
    <ExpandableCard
      title="Current Projects"
      isExpanded={isExpanded}
      onToggle={onToggle}
      index={index}
    >
      <div className="space-y-4">
        <p className="text-white/90 leading-relaxed">
          Here are some of our current initiatives that your contributions support:
        </p>
        <div className="space-y-3">
          {displayProjects.slice(0, 4).map((project, idx) => (
            <div key={idx} className="p-4 bg-white/10 rounded-xl backdrop-blur-sm">
              <h4 className="font-semibold text-gold-light mb-1">{project.name}</h4>
              <p className="text-sm text-white/80">{project.description}</p>
            </div>
          ))}
        </div>
      </div>
    </ExpandableCard>
  );
};

