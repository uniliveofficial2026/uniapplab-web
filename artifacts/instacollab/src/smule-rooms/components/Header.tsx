import { Bell, Search } from "lucide-react";
import { Link } from "react-router-dom";

export function Header({ title }: { title: string }) {
  return (
    <header className="sticky top-0 z-50 bg-gray-900/80 backdrop-blur-md border-b border-gray-800">
      <div className="flex justify-between items-center h-14 px-4 max-w-md mx-auto">
        <h1 className="text-xl font-bold bg-gradient-to-r from-purple-400 to-pink-500 bg-clip-text text-transparent">
          {title}
        </h1>
        <div className="flex space-x-4 text-gray-300">
          <Link to="/discover" className="hover:text-white transition-colors block">
            <Search size={20} />
          </Link>
          <Link to="/notifications" className="hover:text-white transition-colors relative block">
            <Bell size={20} />
            <span className="absolute top-0 right-0 w-2 h-2 bg-pink-500 rounded-full"></span>
          </Link>
        </div>
      </div>
    </header>
  );
}
