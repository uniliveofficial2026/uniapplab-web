import React, { useState } from 'react';
import { useDB } from '../../lib/useDB';
import { 
  ShoppingBag, 
  Tag, 
  Coins, 
  DollarSign, 
  PlusCircle, 
  Trash, 
  Check, 
  TrendingUp, 
  BarChart3, 
  Store,
  Boxes,
  Plus
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';

export function ShopTab() {
  const db = useDB();

  // Load balances
  const coinsBalance = db.load('coins_balance', 4200);
  const cashBalance = db.load('cash_balance', 180.50);

  // Sub-sections toggling
  const [shopMode, setShopMode] = useState<'buy' | 'sell'>('buy');

  // Load products list representing digital items for sale
  const initialProducts = [
    { 
      id: 'p_1', 
      name: 'Streamer Overlays & Graphics Pack', 
      price: 800, 
      priceType: 'coins', 
      stock: 45, 
      sales: 12, 
      sellerId: 'other_u',
      image: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&q=80&w=200' 
    },
    { 
      id: 'p_2', 
      name: 'Professional Broadcast Mic Stand', 
      price: 29.99, 
      priceType: 'cash', 
      stock: 8, 
      sales: 4, 
      sellerId: 'other_u',
      image: 'https://images.unsplash.com/photo-1590602847861-f357a9332bbc?auto=format&fit=crop&q=80&w=200' 
    },
    { 
      id: 'p_3', 
      name: 'Mute Button / Custom Soundpad Deck', 
      price: 1500, 
      priceType: 'coins', 
      stock: 2, 
      sales: 3, 
      sellerId: 'other_u',
      image: 'https://images.unsplash.com/photo-1592840496694-26d035b52b48?auto=format&fit=crop&q=80&w=200' 
    },
  ];

  const products = db.load('shop_products', initialProducts);

  // Seller stats & additions
  const newProductNameState = useState('');
  const [newProductName, setNewProductName] = newProductNameState;
  const [newProductPrice, setNewProductPrice] = useState('15.00');
  const [newProductPriceType, setNewProductPriceType] = useState<'cash' | 'coins'>('cash');
  const [newProductStock, setNewProductStock] = useState('10');

  const [buySuccess, setBuySuccess] = useState<string | null>(null);
  const [sellSuccess, setSellSuccess] = useState<string | null>(null);

  // Custom sales data for Seller Recharts
  const salesChartData = [
    { day: 'Mon', revenue: 45.00 },
    { day: 'Tue', revenue: 15.00 },
    { day: 'Wed', revenue: 95.50 },
    { day: 'Thu', revenue: 30.00 },
    { day: 'Fri', revenue: 120.00 },
    { day: 'Sat', revenue: 80.00 },
    { day: 'Sun', revenue: 145.00 },
  ];

  // Buying logic
  const handleBuyProduct = (product: typeof products[0]) => {
    if (product.stock <= 0) {
      alert('This product is currently out of stock!');
      return;
    }

    if (product.priceType === 'coins') {
      if (coinsBalance < product.price) {
        alert('Insufficient streaming Coins to purchase this item.');
        return;
      }
      
      // Deduct coins
      db.save('coins_balance', coinsBalance - product.price);
    } else {
      if (cashBalance < product.price) {
        alert('Insufficient cash USD balance to purchase this item.');
        return;
      }

      // Deduct cash
      db.save('cash_balance', cashBalance - product.price);
    }

    // Decrement stock & increment sales
    const updatedProducts = products.map((p: any) => {
      if (p.id === product.id) {
        return { ...p, stock: p.stock - 1, sales: p.sales + 1 };
      }
      return p;
    });
    db.save('shop_products', updatedProducts);

    // Save transaction
    const currentTrans = db.load('wallet_transactions', []);
    const costRep = product.priceType === 'coins' ? `${product.price} Coins` : `$${product.price.toFixed(2)} USD`;
    db.save('wallet_transactions', [{
      id: `t_${Date.now()}`,
      type: 'Product Purchased',
      amount: `-${costRep}`,
      status: 'Completed',
      date: new Date().toISOString().replace('T', ' ').substring(0, 16),
      cost: `Bought "${product.name}"`
    }, ...currentTrans]);

    setBuySuccess(`Successfully purchased "${product.name}"! Receipt appended to ledger.`);
    setTimeout(() => setBuySuccess(null), 4000);
  };

  // Add Product logic
  const handleAddNewProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProductName.trim()) return;

    const priceNum = parseFloat(newProductPrice);
    const stockNum = parseInt(newProductStock) || 1;
    if (priceNum <= 0) return;

    const newProd = {
      id: `p_${Date.now()}`,
      name: newProductName,
      price: priceNum,
      priceType: newProductPriceType,
      stock: stockNum,
      sales: 0,
      sellerId: db.currentUser?.id || 'u1',
      image: newProductPriceType === 'coins'
        ? 'https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&q=80&w=200'
        : 'https://images.unsplash.com/photo-1590602847861-f357a9332bbc?auto=format&fit=crop&q=80&w=200'
    };

    db.save('shop_products', [...products, newProd]);
    
    setNewProductName('');
    setNewProductPrice('10.00');
    setNewProductStock('10');

    setSellSuccess(`Published "${newProd.name}" is now live for buyers!`);
    setTimeout(() => setSellSuccess(null), 4000);
  };

  // Delete product listed by user
  const handleDeleteProduct = (pId: string) => {
    const nextProds = products.filter((p: any) => p.id !== pId);
    db.save('shop_products', nextProds);
  };

  // Filter listings
  const shoppingItems = products.filter((p: any) => p.sellerId !== (db.currentUser?.id || 'u1'));
  const sellerListings = products.filter((p: any) => p.sellerId === (db.currentUser?.id || 'u1'));

  // Calculate seller revenue indices
  const sellerSalesTotal = sellerListings.reduce((acc: number, cur: any) => acc + (cur.sales * cur.price), 0);

  return (
    <div className="space-y-6 text-left animate-in fade-in duration-300">
      
      {/* Tab select mode */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-3">
        <div>
          <h3 className="text-xl font-black text-foreground">Shopping & Merchant Console</h3>
          <p className="text-xs text-muted-foreground font-semibold mt-1">Simulate purchases of stream assets or list merchandise to make direct Coins and Cash currency royalties.</p>
        </div>
        <div className="flex gap-2.5 bg-secondary/40 p-1 rounded-xl border border-border shrink-0">
          <button
            onClick={() => setShopMode('buy')}
            className={`px-4 py-2 text-xs font-black rounded-lg transition-all flex items-center gap-1.5 ${
              shopMode === 'buy'
                ? 'bg-primary text-primary-foreground shadow-sm animate-in fade-in'
                : 'text-muted-foreground hover:bg-secondary/60'
            }`}
          >
            <Store className="w-4 h-4" /> Shop Digital Assets
          </button>
          <button
            onClick={() => setShopMode('sell')}
            className={`px-4 py-2 text-xs font-black rounded-lg transition-all flex items-center gap-1.5 ${
              shopMode === 'sell'
                ? 'bg-primary text-primary-foreground shadow-sm animate-in fade-in'
                : 'text-muted-foreground hover:bg-secondary/60'
            }`}
          >
            <Boxes className="w-4 h-4" /> Seller Console
          </button>
        </div>
      </div>

      {/* Mode A: SHOP DIGITAL ASSETS */}
      {shopMode === 'buy' ? (
        <div className="space-y-6">
          {buySuccess && (
            <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/25 text-emerald-500 text-xs font-black rounded-2xl text-center">
              {buySuccess}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {shoppingItems.length === 0 ? (
              <div className="md:col-span-3 text-center py-12 bg-secondary/10 border border-dashed border-border rounded-2xl text-xs font-extrabold text-muted-foreground">
                No active listings posted by external sellers. Create products in "Seller Console" to test transactions!
              </div>
            ) : (
              shoppingItems.map((prod: any) => (
                <div key={prod.id} className="bg-card border border-border rounded-[28px] overflow-hidden flex flex-col justify-between hover:border-primary/45 transition-all shadow-sm">
                  <div className="relative">
                    <img 
                      src={prod.image}
                      alt={prod.name}
                      className="w-full h-36 object-cover"
                      referrerPolicy="no-referrer"
                    />
                    <span className="absolute bottom-3 right-3 bg-card border border-border text-[9px] font-black rounded px-2 py-0.5">
                      Stock: {prod.stock}
                    </span>
                  </div>

                  <div className="p-5 flex flex-col justify-between flex-1 gap-4">
                    <div>
                      <h4 className="text-xs font-black text-foreground line-clamp-2 leading-relaxed">{prod.name}</h4>
                      <p className="text-[10px] text-muted-foreground mt-1 font-semibold">Instant cloud delivery on checkout</p>
                    </div>

                    <div className="flex items-center justify-between pt-3 border-t border-border/60">
                      <div className="flex items-center gap-1">
                        {prod.priceType === 'coins' ? (
                          <>
                            <Coins className="w-4 h-4 text-amber-500" />
                            <span className="text-sm font-black text-amber-500">{prod.price.toLocaleString()}</span>
                          </>
                        ) : (
                          <>
                            <DollarSign className="w-4 h-4 text-emerald-500" />
                            <span className="text-sm font-black text-emerald-500">${prod.price.toFixed(2)}</span>
                          </>
                        )}
                      </div>

                      <button
                        onClick={() => handleBuyProduct(prod)}
                        className="p-1.5 px-3 bg-secondary hover:bg-primary hover:text-primary-foreground rounded-lg text-[10px] font-black transition-all"
                      >
                        Buy Now
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      ) : (
        /* Mode B: SELLER CONSOLE */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Sub-Column: General Earnings Metrics and Posting form */}
          <div className="lg:col-span-1 space-y-6">
            
            {/* Rapid Earnings Card */}
            <div className="p-6 bg-gradient-to-br from-indigo-950 via-slate-900 to-indigo-950 border border-indigo-500/25 rounded-3xl text-left flex flex-col justify-between h-40 shadow-md">
              <div>
                <p className="text-[10px] font-black text-indigo-300 uppercase tracking-widest">Gross Seller Receipts</p>
                <div className="flex items-baseline gap-1 mt-1.5">
                  <h3 className="text-3xl font-black text-white">${sellerSalesTotal.toFixed(2)}</h3>
                  <span className="text-xs text-indigo-200 font-bold">USD Value</span>
                </div>
              </div>

              <div className="text-[10px] text-indigo-300 font-bold border-t border-indigo-500/10 pt-2.5 flex items-center justify-between">
                <span>Simulated Daily Trend</span>
                <span className="text-emerald-400 font-black flex items-center gap-0.5">
                  <TrendingUp className="w-3" /> +28%
                </span>
              </div>
            </div>

            {/* Posting Form */}
            <form onSubmit={handleAddNewProduct} className="bg-card border border-border rounded-[28px] p-5 shadow-sm space-y-4">
              <h4 className="text-xs uppercase font-black text-foreground tracking-wider mb-2.5">Add Product Listing</h4>
              
              <div>
                <label className="text-[10px] font-black text-muted-foreground">Product Title</label>
                <input
                  type="text"
                  value={newProductName}
                  onChange={e => setNewProductName(e.target.value)}
                  className="w-full mt-1 bg-secondary/35 border border-border rounded-xl p-2.5 text-xs font-bold text-foreground focus:outline-none focus:ring-1 focus:ring-primary/45"
                  placeholder="e.g. Creator Soundboard Pro"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-black text-muted-foreground">Price Rate</label>
                  <input
                    type="number"
                    value={newProductPrice}
                    onChange={e => setNewProductPrice(e.target.value)}
                    className="w-full mt-1 bg-secondary/35 border border-border rounded-xl p-2.5 text-xs font-black text-foreground focus:outline-none focus:ring-1 focus:ring-primary/45"
                    step="0.01"
                    required
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-muted-foreground">Price Currency</label>
                  <select
                    value={newProductPriceType}
                    onChange={e => setNewProductPriceType(e.target.value as any)}
                    className="w-full mt-1 bg-secondary/35 border border-border rounded-xl p-2.5 text-xs font-extrabold text-foreground focus:outline-none"
                  >
                    <option value="cash">USD Cash</option>
                    <option value="coins">Coins</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black text-muted-foreground">Default Stock Limit</label>
                <input
                  type="number"
                  value={newProductStock}
                  onChange={e => setNewProductStock(e.target.value)}
                  className="w-full mt-1 bg-secondary/35 border border-border rounded-xl p-2.5 text-xs font-black text-foreground focus:outline-none focus:ring-1 focus:ring-primary/45"
                  required
                />
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-primary text-primary-foreground font-black rounded-xl hover:opacity-95 text-xs"
              >
                Publish on Shopping Store
              </button>

              {sellSuccess && (
                <p className="text-[10px] font-extrabold text-emerald-500 text-center mt-2 bg-emerald-500/10 p-2 border border-emerald-500/20 rounded-xl">{sellSuccess}</p>
              )}
            </form>

          </div>

          {/* Sub-Column: Active listings inventories and beautiful sales bar charts */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Sales BarChart */}
            <div className="bg-card border border-border rounded-[32px] p-5 shadow-sm space-y-3.5">
              <div>
                <h4 className="text-sm font-black text-foreground">Interactive Merchandising Revenue Performance</h4>
                <p className="text-[10px] text-muted-foreground font-semibold">Weekly tracking indexes of coins & cash shopping conversions combined</p>
              </div>

              <div className="h-40 w-full pt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={salesChartData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsla(var(--border) / 0.1)" />
                    <XAxis dataKey="day" stroke="hsla(var(--border) / 0.6)" fontSize={10} fontWeight="600" />
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
                    <Bar dataKey="revenue" fill="#6366f1" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Inventory Listings Table */}
            <div className="bg-card border border-border rounded-[32px] p-5 shadow-sm space-y-4">
              <h4 className="text-sm font-black text-foreground">Your Active Listings Management</h4>
              
              <div className="divide-y divide-border rounded-xl overflow-hidden border border-border/80">
                {sellerListings.length === 0 ? (
                  <div className="p-8 text-center text-xs text-muted-foreground font-semibold bg-secondary/5">
                    You have not published any items yet. Set values using the form on the left!
                  </div>
                ) : (
                  sellerListings.map(item => (
                    <div key={item.id} className="p-3.5 flex items-center justify-between gap-4 bg-secondary/5 hover:bg-secondary/10 transition-all">
                      <div className="truncate">
                        <h4 className="text-xs font-black text-foreground truncate">{item.name}</h4>
                        <div className="flex gap-2 text-[9px] font-bold text-muted-foreground mt-1">
                          <span>Rate: {item.priceType === 'coins' ? `${item.price} Coins` : `$${item.price.toFixed(2)}`}</span>
                          <span>•</span>
                          <span>Stock: {item.stock}</span>
                          <span>•</span>
                          <span className="text-indigo-500">Sales: {item.sales}</span>
                        </div>
                      </div>

                      <button
                        onClick={() => handleDeleteProduct(item.id)}
                        className="p-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-xl transition-all"
                      >
                        <Trash className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))
                )}
              </div>
              
            </div>

          </div>

        </div>
      )}

    </div>
  );
}
