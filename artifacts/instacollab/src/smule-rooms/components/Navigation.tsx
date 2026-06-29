import { Home, Mic2, User, LayoutDashboard, Music, MessageCircle, Radio, Sparkles } from "lucide-react";
import { Link, useLocation } from "react-router-dom";

const navItems = [
  { label: "Feed", icon: Home, path: "/" },
  { label: "Live", icon: Radio, path: "/live" },
  { label: "Sing", icon: Mic2, path: "/sing" },
  { label: "Party", icon: Sparkles, path: "/party" },
  { label: "Chat", icon: MessageCircle, path: "/messages" },
  { label: "Profile", icon: User, path: "/profile" },
];

export function Navigation() {
  const location = useLocation();

  return (
    <div className="md:hidden absolute bottom-0 left-0 right-0 bg-gray-900/90 backdrop-blur-xl border-t border-gray-800 pb-safe z-50">
      <div className="flex justify-around items-center h-16">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          const Icon = item.icon;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors ${
                isActive ? "text-purple-500" : "text-gray-400 hover:text-gray-300"
              }`}
            >
              <Icon size={24} className={isActive ? "fill-purple-500/20" : ""} />
              <span className="text-xs font-medium">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

export function DesktopNavigation() {
  const location = useLocation();

  return (
    <div className="hidden md:flex flex-col w-64 bg-gray-950 border-r border-gray-900 h-full p-6 space-y-8 relative z-50 text-gray-100">
      <div className="flex items-center space-x-3 text-purple-400 font-bold text-xl px-4">
        <Music size={28} /> <span>Smule Clone</span>
      </div>
      
      <div className="flex flex-col space-y-2">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          const Icon = item.icon;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center space-x-4 px-4 py-3 rounded-2xl transition-all ${
                isActive ? "bg-purple-600/20 text-purple-400" : "text-gray-400 hover:bg-gray-900 hover:text-white"
              }`}
            >
              <Icon size={24} className={isActive ? "fill-purple-500/20" : ""} />
              <span className="font-semibold">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
