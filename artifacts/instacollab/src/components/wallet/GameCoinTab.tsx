import React, { useState } from 'react';
import { useDB } from '../../lib/useDB';
import { 
  Gamepad2, 
  Coins, 
  Check, 
  UserSquare2, 
  Loader2,
  X,
  Smartphone,
  Sparkles
} from 'lucide-react';

export function GameCoinTab() {
  const db = useDB();
  const coinsBalance = db.load('coins_balance', 4200);
  const gameCoins = db.load('game_coins', { pubg: 0, roblox: 0, mobile_legends: 0, in_house: 500, slot_game: 0 });

  // Game types & reward pacs
  const GAMES = [
    { 
      id: 'pubg', 
      name: 'PUBG Mobile UC', 
      image: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&q=80&w=200',
      color: '#fbbf24',
      packs: [
        { id: 'pubg_1', amount: 60, name: '60 UC', cost: 100 },
        { id: 'pubg_2', amount: 325, name: '325 UC', cost: 500 },
        { id: 'pubg_3', amount: 660, name: '660 UC', cost: 1000 },
      ]
    },
    { 
      id: 'roblox', 
      name: 'Roblox Robux', 
      image: 'https://images.unsplash.com/photo-1593305841991-05c297ba4575?auto=format&fit=crop&q=80&w=200',
      color: '#ef4444',
      packs: [
        { id: 'robux_1', amount: 80, name: '80 Robux', cost: 100 },
        { id: 'robux_2', amount: 400, name: '400 Robux', cost: 500 },
        { id: 'robux_3', amount: 800, name: '800 Robux', cost: 1000 },
      ]
    },
    { 
      id: 'mobile_legends', 
      name: 'MLBB Diamonds', 
      image: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&q=80&w=200',
      color: '#3b82f6',
      packs: [
        { id: 'ml_1', amount: 50, name: '50 Diamonds', cost: 90 },
        { id: 'ml_2', amount: 250, name: '250 Diamonds', cost: 450 },
        { id: 'ml_3', amount: 565, name: '565 Diamonds', cost: 1000 },
      ]
    },
    { 
      id: 'slot_game', 
      name: 'Slot Game Spins', 
      image: 'https://images.unsplash.com/photo-1596838132711-e8623193e472?auto=format&fit=crop&q=80&w=200',
      color: '#ec4899',
      packs: [
        { id: 'slot_1', amount: 50, name: '50 Spins', cost: 80 },
        { id: 'slot_2', amount: 150, name: '150 Spins', cost: 200 },
        { id: 'slot_3', amount: 500, name: '500 Spins', cost: 600 },
      ]
    },
    { 
      id: 'in_house', 
      name: 'Star Game Gold', 
      image: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&q=80&w=200',
      color: '#10b981',
      packs: [
        { id: 'gold_1', amount: 1000, name: '1k Star Gold', cost: 100 },
        { id: 'gold_2', amount: 5000, name: '5k Star Gold', cost: 500 },
        { id: 'gold_3', amount: 12000, name: '12k Star Gold', cost: 1000 },
      ]
    }
  ];

  const [selectedGame, setSelectedGame] = useState<typeof GAMES[0]>(GAMES[0]);
  const [selectedPack, setSelectedPack] = useState<typeof GAMES[0]['packs'][0] | null>(null);

  // Redemption process state
  const [playerId, setPlayerId] = useState<string>('');
  const [step, setStep] = useState<'input' | 'validating' | 'processing' | 'success'>('input');
  const [validatedName, setValidatedName] = useState<string>('');

  const handleSelectPack = (pack: typeof GAMES[0]['packs'][0]) => {
    setSelectedPack(pack);
    setPlayerId('');
    setStep('input');
  };

  const handleRunValidation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!playerId.trim()) return;

    setStep('validating');
    
    setTimeout(() => {
      // Simulate player lookup name
      const usernames = ['ApexGamer99', 'GhostStriker', 'KawaiiMimi', 'ProNoob_1', 'LeetStreamer'];
      const randomUsername = usernames[Math.floor(Math.random() * usernames.length)] + `#${Math.floor(1000 + Math.random() * 9000)}`;
      setValidatedName(randomUsername);
      setStep('processing');

      // Actually deliver game coin trigger
      setTimeout(() => {
        if (!selectedPack) return;

        // Deduct Coins
        const currentCoins = db.load('coins_balance', 4200);
        db.save('coins_balance', currentCoins - selectedPack.cost);

        // Update Game Coins inventory
        const currentInventory = db.load('game_coins', { pubg: 0, roblox: 0, mobile_legends: 0, in_house: 500 });
        const key = selectedGame.id as keyof typeof currentInventory;
        currentInventory[key] = (currentInventory[key] || 0) + selectedPack.amount;
        db.save('game_coins', currentInventory);

        // Append to general transaction receipts
        const trans = db.load('wallet_transactions', []);
        db.save('wallet_transactions', [{
          id: `t_${Date.now()}`,
          type: `${selectedGame.name} Redeemed`,
          amount: `-${selectedPack.cost} Coins`,
          status: 'Completed',
          date: new Date().toISOString().replace('T', ' ').substring(0, 16),
          cost: `Delivered +${selectedPack.amount} to ID: ${playerId} (${randomUsername})`
        }, ...trans]);

        setStep('success');
      }, 1200);

    }, 1000);
  };

  return (
    <div className="space-y-6 text-left animate-in fade-in duration-300">
      
      {/* Title */}
      <div>
        <h3 className="text-xl font-black text-foreground">Gaming Rewards Redemption Exchange</h3>
        <p className="text-xs text-muted-foreground font-semibold mt-1">Convert streaming gold coin points directly into official premium in-game UC, Robux, and Diamonds.</p>
      </div>

      {/* Game Selector Tab Rail */}
      <div className="flex gap-2.5 overflow-x-auto no-scrollbar pb-2 w-full min-w-0">
        {GAMES.map(game => {
          const isSelected = selectedGame.id === game.id;
          return (
            <button
              key={game.id}
              onClick={() => { setSelectedGame(game); setSelectedPack(null); }}
              className={`px-4 py-2 text-xs font-black rounded-xl border transition-all whitespace-nowrap flex items-center gap-2 ${
                isSelected 
                  ? 'bg-primary text-primary-foreground border-primary shadow-sm' 
                  : 'bg-card border-border text-muted-foreground hover:bg-secondary/40'
              }`}
            >
              <Gamepad2 className="w-4 h-4" /> {game.name}
            </button>
          );
        })}
      </div>

      {/* Grid: Selected Game visual details & Packs selectors */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Current Inventories */}
        <div className="bg-card border border-border rounded-[28px] p-5 space-y-4 shadow-sm flex flex-col justify-between">
          <div>
            <h4 className="text-sm font-black text-foreground mb-3">Your Redeemed Reserves</h4>
            <div className="space-y-2.5">
              <div className="flex items-center justify-between p-2.5 bg-secondary/20 rounded-xl">
                <span className="text-xs text-muted-foreground font-semibold">PUBG Mobile UC</span>
                <span className="text-xs font-black text-foreground">{gameCoins.pubg} UC</span>
              </div>
              <div className="flex items-center justify-between p-2.5 bg-secondary/20 rounded-xl">
                <span className="text-xs text-muted-foreground font-semibold">Roblox Robux</span>
                <span className="text-xs font-black text-foreground">{gameCoins.roblox} R$</span>
              </div>
              <div className="flex items-center justify-between p-2.5 bg-secondary/20 rounded-xl">
                <span className="text-xs text-muted-foreground font-semibold">MLBB Diamonds</span>
                <span className="text-xs font-black text-foreground">{gameCoins.mobile_legends} ♦</span>
              </div>
              <div className="flex items-center justify-between p-2.5 bg-secondary/20 rounded-xl">
                <span className="text-xs text-muted-foreground font-semibold">Slot Game Spins</span>
                <span className="text-xs font-black text-foreground">{gameCoins.slot_game} Spins</span>
              </div>
              <div className="flex items-center justify-between p-2.5 bg-secondary/20 rounded-xl">
                <span className="text-xs text-muted-foreground font-semibold">Star Game Gold</span>
                <span className="text-xs font-black text-foreground">{gameCoins.in_house} Gold</span>
              </div>
            </div>
          </div>

          <div className="p-3 bg-amber-500/5 border border-dashed border-amber-500/25 rounded-xl text-[10px] text-amber-500/90 font-semibold leading-relaxed">
            All redemptions deliver instantly using our direct secure API. Make sure your Player ID is correctly typed!
          </div>
        </div>

        {/* Dynamic packages list */}
        <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-4">
          {selectedGame.packs.map(pack => {
            const isAffordable = coinsBalance >= pack.cost;
            return (
              <div
                key={pack.id}
                onClick={() => { if(isAffordable) handleSelectPack(pack); }}
                className={`p-5 bg-card border rounded-2xl relative flex flex-col justify-between h-44 transition-all ${
                  isAffordable 
                    ? 'cursor-pointer hover:border-primary/45 border-border hover:-translate-y-0.5 shadow-sm hover:bg-secondary/10' 
                    : 'opacity-55 border-border/60 cursor-not-allowed bg-secondary/5'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-extrabold text-muted-foreground uppercase">{selectedGame.name}</span>
                    <Gamepad2 className="w-3.5 h-3.5 text-muted-foreground" />
                  </div>
                  <h4 className="text-xl font-black text-foreground mt-3">{pack.name}</h4>
                </div>

                <div className="border-t border-border pt-3 mt-4 flex items-center justify-between">
                  <span className="text-xs font-black text-amber-500 flex items-center gap-1">
                    <Coins className="w-3.5 h-3.5" /> {pack.cost} Coins
                  </span>
                  {isAffordable ? (
                    <span className="text-[10px] bg-primary/10 text-primary font-extrabold uppercase px-1.5 py-0.5 rounded">
                      Redeem
                    </span>
                  ) : (
                    <span className="text-[9px] bg-red-500/10 text-red-500 font-extrabold uppercase px-1.5 py-0.5 rounded">
                      Short
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

      </div>

      {/* REDEMPTION ACTION MODAL/FORM OVERLAY */}
      {selectedPack && (
        <div className="fixed inset-0 z-[3000] flex items-center justify-center p-4">
          <div 
            className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={() => setSelectedPack(null)}
          />

          <div className="w-full max-w-sm bg-card border border-border rounded-[32px] overflow-hidden shadow-2xl relative z-10 p-6 flex flex-col gap-4 animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="flex items-center justify-between pb-2.5 border-b border-border">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-500" />
                <h4 className="text-sm font-black text-foreground">Redemption Terminal</h4>
              </div>
              <button 
                onClick={() => setSelectedPack(null)}
                className="p-1 bg-secondary rounded-lg text-muted-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {step === 'input' && (
              <form onSubmit={handleRunValidation} className="space-y-4">
                <div className="p-3.5 bg-secondary/35 border border-border rounded-xl">
                  <p className="text-[10px] text-muted-foreground font-semibold">Redemption Package</p>
                  <h4 className="text-sm font-black text-foreground my-0.5">{selectedPack.name} ({selectedGame.name})</h4>
                  <p className="text-[11px] text-amber-500 font-bold flex items-center gap-1">
                    <Coins className="w-3.5 h-3.5" /> Costs {selectedPack.cost} Streaming Coins
                  </p>
                </div>

                <div>
                  <label className="text-[10px] uppercase font-black text-muted-foreground ml-1">Universal Player / Character ID</label>
                  <div className="relative mt-1">
                    <Smartphone className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input
                      type="text"
                      value={playerId}
                      onChange={e => setPlayerId(e.target.value)}
                      placeholder="e.g. 58291048 or character_key"
                      className="w-full bg-secondary/35 border border-border rounded-xl pl-9 p-2.5 text-xs font-black text-foreground focus:outline-none focus:ring-1 focus:ring-primary/45"
                      required
                    />
                  </div>
                </div>

                <div className="text-[10px] text-muted-foreground font-semibold">
                  Note: Inputting details querying global servers for validation to protect against deliveries onto invalid game IDs.
                </div>

                <button
                  type="submit"
                  className="w-full py-3 bg-primary text-primary-foreground font-black rounded-xl hover:opacity-95 text-xs tracking-wide shadow-sm"
                >
                  Verify Gamer Account ID
                </button>
              </form>
            )}

            {step === 'validating' && (
              <div className="py-10 text-center flex flex-col items-center justify-center gap-3">
                <Loader2 className="w-10 h-10 text-primary animate-spin" />
                <div>
                  <p className="text-xs font-black text-foreground">Checking Player ID Server Nodes</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5 font-semibold">Matching character with global API databases...</p>
                </div>
              </div>
            )}

            {step === 'processing' && (
              <div className="py-10 text-center flex flex-col items-center justify-center gap-3">
                <Loader2 className="w-10 h-10 text-amber-500 animate-spin" />
                <div>
                  <p className="text-xs font-black text-foreground">Delivering In-game Coins</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5 font-semibold">
                    Sending package to: <span className="text-emerald-500 font-black">{validatedName}</span> (ID: {playerId})
                  </p>
                </div>
              </div>
            )}

            {step === 'success' && (
              <div className="py-4 text-center flex flex-col items-center justify-center gap-4">
                <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-emerald-500 flex items-center justify-center mb-1">
                  <Check className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-sm font-black text-foreground">Delivery Succeeded!</h4>
                  <p className="text-xs text-muted-foreground mt-1 font-semibold leading-relaxed">
                    Successfully subtracted <span className="font-bold text-amber-500">{selectedPack.cost} Coins</span> from stream reserve. 
                    Added <span className="font-bold text-primary">{selectedPack.amount}</span> onto character <span className="text-foreground font-extrabold">{validatedName}</span>.
                  </p>
                </div>
                <button
                  onClick={() => setSelectedPack(null)}
                  className="w-full py-2 bg-secondary text-foreground rounded-xl text-xs font-bold transition-all hover:bg-secondary/80 mt-2"
                >
                  Great, Return!
                </button>
              </div>
            )}

          </div>
        </div>
      )}

    </div>
  );
}
