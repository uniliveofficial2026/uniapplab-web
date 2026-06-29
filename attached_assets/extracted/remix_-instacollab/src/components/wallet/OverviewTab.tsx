import React, { useState } from 'react';
import { useDB } from '../../lib/useDB';
import { 
  Coins, 
  DollarSign, 
  TrendingUp, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Clock, 
  RefreshCw, 
  Globe, 
  ChevronRight,
  TrendingDown,
  Filter
} from 'lucide-react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';

interface OverviewTabProps {
  cryptoPrices: { BTC: number; ETH: number; SOL: number };
  onNavigate?: (tab: string) => void;
}

export function OverviewTab({ cryptoPrices, onNavigate }: OverviewTabProps) {
  const db = useDB();
  const [isLoading, setIsLoading] = React.useState(true);
  
  React.useEffect(() => {
    // Simulate network fetch for wallet data
    const timer = setTimeout(() => setIsLoading(false), 1200);
    return () => clearTimeout(timer);
  }, []);
  
  // High fidelity default states
  const coinsBalance = db.load('coins_balance', 4200);
  const cashBalance = db.load('cash_balance', 180.50);
  const cryptoPortfolio = db.load('crypto_portfolio', { BTC: 0.0045, ETH: 0.082, SOL: 1.5 });
  const transactions = db.load('wallet_transactions', [
    { id: 't1', type: 'Coins Bought', amount: '+1000 Coins', status: 'Completed', date: '2026-06-02 14:22', cost: '$9.99 USD' },
    { id: 't2', type: 'MLBB Redeemed', amount: '-180 MLBB Diamonds', status: 'Completed', date: '2026-06-01 19:45', cost: '270 Coins' },
    { id: 't3', type: 'Crypto Profit', amount: '+0.2 SOL', status: 'Completed', date: '2026-05-30 08:12', cost: '$31.40 USD' },
    { id: 't4', type: 'Payout Transferred', amount: '-$50.00 USD', status: 'Completed', date: '2026-05-28 11:30', cost: 'Bank Endorsement' },
  ]);

  const [activeRange, setActiveRange] = useState<'7D' | '1M' | '1Y'>('1M');
  const [logFilter, setLogFilter] = useState<'All' | 'Productive' | 'Redeem/Exchange' | 'Cashflows'>('All');

  // Dynamic portfolio calculations based on simulated crypto prices
  const btcValue = cryptoPortfolio.BTC * cryptoPrices.BTC;
  const ethValue = cryptoPortfolio.ETH * cryptoPrices.ETH;
  const solValue = cryptoPortfolio.SOL * cryptoPrices.SOL;
  const totalCryptoValue = btcValue + ethValue + solValue;

  const totalAssetsUSD = cashBalance + (coinsBalance * 0.01) + totalCryptoValue;

  // Chart data simulated based on range
  const chartData = {
    '7D': [
      { name: 'Mon', value: totalAssetsUSD - 42 },
      { name: 'Tue', value: totalAssetsUSD - 25 },
      { name: 'Wed', value: totalAssetsUSD - 15 },
      { name: 'Thu', value: totalAssetsUSD - 30 },
      { name: 'Fri', value: totalAssetsUSD - 8 },
      { name: 'Sat', value: totalAssetsUSD + 12 },
      { name: 'Sun', value: totalAssetsUSD },
    ],
    '1M': [
      { name: 'Week 1', value: totalAssetsUSD - 120 },
      { name: 'Week 2', value: totalAssetsUSD - 85 },
      { name: 'Week 3', value: totalAssetsUSD - 18 },
      { name: 'Week 4', value: totalAssetsUSD },
    ],
    '1Y': [
      { name: 'Jan', value: totalAssetsUSD * 0.72 },
      { name: 'Mar', value: totalAssetsUSD * 0.81 },
      { name: 'May', value: totalAssetsUSD * 0.89 },
      { name: 'Jul', value: totalAssetsUSD * 0.95 },
      { name: 'Sep', value: totalAssetsUSD * 1.05 },
      { name: 'Nov', value: totalAssetsUSD * 1.12 },
      { name: 'Dec', value: totalAssetsUSD },
    ]
  }[activeRange];

  const filteredTrans = transactions.filter((t: any) => {
    if (logFilter === 'All') return true;
    if (logFilter === 'Productive') return t.type === 'Product Sold' || t.type === 'Coins Bought';
    if (logFilter === 'Redeem/Exchange') return t.type.includes('Redeemed') || t.type.includes('Exchanged');
    if (logFilter === 'Cashflows') return t.type.includes('Bought') || t.type.includes('Transferred') || t.type.includes('Withdrawn');
    return true;
  });

  if (isLoading) {
    return (
      <div className="space-y-6 text-left animate-in fade-in duration-300">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-card border border-border rounded-[28px] p-6 h-[160px] animate-pulse flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <div className="h-3 bg-secondary rounded w-24"></div>
                <div className="h-6 w-6 bg-secondary rounded-full"></div>
              </div>
              <div>
                <div className="h-8 bg-secondary rounded w-32 mb-2"></div>
                <div className="h-2 bg-secondary rounded w-48"></div>
              </div>
              <div className="pt-3 border-t border-border flex justify-between">
                <div className="h-2 bg-secondary rounded w-20"></div>
                <div className="h-2 bg-secondary rounded w-12"></div>
              </div>
            </div>
          ))}
        </div>
        
        <div className="bg-card border border-border rounded-[32px] p-5 shadow-sm space-y-4 animate-pulse">
          <div className="h-5 bg-secondary rounded w-48 mb-2"></div>
          <div className="h-3 bg-secondary rounded w-64 mb-4"></div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="flex flex-col items-center justify-center p-4 bg-secondary/15 rounded-2xl h-[120px]">
                <div className="w-12 h-12 rounded-full bg-secondary mb-3"></div>
                <div className="h-3 bg-secondary rounded w-20"></div>
              </div>
            ))}
          </div>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-card border border-border rounded-[32px] p-5 shadow-sm h-[320px] animate-pulse flex flex-col">
            <div className="flex justify-between mb-4">
               <div>
                 <div className="h-4 bg-secondary rounded w-40 mb-2"></div>
                 <div className="h-2 bg-secondary rounded w-56"></div>
               </div>
               <div className="h-6 bg-secondary rounded w-24"></div>
            </div>
            <div className="flex-1 bg-secondary/20 rounded-xl mt-4"></div>
          </div>
          <div className="bg-card border border-border rounded-[32px] p-5 shadow-sm animate-pulse space-y-4">
             <div className="h-4 bg-secondary rounded w-40 mb-4"></div>
             {[1, 2, 3, 4, 5].map(i => (
               <div key={i} className="h-14 bg-secondary/20 rounded-2xl"></div>
             ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 text-left animate-in fade-in duration-300">
      
      {/* Dynamic Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Total Assets Card */}
        <div className="relative overflow-hidden bg-gradient-to-br from-indigo-950 via-slate-900 to-indigo-950 border border-indigo-500/20 rounded-[28px] p-6 shadow-xl shadow-indigo-950/10">
          <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-3xl" />
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-bold text-indigo-200/70 uppercase tracking-widest">Total Net Worth</span>
            <span className="flex items-center gap-1 text-emerald-400 text-xs font-black bg-emerald-500/10 px-2 py-0.5 rounded-full">
              <TrendingUp className="w-3 h-3" /> +14.2%
            </span>
          </div>
          <h3 className="text-3xl font-black text-white tracking-tight" id="balance-total-value">
            ${totalAssetsUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </h3>
          <p className="text-[11px] text-indigo-200/50 mt-1 font-semibold">Combined Cash, Coins & Crypto Valuation</p>
          <div className="mt-4 pt-3 border-t border-indigo-500/15 flex items-center justify-between text-xs font-bold text-indigo-300">
            <span>Unified Brokerage API</span>
            <span className="bg-indigo-500/20 text-indigo-200 text-[9px] font-black px-1.5 py-0.5 rounded uppercase">Connected</span>
          </div>
        </div>

        {/* Live Coins Balance */}
        <div className="relative overflow-hidden bg-gradient-to-br from-amber-950 via-slate-900 to-amber-950 border border-amber-500/20 rounded-[28px] p-6 shadow-xl shadow-amber-950/10">
          <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 rounded-full blur-3xl" />
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-bold text-amber-200/70 uppercase tracking-widest">Streaming Coins</span>
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400">
              <Coins className="w-4 h-4" />
            </div>
          </div>
          <h3 className="text-3xl font-black text-white tracking-tight" id="balance-coins">
            {coinsBalance.toLocaleString()} <span className="text-xs text-amber-400 font-bold">COINS</span>
          </h3>
          <p className="text-[11px] text-amber-200/50 mt-1 font-semibold">Estimated Liquidity: ${(coinsBalance * 0.01).toFixed(2)} USD</p>
          <div className="mt-4 pt-3 border-t border-amber-500/15 flex items-center justify-between text-xs font-bold text-amber-300">
            <span>Purchased & Gifted Pool</span>
            <span className="text-emerald-400 font-black">Ready</span>
          </div>
        </div>

        {/* Cash Balance */}
        <div className="relative overflow-hidden bg-gradient-to-br from-emerald-950 via-slate-900 to-emerald-950 border border-emerald-500/20 rounded-[28px] p-6 shadow-xl shadow-emerald-950/10">
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl" />
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-bold text-emerald-200/70 uppercase tracking-widest">Cash Balance</span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <h3 className="text-3xl font-black text-white tracking-tight" id="balance-cash">
            ${cashBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className="text-xs text-emerald-400 font-bold">USD</span>
          </h3>
          <p className="text-[11px] text-emerald-200/50 mt-1 font-semibold">Available for direct withdrawal</p>
          <div className="mt-4 pt-3 border-t border-emerald-500/15 flex items-center justify-between text-xs font-bold text-emerald-300">
            <span>Seller Proceeds Pool</span>
            <span className="text-emerald-400 font-black">Cleared</span>
          </div>
        </div>
      </div>

      {/* Quick Redemption Actions */}
      <div className="bg-card border border-border rounded-[32px] p-5 shadow-sm space-y-4">
        <div>
          <h3 className="text-base font-black text-foreground">Redemption & Quick Actions</h3>
          <p className="text-xs text-muted-foreground font-semibold">Instantly convert between assets, withdraw, or redeem game tokens</p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <button 
            onClick={() => onNavigate && onNavigate('game')}
            className="flex flex-col items-center justify-center p-4 bg-secondary/15 hover:bg-secondary/40 border border-border/50 rounded-2xl transition-all group"
          >
            <div className="w-12 h-12 rounded-full bg-amber-500/10 text-amber-500 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
              <Coins className="w-6 h-6" />
            </div>
            <span className="text-xs font-black text-foreground">Redeem Games</span>
          </button>
          
          <button 
            onClick={() => onNavigate && onNavigate('buy_exchange')}
            className="flex flex-col items-center justify-center p-4 bg-secondary/15 hover:bg-secondary/40 border border-border/50 rounded-2xl transition-all group"
          >
            <div className="w-12 h-12 rounded-full bg-indigo-500/10 text-indigo-500 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
              <RefreshCw className="w-6 h-6" />
            </div>
            <span className="text-xs font-black text-foreground">Swap Assets</span>
          </button>
          
          <button 
            onClick={() => onNavigate && onNavigate('crypto')}
            className="flex flex-col items-center justify-center p-4 bg-secondary/15 hover:bg-secondary/40 border border-border/50 rounded-2xl transition-all group"
          >
            <div className="w-12 h-12 rounded-full bg-blue-500/10 text-blue-500 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
              <TrendingUp className="w-6 h-6" />
            </div>
            <span className="text-xs font-black text-foreground">Trade Crypto</span>
          </button>
          
          <button 
            onClick={() => onNavigate && onNavigate('withdraw')}
            className="flex flex-col items-center justify-center p-4 bg-secondary/15 hover:bg-secondary/40 border border-border/50 rounded-2xl transition-all group"
          >
            <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
              <DollarSign className="w-6 h-6" />
            </div>
            <span className="text-xs font-black text-foreground">Cash Withdraw</span>
          </button>
        </div>
      </div>

      {/* Main Grid: Chart & Crypto/Gaming Assets Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 w-full min-w-0">
        
        {/* Growth Trend AreaChart */}
        <div className="lg:col-span-2 bg-card border border-border rounded-[32px] p-5 shadow-sm flex flex-col justify-between min-w-0 w-full overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-3 w-full min-w-0">
            <div className="min-w-0 flex-1">
              <h3 className="text-base font-black text-foreground truncate">Asset Value Timeline</h3>
              <p className="text-xs text-muted-foreground font-semibold truncate">Historic net worth analysis based on active pricing</p>
            </div>
            <div className="flex gap-1.5 bg-secondary/40 p-1 rounded-xl border border-border overflow-x-auto no-scrollbar shrink-0">
              {(['7D', '1M', '1Y'] as const).map(range => (
                <button
                  key={range}
                  onClick={() => setActiveRange(range)}
                  className={`px-3 py-1 text-[10px] font-black rounded-lg transition-all ${
                    activeRange === range 
                      ? 'bg-primary text-primary-foreground shadow-sm' 
                      : 'text-muted-foreground hover:bg-secondary/60'
                  }`}
                >
                  {range}
                </button>
              ))}
            </div>
          </div>

          <div className="h-44 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                <defs>
                  <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.25}/>
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsla(var(--border) / 0.1)" />
                <XAxis dataKey="name" stroke="hsla(var(--border) / 0.6)" fontSize={10} fontWeight="600" />
                <YAxis stroke="hsla(var(--border) / 0.6)" fontSize={10} fontWeight="600" />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'rgb(var(--card))', 
                    borderRadius: '16px', 
                    border: '1px solid rgb(var(--border))',
                    fontSize: '11px',
                    fontWeight: 'bold'
                  }} 
                />
                <Area type="monotone" dataKey="value" stroke="#6366f1" strokeWidth={2.5} fillOpacity={1} fill="url(#colorValue)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Assets List Breakdown */}
        <div className="bg-card border border-border rounded-[32px] p-5 shadow-sm space-y-4">
          <h3 className="text-base font-black text-foreground">Asset Valuation Matrix</h3>
          
          <div className="space-y-2.5">
            {/* Cash asset */}
            <div className="p-3 bg-secondary/15 rounded-2xl flex flex-wrap sm:flex-nowrap items-center justify-between border border-border/[0.2] gap-2">
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                <div className="p-2 bg-emerald-500/10 text-emerald-500 rounded-xl shrink-0">
                  <DollarSign className="w-4 h-4" />
                </div>
                <div className="min-w-0 pr-2">
                  <h4 className="text-xs font-black text-foreground truncate">US Dollars</h4>
                  <p className="text-[10px] text-muted-foreground font-semibold truncate">Liquid fiat funds</p>
                </div>
              </div>
              <div className="text-left sm:text-right shrink-0">
                <p className="text-xs font-black text-foreground">${cashBalance.toFixed(2)}</p>
                <p className="text-[9px] text-emerald-500 font-bold">100% Reserve</p>
              </div>
            </div>

            {/* Coins Asset */}
            <div className="p-3 bg-secondary/15 rounded-2xl flex flex-wrap sm:flex-nowrap items-center justify-between border border-border/[0.2] gap-2">
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                <div className="p-2 bg-amber-500/10 text-amber-500 rounded-xl shrink-0">
                  <Coins className="w-4 h-4" />
                </div>
                <div className="min-w-0 pr-2">
                  <h4 className="text-xs font-black text-foreground truncate">Live Streaming Coins</h4>
                  <p className="text-[10px] text-muted-foreground font-semibold truncate">In-app tokens</p>
                </div>
              </div>
              <div className="text-left sm:text-right shrink-0">
                <p className="text-xs font-black text-foreground">{coinsBalance} Gold</p>
                <p className="text-[9px] text-amber-500 font-bold">${(coinsBalance * 0.01).toFixed(2)} USD</p>
              </div>
            </div>

            {/* Crypto BTC */}
            <div className="p-3 bg-secondary/15 rounded-2xl flex flex-wrap sm:flex-nowrap items-center justify-between border border-border/[0.2] gap-2">
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                <div className="p-2 bg-orange-500/10 text-orange-500 rounded-xl font-bold text-xs w-8 h-8 flex items-center justify-center shrink-0">
                  B
                </div>
                <div className="min-w-0 pr-2">
                  <h4 className="text-xs font-black text-foreground truncate">Bitcoin (BTC)</h4>
                  <p className="text-[10px] text-muted-foreground font-semibold truncate">Crypto asset holdings</p>
                </div>
              </div>
              <div className="text-left sm:text-right shrink-0">
                <p className="text-xs font-black text-foreground">{cryptoPortfolio.BTC} BTC</p>
                <p className="text-[9px] text-orange-500 font-bold">${btcValue.toLocaleString('en-US', { maximumFractionDigits: 2 })} USD</p>
              </div>
            </div>

            {/* Crypto ETH */}
            <div className="p-3 bg-secondary/15 rounded-2xl flex flex-wrap sm:flex-nowrap items-center justify-between border border-border/[0.2] gap-2">
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                <div className="p-2 bg-blue-500/10 text-blue-500 rounded-xl font-bold text-xs w-8 h-8 flex items-center justify-center shrink-0">
                  E
                </div>
                <div className="min-w-0 pr-2">
                  <h4 className="text-xs font-black text-foreground truncate">Ethereum (ETH)</h4>
                  <p className="text-[10px] text-muted-foreground font-semibold truncate">Web3 utility index</p>
                </div>
              </div>
              <div className="text-left sm:text-right shrink-0">
                <p className="text-xs font-black text-foreground">{cryptoPortfolio.ETH} ETH</p>
                <p className="text-[9px] text-blue-500 font-bold">${ethValue.toLocaleString('en-US', { maximumFractionDigits: 2 })} USD</p>
              </div>
            </div>

            {/* Crypto SOL */}
            <div className="p-3 bg-secondary/15 rounded-2xl flex flex-wrap sm:flex-nowrap items-center justify-between border border-border/[0.2] gap-2">
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                <div className="p-2 bg-purple-500/10 text-purple-500 rounded-xl font-bold text-xs w-8 h-8 flex items-center justify-center shrink-0">
                  S
                </div>
                <div className="min-w-0 pr-2">
                  <h4 className="text-xs font-black text-foreground truncate">Solana (SOL)</h4>
                  <p className="text-[10px] text-muted-foreground font-semibold truncate">DeFi liquidity token</p>
                </div>
              </div>
              <div className="text-left sm:text-right shrink-0">
                <p className="text-xs font-black text-foreground">{cryptoPortfolio.SOL} SOL</p>
                <p className="text-[9px] text-purple-500 font-bold">${solValue.toLocaleString('en-US', { maximumFractionDigits: 2 })} USD</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Transactions Feed */}
      <div className="bg-card border border-border rounded-[32px] p-5 shadow-sm space-y-4 w-full min-w-0">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 w-full min-w-0">
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-black text-foreground truncate">Activity Ledger & Accounting</h3>
            <p className="text-xs text-muted-foreground font-semibold truncate">Verified cryptographic record of incoming and outgoing flows</p>
          </div>
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 w-full sm:w-auto shrink-0">
            <Filter className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            {(['All', 'Productive', 'Redeem/Exchange', 'Cashflows'] as const).map(f => (
              <button
                key={f}
                onClick={() => setLogFilter(f)}
                className={`px-3 py-1 text-[10px] font-black rounded-lg transition-all whitespace-nowrap ${
                  logFilter === f 
                    ? 'bg-secondary text-foreground' 
                    : 'text-muted-foreground hover:bg-secondary/30'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border/80">
          {filteredTrans.length === 0 ? (
            <div className="p-8 text-center text-xs text-muted-foreground font-semibold bg-secondary/5">
              No matching ledger records for this filter.
            </div>
          ) : (
            filteredTrans.map((t: any) => {
              const isPositive = t.amount.startsWith('+');
              return (
                <div key={t.id} className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4 bg-secondary/5 hover:bg-secondary/15 transition-all w-full min-w-0">
                  <div className="flex items-center gap-3 overflow-hidden w-full sm:w-auto">
                    <div className={`p-2.5 rounded-xl shrink-0 ${
                      isPositive ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'
                    }`}>
                      {isPositive ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownLeft className="w-4 h-4" />}
                    </div>
                    <div className="truncate min-w-0 flex-1">
                      <h4 className="text-xs font-black text-foreground truncate">{t.type}</h4>
                      <p className="text-[10px] text-muted-foreground font-semibold flex items-center gap-1 mt-0.5 truncate">
                        <Clock className="w-3 h-3 shrink-0" /> <span className="truncate">{t.date}</span>
                      </p>
                    </div>
                  </div>
                  <div className="text-left sm:text-right shrink-0 pl-11 sm:pl-0">
                    <p className={`text-xs font-black ${isPositive ? 'text-emerald-500' : 'text-red-500'}`}>
                      {t.amount}
                    </p>
                    <p className="text-[10px] text-muted-foreground font-semibold mt-0.5">
                      {t.cost}
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

    </div>
  );
}
