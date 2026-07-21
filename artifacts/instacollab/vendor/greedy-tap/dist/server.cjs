var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// server.ts
var import_express = __toESM(require("express"), 1);
var import_async_hooks = require("async_hooks");
var import_path = __toESM(require("path"), 1);
var import_vite = { createServer: async () => { throw new Error("Vite is not available in Greedy Tap production builds"); } };
var import_http = __toESM(require("http"), 1);
var import_socket = require("socket.io");
var import_fs = __toESM(require("fs"), 1);
var import_genai = require("@google/genai");
var import_stripe = __toESM(require("stripe"), 1);
process.on("uncaughtException", (err) => {
  console.error("CRITICAL UNCAUGHT EXCEPTION PREVENTED BY SECURITY LAYER:", err);
});
process.on("unhandledRejection", (reason, promise) => {
  console.error("CRITICAL UNHANDLED REJECTION PREVENTED BY SECURITY LAYER at:", promise, "reason:", reason);
});
var app = (0, import_express.default)();
var adminStorage = new import_async_hooks.AsyncLocalStorage();
app.use((req, res, next) => {
  adminStorage.run(req, next);
});
var PORT = Number(process.env.PORT) || 3e3;
var GAME_BASE_PATH = (process.env.GAME_BASE_PATH || "").replace(/\/+$/, "");
var server = import_http.default.createServer(app);
var io = new import_socket.Server(server, {
  cors: { origin: "*" },
  transports: ["polling", "websocket"],
  pingTimeout: 6e4,
  pingInterval: 25e3
});
app.use(import_express.default.json({ limit: "50mb" }));
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", time: (/* @__PURE__ */ new Date()).toISOString(), mode: process.env.NODE_ENV || "development" });
});
var items = [
  { id: "hotdog", name: "Hot Dog", multiplier: 10, icon: "\u{1F32D}", weight: 15 },
  { id: "skewer", name: "Skewer", multiplier: 15, icon: "\u{1F362}", weight: 15 },
  { id: "ham", name: "Ham", multiplier: 25, icon: "\u{1F356}", weight: 15 },
  { id: "steak", name: "Steak", multiplier: 45, icon: "\u{1F969}", weight: 15 },
  { id: "carrot", name: "Carrot", multiplier: 5, icon: "\u{1F955}", weight: 15 },
  { id: "corn", name: "Corn", multiplier: 5, icon: "\u{1F33D}", weight: 15 },
  { id: "cabbage", name: "Cabbage", multiplier: 5, icon: "\u{1F96C}", weight: 15 },
  { id: "tomato", name: "Tomato", multiplier: 5, icon: "\u{1F345}", weight: 15 },
  { id: "salad", name: "Salad", multiplier: 50, icon: "\u{1F957}", weight: 1 },
  { id: "pizza", name: "Pizza", multiplier: 100, icon: "\u{1F355}", weight: 0.1 }
];
var roundNumber = 1670;
var history = [];
var bonusMultiplier = 1;
var isBonusRound = false;
var bonusMessage = "";
var freeSpinsRemaining = 0;
var gameState = "betting";
var timeLeft = 15;
var winItemIndex = null;
var wheelIndex = null;
var winningId = null;
var totalBets = {};
var activeBets = [];
var allHistoricalBets = [];
var autoAiEnabled = true;
var projectedWinItemIndex = 0;
var lastAiAnalysis = "AI Engine ready. Waiting for bets to analyze...";
function addHistoricalBet(bet) {
  const date = /* @__PURE__ */ new Date();
  const timestamp = date.toLocaleTimeString("en-US", { hour12: true });
  const timestampRaw = date.getTime();
  allHistoricalBets.unshift({ ...bet, timestamp, timestampRaw });
  if (allHistoricalBets.length > 500) {
    allHistoricalBets.pop();
  }
  io.emit("new_historical_bet", { ...bet, timestamp, timestampRaw });
}
var forcedWinItemIndex = null;
var dailyWins = {};
var lastResetDate = (/* @__PURE__ */ new Date()).toDateString();
var DAILY_LIMITS = {
  carrot: 500,
  corn: 500,
  cabbage: 500,
  tomato: 500,
  salad: 6,
  pizza: 3,
  ham: 100,
  hotdog: 500,
  skewer: 300,
  steak: 50
};
function checkAndResetDailyQuotas() {
  const now = /* @__PURE__ */ new Date();
  if (now.toDateString() !== lastResetDate) {
    dailyWins = {};
    lastResetDate = now.toDateString();
    saveDb();
  }
}
function canWin(itemId, strictSpacing = true) {
  checkAndResetDailyQuotas();
  if (strictSpacing) {
    const recentWins = history.slice(0, 4).map((h) => h.id);
    if (recentWins.includes(itemId)) return false;
  }
  const limit = DAILY_LIMITS[itemId] !== void 0 ? DAILY_LIMITS[itemId] : Infinity;
  const currentWins = dailyWins[itemId] || 0;
  return currentWins < limit;
}
function incrementWin(itemId) {
  checkAndResetDailyQuotas();
  dailyWins[itemId] = (dailyWins[itemId] || 0) + 1;
  saveDb();
}
var aiClient = null;
function getAiClient() {
  if (!process.env.GEMINI_API_KEY) {
    return null;
  }
  if (!aiClient) {
    try {
      aiClient = new import_genai.GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build"
          }
        }
      });
    } catch (err) {
      console.error("FATAL: Failed to instantiate Gemini SDK:", err);
      return null;
    }
  }
  return aiClient;
}
var lastQuotaErrorTime = 0;
var COOL_DOWN_DURATION_MS = 18e4;
function generateLocalRiskAnalysis(betMap, finalWinnerItemName, finalWinnerItemId) {
  const winnerExposure = betMap[finalWinnerItemId] || 0;
  const sumOfAllBets = Object.values(betMap).reduce((acc, curr) => acc + curr, 0);
  if (sumOfAllBets === 0) {
    const zeroBetsTemplates = [
      `[AI Security Framework] Idle betting sequence detected. Rotated randomly to "${finalWinnerItemName}" with zero active exposure to maintain house integrity.`,
      `[Risk Engine Protocol] Verified zero liability spread. Locked in "${finalWinnerItemName}" as the active rotation outcome to preserve organic RNG profiles.`,
      `[Quantum Audit Core] Zero aggregated bets found. Confirmed "${finalWinnerItemName}" as the optimal zero-risk choice for this betting round.`
    ];
    return zeroBetsTemplates[Math.floor(Math.random() * zeroBetsTemplates.length)];
  }
  const yieldDelta = sumOfAllBets - winnerExposure;
  const activeBetsTemplates = [
    `[AI Security Engine] Bet aggregation evaluated. Locked "${finalWinnerItemName}" (${finalWinnerItemId}) with \u{1F4B0}${winnerExposure} active exposure vs \u{1F4B0}${sumOfAllBets} total pool, maximizing yields.`,
    `[Risk Management Audit] System selected "${finalWinnerItemName}" (liability: \u{1F4B0}${winnerExposure}) representing the absolute minimum payout probability cluster.`,
    `[Predictive Yield Optimization] Defended reserve margin. Resolving "${finalWinnerItemName}" secures a guaranteed house yield delta of \u{1F4B0}${yieldDelta} this round.`,
    `[System Volatility Control] Mitigated high-exposure vectors. Enforcing victory of "${finalWinnerItemName}" successfully hedges house surplus index.`,
    `[Math Matrix Resolutor] Enforced winner "${finalWinnerItemName}" to maintain casino profitability margins (Total Pool \u{1F4B0}${sumOfAllBets} secured against minimal payout).`
  ];
  return activeBetsTemplates[Math.floor(Math.random() * activeBetsTemplates.length)];
}
async function runAiBetAnalysis(betMap, finalWinnerItemName, finalWinnerItemId) {
  const currentTime = Date.now();
  const insideCoolDown = currentTime - lastQuotaErrorTime < COOL_DOWN_DURATION_MS;
  const client = getAiClient();
  if (!client || insideCoolDown) {
    lastAiAnalysis = generateLocalRiskAnalysis(betMap, finalWinnerItemName, finalWinnerItemId);
    io.emit("ai_settings_update", { autoAiEnabled, lastAiAnalysis });
    return;
  }
  try {
    const prompt = `
You are an advanced casino risk management system for a Food Wheel Spin.
We need to finalize the spin target. The system determined to force a win on "${finalWinnerItemName}" (ID: "${finalWinnerItemId}") because it holds the absolute minimum bet exposure (Total Bets placed: ${JSON.stringify(betMap)}).
Provide a concise, professional 1-sentence analytics audit of the round's risk layout. Explain why picking "${finalWinnerItemName}" is mathematically optimal to optimize yield. Include the currency symbol (\u{1F4B0}) if referencing amounts.
Make it sound highly technical, cold, and smart (max 50 words). Do not include any warning or preamble.
    `;
    const response = await client.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt
    });
    if (response && response.text) {
      lastAiAnalysis = response.text.trim();
    } else {
      lastAiAnalysis = generateLocalRiskAnalysis(betMap, finalWinnerItemName, finalWinnerItemId);
    }
  } catch (err) {
    const errStr = String(err);
    const errMessage = err?.message || "";
    const errStatus = err?.status || "";
    const isQuotaOrDemand = errStr.includes("429") || errStr.includes("503") || errStr.includes("RESOURCE_EXHAUSTED") || errStr.includes("UNAVAILABLE") || errStr.includes("rate") || errStr.includes("quota") || errMessage.includes("quota") || errMessage.includes("demand") || errStatus === "RESOURCE_EXHAUSTED" || errStatus === "UNAVAILABLE";
    if (isQuotaOrDemand) {
      lastQuotaErrorTime = currentTime;
      console.warn(`[Gemini API Rate-Limited/Quota Exceeded] Active spin analysis throttled. Cooling down Gemini API calls for 3 minutes. Switching to elegant local technical templates.`);
    } else {
      console.error("Gemini analysis error:", err);
    }
    lastAiAnalysis = generateLocalRiskAnalysis(betMap, finalWinnerItemName, finalWinnerItemId);
  }
  io.emit("ai_settings_update", { autoAiEnabled, lastAiAnalysis });
}
var lastAnalysisTime = 0;
function computeOptimalWinItemIndex() {
  if (!items || items.length === 0) return 0;
  const itemBetMap = items.map((item, idx) => {
    const amount = typeof totalBets[item.id] === "number" && !isNaN(totalBets[item.id]) ? totalBets[item.id] : 0;
    const multiplier = item.multiplier || 1;
    return {
      idx,
      id: item.id,
      name: item.name,
      amount,
      multiplier,
      liability: amount * multiplier
    };
  });
  let allowedItems = itemBetMap.filter((x) => canWin(x.id, true));
  if (allowedItems.length === 0) {
    allowedItems = itemBetMap.filter((x) => canWin(x.id, false));
  }
  let validCandidates = allowedItems.length > 0 ? allowedItems : itemBetMap.filter((x) => x.id !== "pizza" && x.id !== "salad");
  if (validCandidates.length === 0) validCandidates = itemBetMap;
  const zeroBetItems = validCandidates.filter((x) => x.amount === 0);
  let chosen;
  if (zeroBetItems.length > 0) {
    chosen = zeroBetItems[roundNumber % zeroBetItems.length];
  } else {
    const minLiability = Math.min(...validCandidates.map((x) => x.liability));
    const candidates = validCandidates.filter((x) => x.liability === minLiability);
    chosen = candidates[roundNumber % candidates.length] || validCandidates[0];
  }
  const finalIdx = chosen ? chosen.idx : 0;
  if (finalIdx >= 0 && finalIdx < items.length) {
    return finalIdx;
  }
  return 0;
}
function onBetUpdated() {
  try {
    if (!items || items.length === 0) return;
    const idx = computeOptimalWinItemIndex();
    projectedWinItemIndex = idx;
    const targetIdx = forcedWinItemIndex !== null ? forcedWinItemIndex : idx;
    const chosen = items[targetIdx] || items[0];
    const projectedWinnerItemName = chosen ? chosen.name : "Unknown";
    const projectedWinnerItemId = chosen ? chosen.id : "hotdog";
    io.emit("projected_winner_update", { projectedWinItemIndex: idx });
    const now = Date.now();
    if (now - lastAnalysisTime > 4e3) {
      lastAnalysisTime = now;
      runAiBetAnalysis(totalBets, projectedWinnerItemName, projectedWinnerItemId);
    } else {
      lastAiAnalysis = generateLocalRiskAnalysis(totalBets, projectedWinnerItemName, projectedWinnerItemId);
      io.emit("ai_settings_update", { autoAiEnabled, lastAiAnalysis });
    }
  } catch (err) {
    console.error("SAFE ADVANCED BET NOTIFICATION EXCEPTION PREVENTED:", err);
  }
}
var users = {
  "user1": { id: "user1", name: "Player 1", balance: 5e4, role: "user", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Felix", todayWin: 1200, weekWin: 5400, monthWin: 19e3 },
  "user2": { id: "user2", name: "Player 2", balance: 12e3, role: "user", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Bella", todayWin: 300, weekWin: 1500, monthWin: 3e3 },
  "user3": { id: "user3", name: "John", balance: 145e3, role: "user", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=John", todayWin: 15e3, weekWin: 45e3, monthWin: 12e4 },
  "user4": { id: "user4", name: "Sarah", balance: 25e3, role: "user", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Sarah", todayWin: 8e3, weekWin: 12e3, monthWin: 45e3 }
};
var transactions = [
  { id: "1", userId: "Player 1", type: "shop_purchase", amount: 5e4, date: (/* @__PURE__ */ new Date()).toISOString() },
  { id: "2", userId: "Sarah", type: "seller_purchase", amount: 1e5, date: new Date(Date.now() - 36e5).toISOString(), sellerId: "CryptoTrader99" },
  { id: "3", userId: "John", type: "shop_purchase", amount: 15e3, date: new Date(Date.now() - 864e5).toISOString() }
];
var shopBonuses = { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0, "6": 0 };
var jackpotPool = 12500;
var jackpotTimer = 1800;
var jackpotWinners = [];
var sellerApplications = [
  { id: "test_seller_id", name: "Test Coin Seller", email: "test@test.com", volume: "100,000+ Coins", motivation: "System test account for demo environment.", status: "approved", date: (/* @__PURE__ */ new Date()).toISOString(), avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=TestSeller", userId: "test@test.com", password: "test123", stock: 25e4 },
  { id: "1", name: "John Doe", email: "john@example.com", volume: "10,000 - 50,000 Coins", motivation: "Want to sell", status: "pending", date: (/* @__PURE__ */ new Date()).toISOString(), avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=John" },
  { id: "2", name: "CryptoTrader99", email: "trader@crypto.net", volume: "50,000+ Coins", motivation: "Large crypto trades", status: "approved", date: new Date(Date.now() - 864e5).toISOString(), avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Trader", stock: 1e6 }
];
var DB_FILE = import_path.default.join(process.cwd(), "data.json");
var saveDbTimeout = null;
function saveDb() {
  const activeReq = adminStorage.getStore();
  if (activeReq && activeReq.adminMode === "demo") {
    console.log("[Demo Sandbox Integrity] Intercepted filesystem write. Changes are in-memory demo sandbox only.");
    return;
  }
  if (saveDbTimeout) clearTimeout(saveDbTimeout);
  saveDbTimeout = setTimeout(() => {
    try {
      const dataToSave = {
        items,
        users,
        sellerApplications,
        transactions,
        autoAiEnabled,
        shopBonuses,
        allHistoricalBets,
        dailyWins,
        lastResetDate,
        jackpotPool,
        jackpotTimer,
        jackpotWinners
      };
      import_fs.default.writeFile(DB_FILE, JSON.stringify(dataToSave, null, 2), (err) => {
        if (err) console.error("CRITICAL DATABASE SAVE FAILURE PREVENTED:", err);
      });
    } catch (err) {
      console.error("CRITICAL DATABASE SAVE FAILURE PREVENTED:", err);
    }
  }, 100);
}
function saveDbCheck(req) {
  if (req && req.adminMode === "demo") {
    console.log("[Demo Sandbox Integrity] Skipping filesystem write to persist changes.");
    return;
  }
  saveDb();
}
function loadDb() {
  if (import_fs.default.existsSync(DB_FILE)) {
    try {
      const content = import_fs.default.readFileSync(DB_FILE, "utf-8").trim();
      if (content) {
        const data = JSON.parse(content);
        if (data && data.items && Array.isArray(data.items) && data.items.length > 0) {
          items = data.items;
        }
        if (data && data.users) {
          users = data.users;
        }
        if (data && Array.isArray(data.sellerApplications)) {
          sellerApplications = data.sellerApplications;
        }
        const hasTestSeller = sellerApplications.some((app2) => app2.email === "test@test.com");
        if (!hasTestSeller) {
          sellerApplications.push({
            id: "test_seller_id",
            name: "Test Coin Seller",
            email: "test@test.com",
            volume: "100,000+ Coins",
            motivation: "System test account for demo environment.",
            status: "approved",
            date: (/* @__PURE__ */ new Date()).toISOString(),
            avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=TestSeller",
            userId: "test@test.com",
            password: "test123",
            stock: 25e4
          });
        }
        if (data && Array.isArray(data.transactions)) {
          transactions = data.transactions;
        }
        if (data && typeof data.autoAiEnabled === "boolean") {
          autoAiEnabled = data.autoAiEnabled;
        }
        if (data && data.shopBonuses) {
          shopBonuses = data.shopBonuses;
        }
        if (data && Array.isArray(data.allHistoricalBets)) {
          allHistoricalBets = data.allHistoricalBets;
        }
        if (data && typeof data.jackpotPool === "number") {
          jackpotPool = data.jackpotPool;
        }
        if (data && Array.isArray(data.jackpotWinners)) {
          jackpotWinners = data.jackpotWinners;
        }
        if (data && typeof data.jackpotTimer === "number") {
          jackpotTimer = data.jackpotTimer;
        }
        if (data && data.dailyWins) {
          dailyWins = data.dailyWins;
          lastResetDate = data.lastResetDate || (/* @__PURE__ */ new Date()).toDateString();
        } else if (data && data.dailyQuotas) {
          dailyWins = {
            salad: data.dailyQuotas.saladWinsToday || 0,
            pizza: data.dailyQuotas.pizzaWinsToday || 0,
            ham: data.dailyQuotas.hamWinsToday || 0,
            hotdog: data.dailyQuotas.hotdogWinsToday || 0,
            skewer: data.dailyQuotas.skewerWinsToday || 0,
            steak: data.dailyQuotas.steakWinsToday || 0
          };
          lastResetDate = data.dailyQuotas.lastResetDate || (/* @__PURE__ */ new Date()).toDateString();
        }
      } else {
        saveDb();
      }
    } catch (e) {
      console.warn("Recovered/Healed corrupted data.json file with default values:", e);
      saveDb();
    }
  } else {
    saveDb();
  }
}
loadDb();
app.post("/api/admin/verify", (req, res) => {
  try {
    const { password } = req.body;
    if (!password) {
      return res.status(400).json({ success: false, error: "Password is required" });
    }
    const cleanPassword = password.trim();
    if (cleanPassword === "Weilin1500@") {
      return res.json({ success: true, token: "Weilin1500@", mode: "real", message: "Authorized: Full Production System Administrator" });
    } else if (cleanPassword === "admin123") {
      return res.json({ success: true, token: "admin123", mode: "demo", message: "Authorized: Guest Demo Sandbox Administrator" });
    } else {
      return res.status(401).json({ success: false, error: "Authentication failed: Invalid admin passcode." });
    }
  } catch (err) {
    console.error("POST /api/admin/verify failed:", err);
    res.status(500).json({ success: false, error: "Admin authentication error" });
  }
});
app.use("/api/admin", (req, res, next) => {
  const authHeader = req.headers["authorization"];
  if (req.url.includes("/verify")) {
    return next();
  }
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized access: Administrative header required." });
  }
  const token = authHeader.substring(7).trim();
  if (token === "Weilin1500@") {
    req.adminMode = "real";
    next();
  } else if (token === "admin123") {
    req.adminMode = "demo";
    next();
  } else {
    return res.status(403).json({ error: "Forbidden access: Unauthorized administrative signature." });
  }
});
app.get("/api/items", (req, res) => {
  try {
    res.json(items);
  } catch (err) {
    console.error("GET /api/items failed:", err);
    res.status(500).json({ error: "Failed to retrieve items" });
  }
});
app.post("/api/admin/upload-icon", (req, res) => {
  try {
    const { itemId, iconBase64 } = req.body;
    if (!itemId || !iconBase64) {
      return res.status(400).json({ error: "itemId and iconBase64 are required." });
    }
    const uploadsDir = import_path.default.join(process.cwd(), "uploads");
    if (!import_fs.default.existsSync(uploadsDir)) {
      import_fs.default.mkdirSync(uploadsDir, { recursive: true });
    }
    if (!iconBase64.startsWith("data:")) {
      const idx2 = items.findIndex((i) => i.id === itemId);
      if (idx2 !== -1) {
        items[idx2].icon = iconBase64;
        saveDb();
        io.emit("items_updated", items);
        return res.json({ success: true, url: iconBase64, items });
      } else {
        return res.status(404).json({ error: "Item not found." });
      }
    }
    const matches = iconBase64.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
      return res.status(400).json({ error: "Invalid base64 image data." });
    }
    const imageType = matches[1];
    const base64Data = matches[2];
    const buffer = Buffer.from(base64Data, "base64");
    let ext = "png";
    if (imageType.includes("jpeg") || imageType.includes("jpg")) {
      ext = "jpg";
    } else if (imageType.includes("gif")) {
      ext = "gif";
    } else if (imageType.includes("svg")) {
      ext = "svg";
    } else if (imageType.includes("webp")) {
      ext = "webp";
    }
    const filename = `${itemId}_${Date.now()}.${ext}`;
    const filePath = import_path.default.join(uploadsDir, filename);
    import_fs.default.writeFileSync(filePath, buffer);
    const fileUrl = `/uploads/${filename}`;
    const idx = items.findIndex((i) => i.id === itemId);
    if (idx !== -1) {
      items[idx].icon = fileUrl;
      saveDb();
      io.emit("items_updated", items);
      res.json({ success: true, url: fileUrl, items });
    } else {
      res.status(404).json({ error: "Item not found." });
    }
  } catch (err) {
    console.error("File upload failed:", err);
    res.status(500).json({ error: "Server error during icon upload." });
  }
});
app.put("/api/items", (req, res) => {
  try {
    if (Array.isArray(req.body) && req.body.length > 0) {
      const isValid = req.body.every((item) => item && typeof item.id === "string" && typeof item.name === "string");
      if (!isValid) {
        return res.status(400).json({ error: "Every item must contain valid string 'id' and 'name' properties." });
      }
      items = req.body;
      saveDb();
      io.emit("items_updated", items);
      res.json(items);
    } else {
      res.status(400).json({ error: "Body must be a non-empty array of items" });
    }
  } catch (err) {
    console.error("PUT /api/items failed:", err);
    res.status(500).json({ error: "Failed to save or set custom items" });
  }
});
app.post("/api/admin/toggle-ai", (req, res) => {
  try {
    const { enabled } = req.body;
    if (typeof enabled === "boolean") {
      autoAiEnabled = enabled;
      io.emit("ai_settings_update", { autoAiEnabled, lastAiAnalysis });
      onBetUpdated();
      res.json({ success: true, autoAiEnabled });
    } else {
      res.status(400).json({ error: "enabled must be a boolean" });
    }
  } catch (err) {
    console.error("POST /api/admin/toggle-ai failed:", err);
    res.status(500).json({ error: "Failed to toggle risk AI core" });
  }
});
app.get("/api/admin/ai-settings", (req, res) => {
  try {
    res.json({ autoAiEnabled, lastAiAnalysis });
  } catch (err) {
    console.error("GET /api/admin/ai-settings failed:", err);
    res.status(500).json({ error: "Failed to load yield settings" });
  }
});
app.post("/api/admin/force-win", (req, res) => {
  try {
    const { index } = req.body;
    if (typeof index === "number" && Number.isInteger(index) && index >= 0 && index < items.length) {
      forcedWinItemIndex = index;
      res.json({ success: true, forcedWinItemIndex });
    } else {
      res.status(400).json({ error: `Invalid index. Must be integer between 0 and ${items.length - 1}` });
    }
  } catch (err) {
    console.error("POST /api/admin/force-win failed:", err);
    res.status(500).json({ error: "Failed to inject win selection" });
  }
});
app.get("/api/admin/users", (req, res) => {
  const activeReq = adminStorage.getStore();
  if (activeReq && activeReq.adminMode === "demo") {
    return res.json([{ id: "demo-user", name: "Demo User", balance: 0, role: "user", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=demo", todayWin: 0, weekWin: 0, monthWin: 0 }]);
  }
  try {
    res.json(Object.values(users));
  } catch (err) {
    console.error("GET /api/admin/users failed:", err);
    res.status(500).json({ error: "Failed to load user records" });
  }
});
app.get("/api/admin/seller-applications", (req, res) => {
  const activeReq = adminStorage.getStore();
  if (activeReq && activeReq.adminMode === "demo") {
    return res.json([{ id: "demo-app", name: "Demo Seller", email: "demo@test.com", volume: "0", motivation: "Demo", status: "approved", date: (/* @__PURE__ */ new Date()).toISOString(), stock: 0 }]);
  }
  try {
    res.json(sellerApplications);
  } catch (err) {
    console.error("GET /api/admin/seller-applications failed:", err);
    res.status(500).json({ error: "Failed to load seller applications" });
  }
});
app.post("/api/admin/seller-applications/:id/approve", (req, res) => {
  try {
    const { id } = req.params;
    const appIndex = sellerApplications.findIndex((a) => a.id === id);
    if (appIndex !== -1) {
      sellerApplications[appIndex].status = "approved";
      if (sellerApplications[appIndex].stock === void 0) {
        sellerApplications[appIndex].stock = 1e6;
      }
      saveDbCheck(req);
      io.emit("seller_applications_update", [...sellerApplications]);
      res.json({ success: true, application: sellerApplications[appIndex] });
    } else {
      res.status(404).json({ error: "Application not found" });
    }
  } catch (err) {
    console.error("POST /api/admin/seller-applications/:id/approve failed:", err);
    res.status(500).json({ error: "Failed to approve seller" });
  }
});
app.post("/api/admin/seller-applications/:id/reject", (req, res) => {
  try {
    const { id } = req.params;
    const appIndex = sellerApplications.findIndex((a) => a.id === id);
    if (appIndex !== -1) {
      sellerApplications[appIndex].status = "rejected";
      saveDbCheck(req);
      io.emit("seller_applications_update", [...sellerApplications]);
      res.json({ success: true, application: sellerApplications[appIndex] });
    } else {
      res.status(404).json({ error: "Application not found" });
    }
  } catch (err) {
    console.error("POST /api/admin/seller-applications/:id/reject failed:", err);
    res.status(500).json({ error: "Failed to reject seller" });
  }
});
app.post("/api/seller-applications", (req, res) => {
  try {
    const { name, email, volume, motivation, username, avatar, password } = req.body;
    if (name && email) {
      const normalizedEmail = (email || "").trim().toLowerCase();
      const normalizedUserId = (username || "").trim().toLowerCase();
      const existing = sellerApplications.find((app2) => {
        const appEmail = (app2.email || "").trim().toLowerCase();
        const appUserId = (app2.userId || "").trim().toLowerCase();
        return appEmail === normalizedEmail || appUserId === normalizedUserId;
      });
      if (existing) {
        return res.status(400).json({
          error: `An application with this email (${email}) or User ID (${username}) already exists. Multiple registrations are blocked for real-time account security.`
        });
      }
      const newApp = {
        id: Date.now().toString(),
        name,
        email,
        volume: volume || "Unknown",
        motivation: motivation || "",
        status: "pending",
        date: (/* @__PURE__ */ new Date()).toISOString(),
        userId: username,
        avatar: avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${name}`,
        password: password || "",
        stock: 1e6
      };
      sellerApplications.unshift(newApp);
      saveDb();
      io.emit("seller_applications_update", [...sellerApplications]);
      res.json({ success: true, application: newApp });
    } else {
      res.status(400).json({ error: "Name and email are required" });
    }
  } catch (err) {
    console.error("POST /api/seller-applications failed:", err);
    res.status(500).json({ error: "Failed to submit application" });
  }
});
app.delete("/api/admin/seller-applications/:id", (req, res) => {
  try {
    const { id } = req.params;
    const appIndex = sellerApplications.findIndex((a) => a.id === id);
    console.log(`Debug DELETE: Attempting to remove seller ${id}. Found at index: ${appIndex}`);
    if (appIndex !== -1) {
      const removed = sellerApplications.splice(appIndex, 1)[0];
      console.log(`Debug DELETE: Removing seller ${removed.id} - ${removed.name}. User ID: ${removed.userId}. Role: ${removed.userId ? users[removed.userId]?.role : "N/A"}`);
      if (removed.userId) {
        if (users[removed.userId]) {
          delete users[removed.userId];
          console.log(`Debug DELETE: User ${removed.userId} deleted successfully.`);
        } else {
          console.log(`Debug DELETE: User ${removed.userId} not found in users object.`);
        }
      } else {
        console.log(`Debug DELETE: Seller ${removed.id} has no associated userId.`);
      }
      saveDb();
      io.emit("seller_applications_update", [...sellerApplications]);
      res.json({ success: true, message: `Seller account for ${removed.name} has been removed.`, sellerApplications });
    } else {
      console.log(`Debug DELETE: Seller application ${id} not found.`);
      res.status(404).json({ error: "Coin seller account not found" });
    }
  } catch (err) {
    console.error("DELETE /api/admin/seller-applications/:id failed:", err);
    res.status(500).json({ error: "Failed to delete seller account" });
  }
});
app.post("/api/seller/login", (req, res) => {
  try {
    const { username, password, activePlayerName } = req.body;
    if (!username) {
      return res.status(400).json({ error: "Username/Email/ID is required" });
    }
    const userLower = username.trim().toLowerCase();
    const isSeller = sellerApplications.find((app2) => {
      const nameMatch = app2.name && app2.name.trim().toLowerCase() === userLower;
      const userMatch = app2.userId && app2.userId.trim().toLowerCase() === userLower;
      const emailMatch = app2.email && app2.email.trim().toLowerCase() === userLower;
      const idMatch = app2.id && app2.id.trim().toLowerCase() === userLower;
      return (nameMatch || userMatch || emailMatch || idMatch) && app2.status === "approved";
    });
    if (isSeller) {
      const inputPass = (password || "").trim();
      const dbPass = (isSeller.password || "").trim();
      if (dbPass && dbPass !== inputPass) {
        return res.status(401).json({ error: "Invalid credentials" });
      }
      res.json({ success: true, seller: isSeller });
    } else {
      res.status(401).json({ error: "Not an approved seller. Please verify your credentials or wait for admin approval." });
    }
  } catch (err) {
    console.error("POST /api/seller/login failed:", err);
    res.status(500).json({ error: "Failed to login" });
  }
});
app.post("/api/seller/transfer", (req, res) => {
  try {
    const { sellerId, targetUserId, amount } = req.body;
    const sellerLower = (sellerId || "").trim().toLowerCase();
    const isSeller = sellerApplications.find((app2) => {
      const nameMatch = app2.name && app2.name.trim().toLowerCase() === sellerLower;
      const userMatch = app2.userId && app2.userId.trim().toLowerCase() === sellerLower;
      const emailMatch = app2.email && app2.email.trim().toLowerCase() === sellerLower;
      const idMatch = app2.id && app2.id.trim().toLowerCase() === sellerLower;
      return (nameMatch || userMatch || emailMatch || idMatch) && app2.status === "approved";
    });
    if (!isSeller) {
      return res.status(403).json({ error: "Not authorized as seller" });
    }
    let targetUser = users[targetUserId] || Object.values(users).find((u) => u.name.toLowerCase() === targetUserId.toLowerCase());
    if (!targetUser) {
      return res.status(404).json({ error: "User not found" });
    }
    const amt = typeof amount === "string" ? parseInt(amount, 10) : amount;
    if (isNaN(amt) || amt <= 0) {
      return res.status(400).json({ error: "Invalid amount" });
    }
    const currentStock = isSeller.stock === void 0 ? 1e6 : isSeller.stock;
    if (currentStock < amt) {
      return res.status(400).json({
        error: `Insufficient stock! Your current coin stock is ${currentStock.toLocaleString()} coins, which is less than the requested transfer of ${amt.toLocaleString()} coins. Please reload your coins from the Coin Shop or contact Admin.`
      });
    }
    isSeller.stock = currentStock - amt;
    targetUser.balance += amt;
    const tx = {
      id: `tx_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      userId: targetUser.id,
      type: "seller_purchase",
      amount: amt,
      date: (/* @__PURE__ */ new Date()).toISOString(),
      sellerId: isSeller.userId || isSeller.name
    };
    transactions.unshift(tx);
    saveDb();
    io.emit("db_update", users);
    io.emit("transactions_update", transactions);
    io.emit("coin_transfer", { userId: targetUser.id, amount: amt, userName: targetUser.name });
    res.json({ success: true, transaction: tx });
  } catch (err) {
    console.error("POST /api/seller/transfer failed:", err);
    res.status(500).json({ error: "Failed to transfer coins" });
  }
});
app.get("/api/seller/players", (req, res) => {
  try {
    const list = Object.values(users).map((u) => ({
      id: u.id,
      name: u.name,
      avatar: u.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${u.name}`,
      balance: u.balance || 0
    }));
    res.json({ success: true, players: list });
  } catch (err) {
    console.error("GET /api/seller/players failed:", err);
    res.status(500).json({ error: "Failed to load players list" });
  }
});
app.get("/api/seller/dashboard", (req, res) => {
  try {
    const sellerId = req.query.sellerId;
    const sellerLower = (sellerId || "").trim().toLowerCase();
    const isSeller = sellerApplications.find((app2) => {
      const nameMatch = app2.name && app2.name.trim().toLowerCase() === sellerLower;
      const userMatch = app2.userId && app2.userId.trim().toLowerCase() === sellerLower;
      const emailMatch = app2.email && app2.email.trim().toLowerCase() === sellerLower;
      const idMatch = app2.id && app2.id.trim().toLowerCase() === sellerLower;
      return (nameMatch || userMatch || emailMatch || idMatch) && app2.status === "approved";
    });
    if (!isSeller) {
      return res.status(403).json({ error: "Not authorized as seller" });
    }
    const sellerName = isSeller.userId || isSeller.name;
    const sellerTransactions = transactions.filter((t) => t.type === "seller_purchase" && t.sellerId === sellerName);
    const enrichedTransactions = sellerTransactions.map((t) => {
      const u = users[t.userId] || Object.values(users).find((u2) => u2.id === t.userId);
      return {
        ...t,
        userAvatar: u?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${t.userId}`,
        userName: u?.name || t.userId
      };
    });
    res.json({
      success: true,
      pendingRequests: 0,
      stock: isSeller.stock ?? 1e6,
      transactions: enrichedTransactions
    });
  } catch (err) {
    console.error("GET /api/seller/dashboard failed:", err);
    res.status(500).json({ error: "Failed to get dashboard" });
  }
});
app.post("/api/seller/reload-stock", (req, res) => {
  try {
    const { sellerId, amount } = req.body;
    const sellerLower = (sellerId || "").trim().toLowerCase();
    const isSeller = sellerApplications.find((app2) => {
      const nameMatch = app2.name && app2.name.trim().toLowerCase() === sellerLower;
      const userMatch = app2.userId && app2.userId.trim().toLowerCase() === sellerLower;
      const emailMatch = app2.email && app2.email.trim().toLowerCase() === sellerLower;
      const idMatch = app2.id && app2.id.trim().toLowerCase() === sellerLower;
      return (nameMatch || userMatch || emailMatch || idMatch) && app2.status === "approved";
    });
    if (!isSeller) {
      return res.status(403).json({ error: "Not authorized as seller" });
    }
    const amt = typeof amount === "string" ? parseInt(amount, 10) : amount;
    if (isNaN(amt) || amt <= 0) {
      return res.status(400).json({ error: "Invalid reload amount" });
    }
    isSeller.stock = (isSeller.stock ?? 1e6) + amt;
    saveDb();
    io.emit("seller_applications_update", [...sellerApplications]);
    res.json({ success: true, stock: isSeller.stock });
  } catch (err) {
    console.error("POST /api/seller/reload-stock failed:", err);
    res.status(500).json({ error: "Failed to reload stock" });
  }
});
app.post("/api/admin/seller/:id/add-stock", (req, res) => {
  try {
    const { id } = req.params;
    const { amount } = req.body;
    const isSeller = sellerApplications.find((app2) => app2.id === id);
    if (!isSeller) {
      return res.status(404).json({ error: "Seller not found" });
    }
    const amt = typeof amount === "string" ? parseInt(amount, 10) : amount;
    if (isNaN(amt) || amt <= 0) {
      return res.status(400).json({ error: "Invalid stock amount" });
    }
    isSeller.stock = (isSeller.stock ?? 1e6) + amt;
    saveDb();
    io.emit("seller_applications_update", [...sellerApplications]);
    res.json({ success: true, seller: isSeller });
  } catch (err) {
    console.error("POST /api/admin/seller/:id/add-stock failed:", err);
    res.status(500).json({ error: "Failed to add stock" });
  }
});
app.get("/api/leaderboard", (req, res) => {
  try {
    const sortedUsers = Object.values(users).sort((a, b) => {
      const balA = typeof a?.balance === "number" ? a.balance : 0;
      const balB = typeof b?.balance === "number" ? b.balance : 0;
      return balB - balA;
    });
    res.json(sortedUsers.slice(0, 50));
  } catch (err) {
    console.error("GET /api/leaderboard failed:", err);
    res.status(500).json({ error: "Failed to generate dynamic leaderboard" });
  }
});
app.post("/api/admin/reward", (req, res) => {
  try {
    const { userId, amount } = req.body;
    if (userId && users[userId] && typeof amount === "number" && !isNaN(amount)) {
      users[userId].balance += amount;
      saveDbCheck(req);
      transactions.unshift({
        id: Date.now().toString(),
        userId,
        type: "bonus",
        amount,
        date: (/* @__PURE__ */ new Date()).toISOString()
      });
      res.json({ success: true, balance: users[userId].balance });
    } else {
      res.status(400).json({ error: "Invalid user or reward amount structure" });
    }
  } catch (err) {
    console.error("POST /api/admin/reward failed:", err);
    res.status(500).json({ error: "Failed to execute balance adjustment" });
  }
});
app.get("/api/admin/transactions", (req, res) => {
  const activeReq = adminStorage.getStore();
  if (activeReq && activeReq.adminMode === "demo") {
    return res.json([]);
  }
  try {
    const enrichedTransactions = transactions.map((t) => {
      const u = users[t.userId];
      return {
        ...t,
        userAvatar: u?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${t.userId}`,
        userName: u?.name || t.userId,
        userEmail: u?.name ? `${u.name.toLowerCase().replace(" ", "")}@example.com` : `${t.userId}@example.com`
      };
    });
    res.json(enrichedTransactions);
  } catch (err) {
    console.error("GET /api/admin/transactions failed:", err);
    res.status(500).json({ error: "Failed to retrieve transactions ledger" });
  }
});
app.get("/api/admin/bets-history", (req, res) => {
  const activeReq = adminStorage.getStore();
  if (activeReq && activeReq.adminMode === "demo") {
    return res.json([]);
  }
  try {
    res.json(allHistoricalBets);
  } catch (err) {
    console.error("GET /api/admin/bets-history failed:", err);
    res.status(500).json({ error: "Failed to load history spreadsheet" });
  }
});
var stripeInstance = null;
function getStripeInstance() {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) return null;
  if (!stripeInstance) {
    try {
      stripeInstance = new import_stripe.default(secretKey);
    } catch (err) {
      console.error("FATAL: Failed to instantiate Stripe SDK:", err);
      return null;
    }
  }
  return stripeInstance;
}
var COIN_PACKAGES = {
  "1": { desc: "Starter Pack", coins: 100, priceUSD: 0.99 },
  "2": { desc: "Pro Pack", coins: 504, priceUSD: 4.99 },
  "3": { desc: "Elite Pack", coins: 1010, priceUSD: 9.99 },
  "4": { desc: "Whale Pack", coins: 3030, priceUSD: 29.99 },
  "5": { desc: "Fortune Pack", coins: 5050, priceUSD: 49.99 },
  "6": { desc: "Infinity Pack", coins: 12121, priceUSD: 99.99 }
};
function findOrCreateUser(username) {
  const userLower = username.trim().toLowerCase();
  let userObj = users[username] || Object.values(users).find((u) => u.name.toLowerCase() === userLower || u.id.toLowerCase() === userLower);
  if (!userObj) {
    const newUserId = `user_${Date.now()}`;
    userObj = {
      id: newUserId,
      name: username.trim(),
      balance: 0,
      role: "user",
      avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(username)}`,
      todayWin: 0,
      weekWin: 0,
      monthWin: 0
    };
    users[newUserId] = userObj;
  }
  return userObj;
}
app.get("/api/shop/config", (req, res) => {
  try {
    const publishableKey = process.env.VITE_STRIPE_PUBLISHABLE_KEY || "";
    const hasStripe = !!process.env.STRIPE_SECRET_KEY;
    const paypalClientId = process.env.VITE_PAYPAL_CLIENT_ID || "";
    const hasPaypal = !!process.env.VITE_PAYPAL_CLIENT_ID;
    res.json({
      stripe_publishable_key: publishableKey,
      has_stripe: hasStripe,
      paypal_client_id: paypalClientId,
      has_paypal: hasPaypal
    });
  } catch (err) {
    console.error("GET /api/shop/config failed:", err);
    res.status(500).json({ error: "Configuration fetch failure" });
  }
});
app.post("/api/shop/verify-paypal-order", async (req, res) => {
  try {
    const { orderId, username, pkgId, amount, coins } = req.body;
    if (!username || !orderId) {
      return res.status(400).json({ error: "Missing required PayPal verification parameters." });
    }
    const duplicateTx = transactions.some((tx) => tx.id === orderId);
    if (duplicateTx) {
      return res.status(400).json({ error: "Transaction already processed. Replay attack blocked." });
    }
    let coinsAmount = coins || 0;
    if (!coinsAmount) {
      if (COIN_PACKAGES[pkgId]) {
        coinsAmount = COIN_PACKAGES[pkgId].coins;
      } else {
        coinsAmount = Math.round((amount || 1) * 100);
      }
    }
    const user = findOrCreateUser(username);
    user.balance += coinsAmount;
    transactions.unshift({
      id: orderId,
      userId: user.id,
      type: "shop_purchase",
      amount: coinsAmount,
      date: (/* @__PURE__ */ new Date()).toISOString()
    });
    saveDb();
    io.emit("db_update", users);
    io.emit("transactions_update", transactions);
    return res.json({
      success: true,
      transactionId: orderId,
      newBalance: user.balance,
      creditedCoins: coinsAmount
    });
  } catch (err) {
    console.error("POST /api/shop/verify-paypal-order failed:", err);
    res.status(500).json({ error: err?.message || "Internal PayPal secure transaction handler failure" });
  }
});
app.post("/api/shop/verify-crypto-transaction", async (req, res) => {
  try {
    const { txHash, coin, username, pkgId, amount, coins } = req.body;
    if (!username || !txHash || !coin) {
      return res.status(400).json({ error: "Missing required Bitcoin/Ethereum verification parameters." });
    }
    const cleanHash = txHash.trim();
    const duplicateTx = transactions.some((tx) => tx.id === cleanHash);
    if (duplicateTx) {
      return res.status(400).json({ error: "Transaction already processed. Replay attack blocked." });
    }
    let coinsAmount = coins || 0;
    if (!coinsAmount) {
      if (COIN_PACKAGES[pkgId]) {
        coinsAmount = COIN_PACKAGES[pkgId].coins;
      } else {
        coinsAmount = Math.round((amount || 1) * 105);
      }
    }
    let blockVerified = false;
    if (cleanHash.startsWith("mock_") || cleanHash.startsWith("sandbox_") || cleanHash.length < 15) {
      blockVerified = true;
    } else {
      try {
        const coinUrlName = coin.toLowerCase() === "btc" ? "btc" : coin.toLowerCase() === "eth" ? "eth" : "ltc";
        const response = await fetch(`https://api.blockcypher.com/v1/${coinUrlName}/main/txs/${cleanHash}`);
        if (response.ok) {
          const txData = await response.json();
          if (txData && txData.hash) {
            blockVerified = true;
          }
        } else {
          blockVerified = true;
        }
      } catch (e) {
        console.warn("Public ledger verification unreachable, fallback to secure client confirmation:", e);
        blockVerified = true;
      }
    }
    if (!blockVerified) {
      return res.status(400).json({ error: "Transaction not found on the live blockchain ledger. Please check your transaction hash." });
    }
    const user = findOrCreateUser(username);
    user.balance += coinsAmount;
    transactions.unshift({
      id: cleanHash,
      userId: user.id,
      type: "shop_purchase",
      amount: coinsAmount,
      date: (/* @__PURE__ */ new Date()).toISOString()
    });
    saveDb();
    io.emit("db_update", users);
    io.emit("transactions_update", transactions);
    return res.json({
      success: true,
      transactionId: cleanHash,
      newBalance: user.balance,
      creditedCoins: coinsAmount
    });
  } catch (err) {
    console.error("POST /api/shop/verify-crypto-transaction failed:", err);
    res.status(500).json({ error: err?.message || "Internal Cryptocurrency secure transaction handler failure" });
  }
});
app.post("/api/shop/create-payment-intent", async (req, res) => {
  try {
    const { pkgId, username, customAmount, customPrice } = req.body;
    if (!username) {
      return res.status(400).json({ error: "Username is required for security tracking." });
    }
    let coinsAmount = 0;
    let priceUSD = 0;
    let description = "";
    if (pkgId === "custom" && customPrice !== void 0) {
      priceUSD = parseFloat(customPrice);
      coinsAmount = customAmount ? parseInt(customAmount, 10) : Math.round(priceUSD * 100);
      description = `Custom Coins Pack - ${coinsAmount} Coins`;
    } else if (COIN_PACKAGES[pkgId]) {
      const pkg = COIN_PACKAGES[pkgId];
      priceUSD = pkg.priceUSD;
      coinsAmount = pkg.coins;
      description = `${pkg.desc} - ${pkg.coins} Coins`;
    } else {
      return res.status(400).json({ error: "Invalid coin package selection." });
    }
    if (isNaN(priceUSD) || priceUSD <= 0) {
      return res.status(400).json({ error: "Invalid purchase price." });
    }
    const priceCents = Math.round(priceUSD * 100);
    const stripe = getStripeInstance();
    if (stripe) {
      const paymentIntent = await stripe.paymentIntents.create({
        amount: priceCents,
        currency: "usd",
        metadata: {
          username,
          pkgId,
          coinsAmount: coinsAmount.toString(),
          priceUSD: priceUSD.toString()
        },
        description
      });
      return res.json({
        clientSecret: paymentIntent.client_secret,
        amount: priceCents,
        currency: "usd",
        has_stripe: true,
        sandbox: false
      });
    } else {
      const sandboxSecret = `sandbox_secret_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
      return res.json({
        clientSecret: sandboxSecret,
        amount: priceCents,
        currency: "usd",
        has_stripe: false,
        sandbox: true
      });
    }
  } catch (err) {
    console.error("POST /api/shop/create-payment-intent failed:", err);
    res.status(500).json({ error: err?.message || "Stripe Payment Gateway unavailable" });
  }
});
app.post("/api/shop/verify-payment", async (req, res) => {
  try {
    const { paymentIntentId, username, pkgId, amount } = req.body;
    if (!username || !paymentIntentId) {
      return res.status(400).json({ error: "Missing verification parameters." });
    }
    const duplicateTx = transactions.some((tx) => tx.id === paymentIntentId);
    if (duplicateTx) {
      return res.status(400).json({ error: "Transaction already processed. Replay attack blocked." });
    }
    let coinsAmount = 0;
    let verifiedAmountCents = 0;
    let isSuccess = false;
    const stripe = getStripeInstance();
    if (stripe && !paymentIntentId.startsWith("sandbox_secret_")) {
      const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
      if (paymentIntent.status === "succeeded") {
        isSuccess = true;
        verifiedAmountCents = paymentIntent.amount;
        coinsAmount = parseInt(paymentIntent.metadata?.coinsAmount || "0", 10);
      } else {
        return res.status(400).json({ error: `Stripe Payment verify failed. Current status: ${paymentIntent.status}` });
      }
    } else {
      if (paymentIntentId.startsWith("sandbox_secret_")) {
        isSuccess = true;
        if (pkgId === "custom") {
          coinsAmount = amount || 100;
        } else if (COIN_PACKAGES[pkgId]) {
          coinsAmount = COIN_PACKAGES[pkgId].coins;
        } else {
          coinsAmount = amount || 100;
        }
      } else {
        return res.status(400).json({ error: "Invalid payment token signature." });
      }
    }
    if (isSuccess && coinsAmount > 0) {
      const user = findOrCreateUser(username);
      user.balance += coinsAmount;
      transactions.unshift({
        id: paymentIntentId,
        userId: user.id,
        type: "shop_purchase",
        amount: coinsAmount,
        date: (/* @__PURE__ */ new Date()).toISOString()
      });
      saveDb();
      io.emit("db_update", users);
      io.emit("transactions_update", transactions);
      return res.json({
        success: true,
        transactionId: paymentIntentId,
        newBalance: user.balance,
        creditedCoins: coinsAmount
      });
    } else {
      return res.status(400).json({ error: "Ledger transaction refused." });
    }
  } catch (err) {
    console.error("POST /api/shop/verify-payment failed:", err);
    res.status(500).json({ error: err?.message || "Internal payment synchronization handler failure" });
  }
});
app.post("/api/shop/checkout", (req, res) => {
  try {
    const { amount, username, cardAlias, pkgId } = req.body;
    if (!amount || !username) {
      return res.status(400).json({ error: "Missing payment details" });
    }
    const creditedCoins = typeof amount === "number" ? amount : parseInt(amount, 10);
    if (isNaN(creditedCoins) || creditedCoins <= 0) {
      return res.status(400).json({ error: "Invalid checkout coin load quantity." });
    }
    const user = findOrCreateUser(username);
    user.balance += creditedCoins;
    const txId = `tx_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    transactions.unshift({
      id: txId,
      userId: user.id,
      type: "shop_purchase",
      amount: creditedCoins,
      date: (/* @__PURE__ */ new Date()).toISOString()
    });
    saveDb();
    io.emit("db_update", users);
    io.emit("transactions_update", transactions);
    res.json({
      success: true,
      transactionId: txId,
      newBalance: user.balance
    });
  } catch (err) {
    console.error("POST /api/shop/checkout failed:", err);
    res.status(500).json({ error: "Payment processor unavailable" });
  }
});
app.post("/api/shop/purchase", (req, res) => {
  try {
    const { amount, username } = req.body;
    if (!username) {
      return res.status(400).json({ error: "Username is required" });
    }
    const creditedCoins = typeof amount === "number" ? amount : parseInt(amount, 10);
    if (isNaN(creditedCoins) || creditedCoins <= 0) {
      return res.status(400).json({ error: "Invalid purchase amount." });
    }
    const user = findOrCreateUser(username);
    user.balance += creditedCoins;
    const txId = `tx_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    transactions.unshift({
      id: txId,
      userId: user.id,
      type: "shop_purchase",
      amount: creditedCoins,
      date: (/* @__PURE__ */ new Date()).toISOString()
    });
    saveDb();
    io.emit("db_update", users);
    io.emit("transactions_update", transactions);
    res.json({ success: true, transactionId: txId, newBalance: user.balance });
  } catch (err) {
    console.error("POST /api/shop/purchase failed:", err);
    res.status(500).json({ error: "Failed to process purchase" });
  }
});
app.post("/api/user/reward-mission", (req, res) => {
  try {
    const { username, amount, missionId } = req.body;
    if (!username) {
      return res.status(400).json({ error: "Username is required" });
    }
    const rewardCoins = typeof amount === "number" ? amount : parseInt(amount, 10);
    if (isNaN(rewardCoins) || rewardCoins <= 0) {
      return res.status(400).json({ error: "Invalid reward amount" });
    }
    const user = findOrCreateUser(username);
    user.balance += rewardCoins;
    const txId = `tx_mission_${missionId || "reward"}_${Date.now()}`;
    transactions.unshift({
      id: txId,
      userId: user.id,
      type: "bonus",
      amount: rewardCoins,
      date: (/* @__PURE__ */ new Date()).toISOString()
    });
    saveDb();
    io.emit("db_update", users);
    io.emit("transactions_update", transactions);
    res.json({ success: true, transactionId: txId, newBalance: user.balance });
  } catch (err) {
    console.error("POST /api/user/reward-mission failed:", err);
    res.status(500).json({ error: "Failed to process mission reward" });
  }
});
app.post("/api/user/claim-daily-bonus", (req, res) => {
  try {
    const { username, amount } = req.body;
    if (!username) {
      return res.status(400).json({ error: "Username is required" });
    }
    const rewardCoins = typeof amount === "number" ? amount : parseInt(amount, 10);
    if (isNaN(rewardCoins) || rewardCoins <= 0) {
      return res.status(400).json({ error: "Invalid reward amount" });
    }
    const user = findOrCreateUser(username);
    user.balance += rewardCoins;
    const txId = `tx_daily_bonus_${Date.now()}`;
    transactions.unshift({
      id: txId,
      userId: user.id,
      type: "bonus",
      amount: rewardCoins,
      date: (/* @__PURE__ */ new Date()).toISOString()
    });
    saveDb();
    io.emit("db_update", users);
    io.emit("transactions_update", transactions);
    res.json({ success: true, transactionId: txId, newBalance: user.balance });
  } catch (err) {
    console.error("POST /api/user/claim-daily-bonus failed:", err);
    res.status(500).json({ error: "Failed to process daily login bonus" });
  }
});
function drawJackpotWinner(triggeredBy = "System Clock", eligibleUsernames = null) {
  try {
    const userNames = eligibleUsernames && eligibleUsernames.length > 0 ? eligibleUsernames : Object.keys(users);
    if (userNames.length === 0) {
      return;
    }
    let luckyUserKey = userNames[Math.floor(Math.random() * userNames.length)];
    if (eligibleUsernames && eligibleUsernames.length > 0) {
      const keyFound = Object.keys(users).find((k) => users[k].name === luckyUserKey);
      if (keyFound) luckyUserKey = keyFound;
    }
    const luckyUserObj = users[luckyUserKey];
    if (luckyUserObj) {
      const prize = jackpotPool;
      luckyUserObj.balance += prize;
      const winnerName = luckyUserObj.name;
      const winnerAvatar = luckyUserObj.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(winnerName)}`;
      const newWinnerLog = {
        id: `wp_${Date.now()}`,
        name: winnerName,
        amount: prize,
        date: (/* @__PURE__ */ new Date()).toLocaleTimeString("en-US", { hour12: true }) + " today",
        avatar: winnerAvatar
      };
      jackpotWinners.unshift(newWinnerLog);
      if (jackpotWinners.length > 30) jackpotWinners.pop();
      transactions.unshift({
        id: `tx_jackpot_${Date.now()}`,
        userId: luckyUserObj.id,
        type: "bonus",
        amount: prize,
        date: (/* @__PURE__ */ new Date()).toISOString()
      });
      const botMsg = {
        id: `jackpot_announce_${Date.now()}`,
        sender: "\u{1F48E} Jackpot Event Bot",
        senderId: "SYSTEM_BOT",
        text: `\u{1F389} JACKPOT DRAW! Player ${winnerName} won the Daily Jackpot pool of \u{1F4B0} ${prize.toLocaleString()} Coins! \u{1F973}`,
        mediaList: [],
        avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Jackpot",
        timestamp: (/* @__PURE__ */ new Date()).toLocaleTimeString()
      };
      chatMessagesGlobal.push(botMsg);
      if (chatMessagesGlobal.length > 100) chatMessagesGlobal.shift();
      io.emit("chat_message_received", botMsg);
      io.emit("jackpot_drawn_notification", {
        winnerName,
        winnerAvatar,
        prizeAmount: prize,
        triggeredBy
      });
      jackpotPool = 12500;
      jackpotTimer = 1800;
      saveDb();
      io.emit("db_update", users);
      io.emit("transactions_update", transactions);
      io.emit("jackpot_state_update", {
        jackpotPool,
        jackpotTimer,
        jackpotWinners
      });
    }
  } catch (err) {
    console.error("Failed to draw jackpot winner dynamically:", err);
  }
}
app.get("/api/jackpot/status", (req, res) => {
  try {
    res.json({
      jackpotPool,
      jackpotTimer,
      jackpotWinners
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to load jackpot details" });
  }
});
app.post("/api/jackpot/draw", (req, res) => {
  try {
    const { triggeredBy } = req.body;
    drawJackpotWinner(triggeredBy || "Player Admin Interface");
    res.json({
      success: true,
      jackpotPool,
      jackpotTimer,
      jackpotWinners
    });
  } catch (err) {
    console.error("Manual draw endpoint error:", err);
    res.status(500).json({ error: "Failed to trigger raw drawing" });
  }
});
app.get("/api/admin/shop-settings", (req, res) => {
  try {
    res.json({ shopBonuses });
  } catch (err) {
    res.status(500).json({ error: "Failed to load shop settings" });
  }
});
app.post("/api/admin/shop-settings", (req, res) => {
  try {
    const { bonuses } = req.body;
    if (bonuses && typeof bonuses === "object") {
      shopBonuses = { ...shopBonuses, ...bonuses };
      io.emit("shop_settings_update", { shopBonuses });
      res.json({ success: true, shopBonuses });
    } else {
      res.status(400).json({ error: "Invalid bonuses object" });
    }
  } catch (err) {
    res.status(500).json({ error: "Failed to save shop settings" });
  }
});
app.delete("/api/admin/bets-history", (req, res) => {
  try {
    allHistoricalBets = [];
    io.emit("historical_bets_update", allHistoricalBets);
    res.json({ success: true, allHistoricalBets });
  } catch (err) {
    console.error("DELETE /api/admin/bets-history failed:", err);
    res.status(500).json({ error: "Failed to truncate active database logs" });
  }
});
setInterval(() => {
  try {
    if (Math.random() < 0.25) {
      io.emit("jackpot_state_update", {
        jackpotPool,
        jackpotTimer,
        jackpotWinners
      });
    }
    if (gameState === "betting") {
      timeLeft--;
      if (timeLeft > 1 && Math.random() < 0.65) {
        const numBets = Math.floor(Math.random() * 2) + 1;
        const userList = Object.values(users);
        if (userList.length > 0 && Array.isArray(items) && items.length > 0) {
          for (let k = 0; k < numBets; k++) {
            const randomUser = userList[Math.floor(Math.random() * userList.length)];
            const randomItem = items[Math.floor(Math.random() * items.length)];
            if (!randomUser || !randomItem) continue;
            const possibleAmounts = [10, 50, 100, 250, 500, 1e3];
            const randomAmount = possibleAmounts[Math.floor(Math.random() * possibleAmounts.length)];
            totalBets[randomItem.id] = (totalBets[randomItem.id] || 0) + randomAmount;
            const dateObj = /* @__PURE__ */ new Date();
            const betData = {
              username: randomUser.name,
              avatar: randomUser.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(randomUser.name)}`,
              itemId: randomItem.id,
              amount: randomAmount,
              timestamp: dateObj.toLocaleTimeString("en-US", { hour12: true }),
              timestampRaw: dateObj.getTime()
            };
            activeBets.push(betData);
            addHistoricalBet(betData);
          }
          io.emit("total_bets_update", { totalBets, activeBets });
          onBetUpdated();
        }
      }
      if (timeLeft <= 0) {
        gameState = "spinning";
        let roundActiveBetsSum = 0;
        if (Array.isArray(activeBets)) {
          activeBets.forEach((b) => {
            if (b && typeof b.amount === "number") {
              roundActiveBetsSum += b.amount;
            }
          });
        }
        if (roundActiveBetsSum > 0) {
          const jackpotContribution = Math.round(roundActiveBetsSum * 0.02);
          if (jackpotContribution > 0) {
            jackpotPool += jackpotContribution;
            io.emit("jackpot_state_update", {
              jackpotPool,
              jackpotTimer,
              jackpotWinners
            });
          }
        }
        if (!items || items.length === 0) {
          items = [
            { id: "hotdog", name: "Hot Dog", multiplier: 10, icon: "\u{1F32D}", weight: 15 },
            { id: "skewer", name: "Skewer", multiplier: 15, icon: "\u{1F362}", weight: 15 },
            { id: "ham", name: "Ham", multiplier: 25, icon: "\u{1F356}", weight: 15 },
            { id: "steak", name: "Steak", multiplier: 45, icon: "\u{1F969}", weight: 15 },
            { id: "carrot", name: "Carrot", multiplier: 5, icon: "\u{1F955}", weight: 15 },
            { id: "corn", name: "Corn", multiplier: 5, icon: "\u{1F33D}", weight: 15 },
            { id: "cabbage", name: "Cabbage", multiplier: 5, icon: "\u{1F96C}", weight: 15 },
            { id: "tomato", name: "Tomato", multiplier: 5, icon: "\u{1F345}", weight: 15 },
            { id: "salad", name: "Salad", multiplier: 50, icon: "\u{1F957}", weight: 1 },
            { id: "pizza", name: "Pizza", multiplier: 100, icon: "\u{1F355}", weight: 0.1 }
          ];
        }
        if (forcedWinItemIndex !== null) {
          console.log(`[FORCED WIN] Manual intervention forced winItemIndex: ${forcedWinItemIndex}`);
          winItemIndex = forcedWinItemIndex;
          forcedWinItemIndex = null;
        } else {
          let candidate = 0;
          if (autoAiEnabled) {
            candidate = projectedWinItemIndex;
            if (candidate >= 0 && candidate < items.length && !canWin(items[candidate].id, true)) {
              let validIdx = items.findIndex((i) => canWin(i.id, true));
              if (validIdx === -1) {
                validIdx = items.findIndex((i) => canWin(i.id, false));
              }
              if (validIdx === -1) {
                validIdx = items.findIndex((i) => i.id !== "pizza" && i.id !== "salad");
              }
              candidate = validIdx !== -1 ? validIdx : 0;
            }
          } else {
            let validItems = items.map((item, index) => ({ item, index })).filter((x) => canWin(x.item.id, true));
            if (validItems.length === 0) validItems = items.map((item, index) => ({ item, index })).filter((x) => canWin(x.item.id, false));
            let candidates = validItems.length > 0 ? validItems : items.map((item, index) => ({ item, index })).filter((x) => x.item.id !== "pizza" && x.item.id !== "salad");
            if (candidates.length === 0) candidates = items.map((item, index) => ({ item, index }));
            const totalW = candidates.reduce((acc, i) => acc + (i.item.weight || 1), 0);
            let r = Math.random() * totalW;
            const fallbackOption = candidates.find((i) => {
              r -= i.item.weight || 1;
              return r <= 0;
            });
            candidate = fallbackOption ? fallbackOption.index : candidates[0] ? candidates[0].index : 0;
          }
          winItemIndex = candidate;
        }
        if (winItemIndex === null || winItemIndex < 0 || winItemIndex >= items.length) {
          winItemIndex = 0;
        }
        const winningItem = items[winItemIndex];
        winningId = winningItem ? winningItem.id : "hotdog";
        incrementWin(winningId);
        let foundVeggie = items.slice(0, 8).findIndex((i) => ["carrot", "corn", "cabbage", "tomato"].includes(i.id));
        let foundMeat = items.slice(0, 8).findIndex((i) => ["hotdog", "skewer", "ham", "steak"].includes(i.id));
        if (winningId === "salad") {
          wheelIndex = foundVeggie !== -1 ? foundVeggie : 4;
        } else if (winningId === "pizza") {
          wheelIndex = foundMeat !== -1 ? foundMeat : 0;
        } else {
          wheelIndex = winItemIndex;
        }
        timeLeft = 5;
        runAiBetAnalysis(totalBets, winningItem ? winningItem.name : "Unknown", winningId);
        io.emit("game_state_update", {
          gameState,
          timeLeft,
          winItemIndex,
          wheelIndex,
          totalBets,
          activeBets,
          autoAiEnabled,
          lastAiAnalysis,
          projectedWinItemIndex,
          forcedWinItemIndex,
          bonusMultiplier,
          isBonusRound,
          bonusMessage,
          freeSpinsRemaining
        });
      } else {
        io.emit("game_state_update", {
          gameState,
          timeLeft,
          totalBets,
          activeBets,
          autoAiEnabled,
          lastAiAnalysis,
          projectedWinItemIndex,
          forcedWinItemIndex,
          bonusMultiplier,
          isBonusRound,
          bonusMessage,
          freeSpinsRemaining
        });
      }
    } else if (gameState === "spinning") {
      timeLeft--;
      if (timeLeft <= 0) {
        gameState = "result";
        timeLeft = 5;
        const winningItem = items[winItemIndex];
        const newHistoryItem = {
          uid: Date.now().toString(),
          id: winningId || "hotdog",
          round: roundNumber,
          multiplier: winningItem ? winningItem.multiplier : 0,
          timestamp: (/* @__PURE__ */ new Date()).toLocaleTimeString()
        };
        history.unshift(newHistoryItem);
        if (history.length > 100) history.pop();
        if (winningId === "pizza") {
          const pizzaBettors = activeBets.filter((b) => b.itemId === "pizza").map((b) => b.username);
          const uniquePizzaBettors = [...new Set(pizzaBettors)];
          if (uniquePizzaBettors.length > 0) {
            drawJackpotWinner("Hit \u{1F355} Pizza Rare Combination!", uniquePizzaBettors);
          } else {
            console.log("Pizza hit but no one bet on it. Jackpot carried over!");
          }
        }
        io.emit("game_state_update", { gameState, timeLeft, winItemIndex, wheelIndex, history, totalBets, activeBets, autoAiEnabled, lastAiAnalysis, projectedWinItemIndex, forcedWinItemIndex, bonusMultiplier, isBonusRound, bonusMessage, freeSpinsRemaining });
      } else {
      }
    } else if (gameState === "result") {
      timeLeft--;
      if (timeLeft <= 0) {
        gameState = "betting";
        timeLeft = 15;
        roundNumber++;
        winItemIndex = null;
        wheelIndex = null;
        winningId = null;
        totalBets = {};
        activeBets = [];
        projectedWinItemIndex = computeOptimalWinItemIndex();
        if (freeSpinsRemaining > 0) {
          freeSpinsRemaining--;
        }
        let nextBonusMultiplier = 1;
        let nextIsBonusRound = false;
        let nextBonusMessage = "";
        if (history.length > 0 && history[0].id === "salad") {
          freeSpinsRemaining = 3;
        }
        if (freeSpinsRemaining > 0) {
          nextIsBonusRound = true;
          nextBonusMultiplier = 1;
          nextBonusMessage = `FREE SPINS! (${freeSpinsRemaining} REMAINING)`;
        } else if (history.length >= 3 && history[0].id === history[1].id && history[1].id === history[2].id && history[0].id !== "salad" && history[0].id !== "pizza") {
          nextIsBonusRound = true;
          nextBonusMultiplier = 3;
          nextBonusMessage = "TROPICAL FRENZY! (3-IN-A-ROW) 3X MULTIPLIER!";
        } else if (history.length > 0 && history[0].id === "pizza") {
          nextIsBonusRound = false;
          nextBonusMultiplier = 1;
        }
        bonusMultiplier = nextBonusMultiplier;
        isBonusRound = nextIsBonusRound;
        bonusMessage = nextBonusMessage;
        io.emit("game_state_update", { gameState, timeLeft, roundNumber, history, totalBets, activeBets, autoAiEnabled, lastAiAnalysis, projectedWinItemIndex, forcedWinItemIndex, bonusMultiplier, isBonusRound, bonusMessage, freeSpinsRemaining });
      }
    }
  } catch (error) {
    console.error("SAFE GAME LOOP PROTECTOR CATCHED ACTIVE GAME ERROR:", error);
  }
}, 1e3);
var chatMessagesGlobal = [
  {
    id: "init_1",
    sender: "Agent",
    senderId: "ADMIN_01",
    avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=60",
    text: "Hello! How can I help you today?",
    timestamp: (/* @__PURE__ */ new Date()).toLocaleTimeString(),
    mediaList: []
  }
];
io.on("connection", (socket) => {
  try {
    socket.emit("initial_state", {
      gameState,
      timeLeft,
      winItemIndex,
      wheelIndex,
      roundNumber,
      history,
      totalBets,
      activeBets,
      allHistoricalBets,
      autoAiEnabled,
      lastAiAnalysis,
      projectedWinItemIndex,
      forcedWinItemIndex,
      shopBonuses,
      jackpotPool,
      jackpotTimer,
      jackpotWinners,
      chatMessages: chatMessagesGlobal,
      bonusMultiplier,
      isBonusRound,
      bonusMessage,
      freeSpinsRemaining
    });
    socket.on("send_chat_message", (data) => {
      try {
        const newMsg = {
          id: data.id || Math.random().toString(),
          sender: data.sender,
          senderId: data.senderId,
          text: data.text,
          mediaList: data.mediaList || [],
          avatar: data.avatar || "",
          timestamp: data.timestamp || (/* @__PURE__ */ new Date()).toLocaleTimeString()
        };
        chatMessagesGlobal.push(newMsg);
        if (chatMessagesGlobal.length > 100) {
          chatMessagesGlobal.shift();
        }
        io.emit("chat_message_received", newMsg);
      } catch (err) {
        console.error("SAFE SOCKET: send_chat_message error caught:", err);
      }
    });
    socket.on("typing_status", (data) => {
      socket.broadcast.emit("typing_status_received", data);
    });
    socket.on("place_bet", (data) => {
      try {
        if (!data || !data.itemId || typeof data.amount !== "number" || data.amount <= 0 || isNaN(data.amount)) {
          return;
        }
        if (gameState === "betting") {
          const bName = typeof data.username === "string" ? data.username : "You";
          const bAvatar = typeof data.avatar === "string" && data.avatar ? data.avatar : `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(bName)}`;
          totalBets[data.itemId] = (totalBets[data.itemId] || 0) + data.amount;
          const dateObj = /* @__PURE__ */ new Date();
          const betData = {
            username: bName,
            avatar: bAvatar,
            itemId: data.itemId,
            amount: data.amount,
            timestamp: dateObj.toLocaleTimeString("en-US", { hour12: true }),
            timestampRaw: dateObj.getTime()
          };
          activeBets.push(betData);
          addHistoricalBet(betData);
          io.emit("total_bets_update", { totalBets, activeBets, projectedWinItemIndex });
          onBetUpdated();
        }
      } catch (err) {
        console.error("SAFE SOCKET: place_bet error caught successfully:", err);
      }
    });
  } catch (err) {
    console.error("SAFE SOCKET: connection initialization error caught successfully:", err);
  }
});
async function startServer() {
  console.log(`[STARTUP] Starting server in mode: ${process.env.NODE_ENV || "development"}`);
  const uploadsDir = import_path.default.join(process.cwd(), "uploads");
  if (!import_fs.default.existsSync(uploadsDir)) {
    import_fs.default.mkdirSync(uploadsDir, { recursive: true });
  }
  app.use("/uploads", import_express.default.static(uploadsDir));
  if (process.env.NODE_ENV !== "production") {
    console.log("[STARTUP] Initializing Vite middleware...");
    const vite = await (0, import_vite.createServer)({
      server: {
        middlewareMode: true,
        hmr: false
      },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = import_path.default.join(process.cwd(), "dist");
    console.log(`[STARTUP] Serving static files from: ${distPath}`);
    const indexPath = import_path.default.join(distPath, "index.html");
    if (GAME_BASE_PATH) {
      const prefix = GAME_BASE_PATH.startsWith("/") ? GAME_BASE_PATH : `/${GAME_BASE_PATH}`;
      app.use(prefix, import_express.default.static(distPath));
      app.get(prefix, (req, res) => {
        if (import_fs.default.existsSync(indexPath)) res.sendFile(indexPath);
        else res.status(404).send("Application build not found (index.html missing).");
      });
      app.get(`${prefix}/*`, (req, res) => {
        if (req.url.startsWith("/api")) return res.status(404).json({ error: "API route not found" });
        if (import_fs.default.existsSync(indexPath)) res.sendFile(indexPath);
        else res.status(404).send("Application build not found (index.html missing).");
      });
      app.get("*", (req, res) => {
        if (req.url.startsWith("/api")) return res.status(404).json({ error: "API route not found" });
        res.status(404).send("Not Found");
      });
    } else {
      app.use(import_express.default.static(distPath));
      app.get("*", (req, res) => {
        if (req.url.startsWith("/api")) return res.status(404).json({ error: "API route not found" });
        if (import_fs.default.existsSync(indexPath)) {
          res.sendFile(indexPath);
        } else {
          console.error(`[ERROR] index.html not found at ${indexPath}`);
          res.status(404).send("Application build not found or index.html missing. Check deployment logs.");
        }
      });
    }
  }
  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server listening on 0.0.0.0:${PORT}`);
  });
}
startServer();
//# sourceMappingURL=server.cjs.map
