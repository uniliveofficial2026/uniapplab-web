import React, { useState, useEffect } from 'react';
import { useDB } from '../../lib/useDB';
import { 
  DollarSign, 
  TrendingUp, 
  TrendingDown, 
  ArrowUpRight, 
  ArrowDownLeft, 
  TrendingUp as TrendUpIcon, 
  TrendingDown as TrendDownIcon,
  RefreshCw,
  Wallet
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
import { rechartsTooltipProps, useRechartsTheme } from '../../lib/useRechartsTheme';

interface CryptoTabProps {
  cryptoPrices: { BTC: number; ETH: number; SOL: number };
  onPricesChange: (newPrices: { BTC: number; ETH: number; SOL: number }) => void;
}

export function CryptoTab({ cryptoPrices, onPricesChange }: CryptoTabProps) {
  const db = useDB();
  const chartTheme = useRechartsTheme();

  // Load balances
  const cashBalance = db.load('cash_balance', 180.50);
  const cryptoPortfolio = db.load('crypto_portfolio', { BTC: 0.0045, ETH: 0.082, SOL: 1.5 });

  // TABS & ACTIVE TICKERS
  const [selectedAsset, setSelectedAsset] = useState<'BTC' | 'ETH' | 'SOL'>('BTC');
  const [tradeAction, setTradeAction] = useState<'buy' | 'sell'>('buy');
  const [tradeAmount, setTradeAmount] = useState<string>(''); // in USD
  const [successInfo, setSuccessInfo] = useState<string | null>(null);

  // Generate historical data specifically for chart
  const getHistoricalChartData = (asset: 'BTC' | 'ETH' | 'SOL') => {
    const basePrice = cryptoPrices[asset];
    return [
      { name: '10:00', value: basePrice * 0.98 },
      { name: '11:00', value: basePrice * 1.01 },
      { name: '12:00', value: basePrice * 0.995 },
      { name: '13:00', value: basePrice * 1.02 },
      { name: '14:00', value: basePrice * 1.008 },
      { name: '15:00', value: basePrice * 1.03 },
      { name: '16:00', value: basePrice },
    ];
  };

  const handleExecuteTrade = (e: React.FormEvent) => {
    e.preventDefault();
    const usdAmount = parseFloat(tradeAmount);
    if (!usdAmount || usdAmount <= 0) return;

    const price = cryptoPrices[selectedAsset];
    const assetQuantity = usdAmount / price;

    if (tradeAction === 'buy') {
      if (cashBalance < usdAmount) {
        alert('Insufficient cash USD balance to buy crypto.');
        return;
      }
      
      // Update portfolio
      const nextPortfolio = { ...cryptoPortfolio };
      nextPortfolio[selectedAsset] = parseFloat((nextPortfolio[selectedAsset] + assetQuantity).toFixed(6));
      db.save('crypto_portfolio', nextPortfolio);

      // Deduct cash
      db.save('cash_balance', cashBalance - usdAmount);

      // Save Transaction
      const currentTrans = db.load('wallet_transactions', []);
      db.save('wallet_transactions', [{
        id: `t_${Date.now()}`,
        type: `Bought ${selectedAsset}`,
        amount: `+${assetQuantity.toFixed(5)} ${selectedAsset}`,
        status: 'Completed',
        date: new Date().toISOString().replace('T', ' ').substring(0, 16),
        cost: `-$${usdAmount.toFixed(2)} USD`
      }, ...currentTrans]);

      setSuccessInfo(`Successfully bought ${assetQuantity.toFixed(5)} ${selectedAsset} utilizing $${usdAmount.toFixed(2)} USD!`);
      setTradeAmount('');
      setTimeout(() => setSuccessInfo(null), 4000);

    } else {
      // Selling
      const owningQty = cryptoPortfolio[selectedAsset];
      if (owningQty < assetQuantity) {
        alert(`Insufficient ${selectedAsset} holdings. You only have ${owningQty} ${selectedAsset}.`);
        return;
      }

      // Update portfolio
      const nextPortfolio = { ...cryptoPortfolio };
      nextPortfolio[selectedAsset] = parseFloat((nextPortfolio[selectedAsset] - assetQuantity).toFixed(6));
      db.save('crypto_portfolio', nextPortfolio);

      // Add cash
      db.save('cash_balance', cashBalance + usdAmount);

      // Save Transaction
      const currentTrans = db.load('wallet_transactions', []);
      db.save('wallet_transactions', [{
        id: `t_${Date.now()}`,
        type: `Sold ${selectedAsset}`,
        amount: `-$${usdAmount.toFixed(2)} USD`,
        status: 'Completed',
        date: new Date().toISOString().replace('T', ' ').substring(0, 16),
        cost: `+${assetQuantity.toFixed(5)} ${selectedAsset}`
      }, ...currentTrans]);

      setSuccessInfo(`Successfully liquidated ${assetQuantity.toFixed(5)} ${selectedAsset} to your Cash wallet for $${usdAmount.toFixed(2)} USD!`);
      setTradeAmount('');
      setTimeout(() => setSuccessInfo(null), 4000);
    }
  };

  const assetDetails = {
    BTC: { name: 'Bitcoin', color: '#f97316', desc: 'Secure blockchain digital gold reserve' },
    ETH: { name: 'Ethereum', color: '#3b82f6', desc: 'Smart contracts ecosystem gas layer' },
    SOL: { name: 'Solana', color: '#a855f7', desc: 'Enterprise high throughput transaction hub' },
  }[selectedAsset];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 text-left animate-in fade-in duration-300">
      
      {/* LEFT & CENTER columns: Tickers & Interactive Charts */}
      <div className="lg:col-span-2 space-y-6">
        
        {/* Market Highlights Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-xl font-black text-foreground">Brokerage Cryptographic Desk</h3>
            <p className="text-xs text-muted-foreground font-semibold mt-1">Interrogating live liquidity nodes. Convert USD cash balances into blockchain tokens immediately with zero delay.</p>
          </div>
          <button 
            onClick={() => {
              // Simulate price fluctuation
              const randomChange = (val: number) => {
                const percent = (Math.random() - 0.5) * 0.03; // +/- 1.5%
                return parseFloat((val * (1 + percent)).toFixed(2));
              };
              onPricesChange({
                BTC: randomChange(cryptoPrices.BTC),
                ETH: randomChange(cryptoPrices.ETH),
                SOL: randomChange(cryptoPrices.SOL),
              });
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-secondary hover:bg-secondary/80 border border-border rounded-xl text-[10px] font-black tracking-wider text-muted-foreground transition-all"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Re-poll Markets
          </button>
        </div>

        {/* Assets Ticker selector cards */}
        <div className="grid grid-cols-3 gap-3">
          {(['BTC', 'ETH', 'SOL'] as const).map(ticker => {
            const isSelected = selectedAsset === ticker;
            const price = cryptoPrices[ticker];
            
            return (
              <div
                key={ticker}
                onClick={() => setSelectedAsset(ticker)}
                className={`p-4 border rounded-2xl cursor-pointer transition-all flex flex-col justify-between h-28 ${
                  isSelected 
                    ? 'border-indigo-500 bg-indigo-500/[0.04]' 
                    : 'border-border bg-card hover:bg-secondary/15'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="font-extrabold text-xs text-foreground">{ticker}</span>
                  </div>
                  <span className="text-[9px] font-bold bg-emerald-500/10 text-emerald-500 px-1 py-0.5 rounded flex items-center gap-0.5 whitespace-nowrap">
                    +1.4%
                  </span>
                </div>
                <div className="mt-2 text-xs font-black text-foreground truncate" id={`price-ticker-${ticker}`}>
                  ${price.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </div>
                <div className="text-[9px] text-muted-foreground font-semibold truncate">
                  Holding: {cryptoPortfolio[ticker]} {ticker}
                </div>
              </div>
            );
          })}
        </div>

        {/* Real-time Recharts Market Chart card */}
        <div className="bg-card border border-border rounded-[32px] p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-border/60 pb-3">
            <div className="flex items-center gap-3">
              <div 
                className="w-1.5 h-6 rounded-full" 
                style={{ backgroundColor: assetDetails.color }} 
              />
              <div>
                <h4 className="text-sm font-black text-foreground">{assetDetails.name} Trend (Live Feed)</h4>
                <p className="text-[10px] text-muted-foreground font-semibold mt-0.5">{assetDetails.desc}</p>
              </div>
            </div>
            <div className="text-right">
              <h4 className="text-sm font-black text-foreground">${cryptoPrices[selectedAsset].toLocaleString('en-US', { minimumFractionDigits: 2 })}</h4>
              <p className="text-[10px] text-emerald-400 font-bold">● Synchronized on-ticker</p>
            </div>
          </div>

          <div className="h-44 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={getHistoricalChartData(selectedAsset)} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                <defs>
                  <linearGradient id={`cryptoGrad-${selectedAsset}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={assetDetails.color} stopOpacity={0.35} />
                    <stop offset="95%" stopColor={assetDetails.color} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} />
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: chartTheme.tick, fontSize: 10, fontWeight: 600 }}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: chartTheme.tick, fontSize: 10, fontWeight: 600 }}
                  domain={['auto', 'auto']}
                />
                <Tooltip {...rechartsTooltipProps(chartTheme)} />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke={assetDetails.color}
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill={`url(#cryptoGrad-${selectedAsset})`}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>

      {/* RIGHT COLUMN: Order ticket / Order book */}
      <div className="space-y-6">
        <div>
          <h3 className="text-xl font-black text-foreground">Order Ticket</h3>
          <p className="text-xs text-muted-foreground font-semibold mt-1">Configure buying and selling metrics. Instant execution over commercial network nodes.</p>
        </div>

        <form onSubmit={handleExecuteTrade} className="bg-card border border-border rounded-[32px] p-6 space-y-5 shadow-sm">
          
          {/* Action toggle */}
          <div className="flex gap-2.5 bg-secondary/40 p-1 rounded-xl border border-border">
            <button
              type="button"
              onClick={() => { setTradeAction('buy'); setTradeAmount(''); }}
              className={`flex-1 py-1.5 text-xs font-black rounded-lg transition-all ${
                tradeAction === 'buy'
                  ? 'bg-emerald-500 text-white shadow-sm font-black'
                  : 'text-muted-foreground hover:bg-secondary/60'
              }`}
            >
              Buy {selectedAsset}
            </button>
            <button
              type="button"
              onClick={() => { setTradeAction('sell'); setTradeAmount(''); }}
              className={`flex-1 py-1.5 text-xs font-black rounded-lg transition-all ${
                tradeAction === 'sell'
                  ? 'bg-red-500 text-white shadow-sm font-black'
                  : 'text-muted-foreground hover:bg-secondary/60'
              }`}
            >
              Sell {selectedAsset}
            </button>
          </div>

          <div className="space-y-4">
            
            {/* Cash Input wrapper */}
            <div className="p-4 bg-secondary/20 border border-border rounded-2xl">
              <label className="text-[10px] uppercase font-black text-muted-foreground block mb-1">
                Amount (US Dollars)
              </label>
              <div className="flex items-center justify-between gap-2 overflow-hidden w-full">
                <div className="flex items-center flex-1 min-w-0">
                  <span className="text-xl font-black text-foreground mr-1">$</span>
                  <input
                    type="number"
                    value={tradeAmount}
                    onChange={e => setTradeAmount(e.target.value)}
                    placeholder="0.00"
                    step="0.01"
                    className="bg-transparent border-0 text-xl font-black text-foreground focus:ring-0 focus:outline-none p-0 w-full min-w-0"
                  />
                </div>
                
                <button
                  type="button"
                  onClick={() => {
                    if (tradeAction === 'buy') {
                      setTradeAmount(cashBalance.toFixed(2));
                    } else {
                      const value = cryptoPortfolio[selectedAsset] * cryptoPrices[selectedAsset];
                      setTradeAmount(value.toFixed(2));
                    }
                  }}
                  className="px-2.5 py-1 bg-secondary hover:bg-secondary/80 border border-border rounded-lg text-[10px] font-black text-primary transition-all shrink-0"
                >
                  Use Max
                </button>
              </div>
            </div>

            {/* Estimated asset returns */}
            <div className="flex items-center justify-between text-xs font-bold text-muted-foreground font-mono">
              <span>Estimated Quantity</span>
              <span className="text-foreground font-black">
                {tradeAction === 'buy' ? '+' : '-'}
                {((parseFloat(tradeAmount) || 0) / cryptoPrices[selectedAsset]).toFixed(6)} {selectedAsset}
              </span>
            </div>

            {/* Hold index */}
            <div className="p-3.5 bg-secondary/40 border border-dashed border-border rounded-2xl flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Wallet className="w-4 h-4 text-primary" />
                <span className="text-[11px] font-extrabold text-foreground">Available balance</span>
              </div>
              <span className="text-xs font-black text-foreground">
                {tradeAction === 'buy' 
                  ? `$${cashBalance.toFixed(2)} USD` 
                  : `${cryptoPortfolio[selectedAsset]} ${selectedAsset}`
                }
              </span>
            </div>

          </div>

          <button
            type="submit"
            disabled={!tradeAmount || parseFloat(tradeAmount) <= 0}
            className={`w-full py-4 text-sm font-black rounded-2xl whitespace-nowrap active:scale-[0.99] transition-all shadow-md disabled:opacity-50 ${
              tradeAction === 'buy' 
                ? 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-emerald-500/15'
                : 'bg-red-500 hover:bg-red-600 text-white shadow-red-500/15'
            }`}
          >
            Confirm {tradeAction === 'buy' ? 'Buy' : 'Sell'} Execution
          </button>

          {successInfo && (
            <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl text-xs font-bold text-emerald-500 text-center animate-in face-in duration-300">
              {successInfo}
            </div>
          )}

        </form>
      </div>

    </div>
  );
}
