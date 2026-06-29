import React, { useState } from 'react';
import { 
  Wallet, 
  LayoutDashboard, 
  Coins, 
  DollarSign, 
  TrendingUp, 
  Gamepad2, 
  ShoppingBag 
} from 'lucide-react';
import { OverviewTab } from './OverviewTab';
import { BuyExchangeTab } from './BuyExchangeTab';
import { WithdrawTab } from './WithdrawTab';
import { CryptoTab } from './CryptoTab';
import { GameCoinTab } from './GameCoinTab';
import { ShopTab } from './ShopTab';
import { useDB } from '../../lib/useDB';

type WalletTab = 'overview' | 'buy_exchange' | 'withdraw' | 'crypto' | 'game' | 'shop';

export function WalletScreen() {
  const db = useDB();
  const [activeTab, setActiveTab] = useState<WalletTab>('overview');

  // Unified global simulated crypto price state passed down to ensure coordination
  const [cryptoPrices, setCryptoPrices] = useState({
    BTC: 64250.00,
    ETH: 3410.00,
    SOL: 154.50
  });

  const handleUpdatePrices = (newPrices: typeof cryptoPrices) => {
    setCryptoPrices(newPrices);
  };

  const currentTabStyles = (tab: WalletTab) => 
    `flex items-center gap-2 p-2.5 px-4 rounded-xl font-bold text-xs transition-all border ${
      activeTab === tab 
        ? 'bg-primary text-primary-foreground border-primary shadow-sm shadow-primary/20' 
        : 'hover:bg-secondary text-muted-foreground border-transparent bg-transparent'
    }`;

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto space-y-6 flex flex-col overflow-x-hidden w-full min-w-0">
      
      {/* 1. Universal Top Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/80 pb-5">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-primary/10 rounded-2xl text-primary">
            <Wallet className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-black text-foreground tracking-tight">Venture Finance Wallet</h2>
            <p className="text-[11px] text-muted-foreground font-semibold mt-0.5">Unified ledger for coins, cashout clearing, crypto indices & game store assets</p>
          </div>
        </div>

        {/* Global verified account stats */}
        <div className="flex flex-wrap sm:flex-nowrap items-center gap-4 bg-secondary/35 p-3 sm:p-2 sm:px-3 border border-border/70 rounded-2xl select-none font-semibold w-full sm:w-auto overflow-hidden">
          <div className="text-left sm:text-right flex-1 sm:flex-none">
            <p className="text-[9px] uppercase tracking-wider text-muted-foreground font-bold">Trading License</p>
            <p className="text-[10px] text-emerald-400 font-extrabold flex items-center justify-start sm:justify-end gap-1">● VERIFIED</p>
          </div>
          <div className="h-px w-full sm:h-6 sm:w-px bg-border/80" />
          <div className="text-left sm:text-right flex-1 sm:flex-none">
            <p className="text-[9px] uppercase tracking-wider text-muted-foreground font-bold">Node Address</p>
            <p className="text-[10px] font-mono font-bold text-foreground">0x91a...e4d9</p>
          </div>
        </div>
      </div>

      {/* 2. Primary Layout: If on overview show dashboard, else show back button and child tab */}
      {activeTab !== 'overview' && (
        <button 
          onClick={() => setActiveTab('overview')}
          className="flex items-center gap-2 text-xs font-bold text-muted-foreground hover:text-foreground transition-colors self-start mb-2 px-1"
        >
          ← Back to Dashboard
        </button>
      )}

      {/* 3. Render matched panel route */}
      <div className="flex-1 min-h-[350px]">
        {activeTab === 'overview' && (
          <OverviewTab cryptoPrices={cryptoPrices} onNavigate={(tab) => setActiveTab(tab as WalletTab)} />
        )}
        {activeTab === 'buy_exchange' && (
          <BuyExchangeTab />
        )}
        {activeTab === 'withdraw' && (
          <WithdrawTab />
        )}
        {activeTab === 'crypto' && (
          <CryptoTab cryptoPrices={cryptoPrices} onPricesChange={handleUpdatePrices} />
        )}
        {activeTab === 'game' && (
          <GameCoinTab />
        )}
        {activeTab === 'shop' && (
          <ShopTab />
        )}
      </div>

    </div>
  );
}
export default WalletScreen;
