import { motion, AnimatePresence } from 'motion/react';
import React from 'react';
import { X, ShoppingBag, Coins, DollarSign } from 'lucide-react';
import { handleMediaError } from '../../lib/utils';

interface MarketplaceModalProps {
  showMarketplace: boolean;
  setShowMarketplace: (show: boolean) => void;
  activeMktTab: string;
  setActiveMktTab: (tab: string) => void;
  handleBuy: (id: string, e: React.MouseEvent) => void;
  purchasedItems: Record<string, boolean>;
}

const PRODUCTS = [
  { id: 'p1', name: 'Premium Preset Pack', cat: 'Presets', price: 100, type: 'coins' },
  { id: 'p2', name: 'Streamer Overlay Template', cat: 'Templates', price: 25, type: 'cash' },
  { id: 'p3', name: 'Dark Cyberpunk UI Kit', cat: 'Designs', price: 150, type: 'coins' },
  { id: 'p4', name: 'Pro Audio Filter Set', cat: 'Audio', price: 45, type: 'cash' },
  { id: 'p5', name: 'Animated Twitch Alerts', cat: 'Graphics', price: 200, type: 'coins' },
];

const CATEGORIES = ['Presets', 'Templates', 'Designs', 'Audio', 'Graphics'];

export function MarketplaceModal({ 
  showMarketplace, 
  setShowMarketplace, 
  activeMktTab, 
  setActiveMktTab, 
  handleBuy, 
  purchasedItems
}: MarketplaceModalProps) {
  if (!showMarketplace) return null;
  
  const filteredProducts = PRODUCTS.filter(p => p.cat === activeMktTab);
  
  return (
    <div 
      id="marketplace-modal" 
      className="fixed inset-0 z-[200] flex items-center justify-center bg-background/80 backdrop-blur-md"
      onClick={() => setShowMarketplace(false)}
    >
      <motion.div 
        initial={{ opacity: 0, y: 100 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 100 }}
        className="bg-card w-full max-w-4xl rounded-3xl border border-border shadow-2xl overflow-hidden flex flex-col h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="h-16 border-b border-border flex items-center justify-between px-6 shrink-0 z-10 sticky top-0 bg-background">
          <h2 className="text-2xl font-black vibe-gradient-text logo-font">Creator Marketplace</h2>
          <button onClick={() => setShowMarketplace(false)} className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center hover:bg-secondary/80 text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto no-scrollbar p-6">
            <div className="flex gap-2 overflow-x-auto no-scrollbar mb-8 pb-2">
                {CATEGORIES.map((cat, i) => (
                <button 
                    key={i} 
                    onClick={() => setActiveMktTab(cat)}
                    className={`px-5 py-2 rounded-full font-bold text-sm whitespace-nowrap transition-colors ${activeMktTab === cat ? 'bg-foreground text-background' : 'bg-secondary text-foreground hover:bg-secondary/80'}`}>
                    {cat}
                </button>
                ))}
            </div>
            
            {filteredProducts.length === 0 ? (
                <div className="text-center py-20 text-muted-foreground font-semibold">No items in this category yet.</div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-6">
                    {filteredProducts.map(p => (
                        <div key={p.id} className="bg-card border border-border p-5 rounded-3xl flex flex-col gap-4 hover:border-primary/50 transition-all hover:shadow-lg">
                             <div className="aspect-square bg-secondary rounded-2xl flex items-center justify-center text-4xl">
                                {p.cat === 'Presets' ? '🎨' : p.cat === 'Templates' ? '🖼️' : '📦'}
                             </div>
                            
                            <div className="flex-1">
                                <h3 className="font-bold text-lg text-foreground">{p.name}</h3>
                                <div className="flex items-center gap-1.5 font-black text-primary mt-2">
                                    {p.type === 'coins' ? <Coins className="w-5 h-5" /> : <DollarSign className="w-5 h-5" />}
                                    <span className="text-lg">{p.price}</span>
                                    <span className="text-[10px] text-muted-foreground font-bold uppercase">{p.type === 'coins' ? 'Coins' : 'USD'}</span>
                                </div>
                            </div>

                            <button 
                                disabled={purchasedItems[p.id]}
                                onClick={(e) => handleBuy(p.id, e)}
                                className={`w-full py-3 rounded-xl font-black text-sm transition-all ${purchasedItems[p.id] ? 'bg-secondary text-muted-foreground' : 'bg-primary text-primary-foreground hover:bg-primary/90'}`}
                            >
                                {purchasedItems[p.id] ? 'Purchased' : 'Buy Now'}
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
      </motion.div>
    </div>
  );
}
