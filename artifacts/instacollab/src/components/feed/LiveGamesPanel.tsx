import React from 'react';
import { PlaySquare, Users } from 'lucide-react';

export function LiveGamesPanel() {
  return (
    <div className="w-full bg-card border border-border p-4 mb-6 rounded-xl">
      <h3 className="font-bold text-[15px] mb-4 flex items-center gap-2">
        <PlaySquare className="w-4 h-4 text-red-500" />
        Live Streams & Games
      </h3>
      <div className="flex gap-3 overflow-x-auto no-scrollbar">
        {[
          { title: 'Gaming Pro', viewers: '12K', type: 'Live' },
          { title: 'Quiz Night', viewers: '5K', type: 'Game' },
          { title: 'Art Stream', viewers: '2K', type: 'Live' },
        ].map((item, i) => (
          <div key={i} className="flex-shrink-0 w-32 p-3 bg-secondary/50 rounded-xl border border-border hover:border-primary transition-colors cursor-pointer">
            <div className="flex justify-between items-center mb-2">
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${item.type === 'Live' ? 'bg-red-500/20 text-red-500' : 'bg-blue-500/20 text-blue-500'}`}>
                {item.type}
              </span>
              <span className="text-[10px] font-medium text-muted-foreground flex items-center gap-1">
                <Users className="w-3 h-3" /> {item.viewers}
              </span>
            </div>
            <div className="font-bold text-sm truncate">{item.title}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
