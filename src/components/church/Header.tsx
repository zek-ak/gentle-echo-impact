import { Link, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { LayoutDashboard, Trophy, LogOut, Shield, DollarSign, Users } from "lucide-react";
import { getSession } from "@/lib/auth";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

const Header = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const session = getSession();
  const { logout } = useAuth();
  const isSimulated = false; // or from session if needed

  // navigation items are intentionally empty now; only sign out button remains
  const navItems: { to: string; label: string; icon: React.FC<any> }[] = [];

  return (
    <motion.header
      className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-slate-200"
      initial={{ y: -60 }}
      animate={{ y: 0 }}
      transition={{ type: "spring", stiffness: 200, damping: 25 }}
    >
      <div className="container mx-auto flex items-center justify-between h-16 px-4">
        <Link to="/" className="flex items-center gap-2">
          <span className="font-display text-lg text-church-blue">Chuo Kikuu SDA Church</span>
        </Link>

        <nav className="flex items-center gap-1">
          {navItems.map((item) => {
            const active = location.pathname === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`relative flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  active ? "text-church-blue bg-church-blue/5" : "text-slate-600 hover:text-church-blue hover:bg-slate-50"
                }`}
              >
                <item.icon className="w-4 h-4" />
                <span className="hidden sm:inline">{item.label}</span>
                {active && (
                  <motion.div
                    className="absolute inset-0 rounded-lg bg-church-blue/10"
                    layoutId="activeNav"
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  />
                )}
              </Link>
            );
          })}
        </nav>
      </div>
    </motion.header>
  );
};

export default Header;
