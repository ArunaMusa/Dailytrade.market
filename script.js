// Audio Setup
const sounds = {
  buySell: new Audio('buy-sell.mp3'),
  profit: new Audio('profit.mp3'),
  loss: new Audio('loss.mp3'),
  insufficient: new Audio('insufficient.mp3'),
  priceChange: new Audio('price-change.mp3')
};

function showNotification(message, color = 'blue') {
  const notif = document.createElement("div");
  notif.textContent = message;
  notif.style.cssText = `
    position: fixed; bottom: 20px; right: 20px; background: ${color}; 
    color: white; padding: 10px 20px; border-radius: 5px; z-index: 9999;
    font-weight: bold;
  `;
  document.body.appendChild(notif);
  setTimeout(() => notif.remove(), 4000);
}

// Initial Setup
let userBalance = parseFloat(localStorage.getItem("userBalance")) || 0.00;
let trades = JSON.parse(localStorage.getItem("trades")) || [];
let currentPrice = parseFloat(localStorage.getItem("currentPrice")) || 20.00;
let previousPrice = parseFloat(localStorage.getItem("previousPrice")) || currentPrice;
let lastGenerated = parseInt(localStorage.getItem("lastGenerated")) || 0;
let userName = localStorage.getItem("userName") || "";
let sessionTrades = parseInt(localStorage.getItem("sessionTrades")) || 0;
let refundGiven = localStorage.getItem("refundGiven") === "true";
let buyCount = parseInt(localStorage.getItem("buyCount")) || 0;
let sellCount = parseInt(localStorage.getItem("sellCount")) || 0;
const maxTradesPerSession = 8;
const fundAmount = 25;
let isMarketOpen = false;

// Username Setup
document.getElementById("submitUsername").addEventListener("click", () => {
  const input = document.getElementById("userNameInput").value.trim();
  if (input) {
    userName = input;
    localStorage.setItem("userName", userName);
    document.getElementById("usernameDisplay").textContent = `Trader: ${userName}`;
    document.getElementById("userInputSection").style.display = "none";
  }
});
if (userName) {
  document.getElementById("usernameDisplay").textContent = `Trader: ${userName}`;
  document.getElementById("userInputSection").style.display = "none";
}

// Time + Market Session
function isWithinTradingHours() {
  const now = new Date();
  const hour = now.getHours();
  return (hour >= 9 && hour < 14) || (hour >= 16 && hour < 24);
}

function updateMarketStatus() {
  const now = new Date();
  isMarketOpen = isWithinTradingHours();
  const status = document.getElementById("marketStatus");
  const timer = document.getElementById("sessionTimer");

  let nextEvent = new Date(now);
  if (isMarketOpen) {
    status.textContent = "Market: Open 🟢";
    if (now.getHours() < 14) nextEvent.setHours(14, 0, 0);
    else nextEvent.setHours(23, 59, 59);
    timer.textContent = `Market closes in: ${formatTimeDiff(nextEvent - now)}`;
  } else {
    status.textContent = "Market: Closed 🔴";
    if (now.getHours() < 9) nextEvent.setHours(9, 0, 0);
    else if (now.getHours() < 16) nextEvent.setHours(16, 0, 0);
    else {
      nextEvent.setDate(now.getDate() + 1);
      nextEvent.setHours(9, 0, 0);
    }
    timer.textContent = `Market opens in: ${formatTimeDiff(nextEvent - now)}`;

    trades.forEach(t => {
      if (t.type === "Buy" && t.outcome === "Pending") t.outcome = "Loss";
    });
    localStorage.setItem("trades", JSON.stringify(trades));
    updateTradeHistory();
  }
}

function formatTimeDiff(ms) {
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${m}m ${s}s`;
}

// Systematic Price Update
function updatePrice() {
  const now = Date.now();
  if (now - lastGenerated >= 10 * 60 * 1000 || lastGenerated === 0) {
    lastGenerated = now;
    previousPrice = currentPrice;
    const change = (Math.random() * 2 - 1).toFixed(2);
    currentPrice = Math.max(1, parseFloat((currentPrice + parseFloat(change)).toFixed(2)));
    localStorage.setItem("lastGenerated", lastGenerated);
    localStorage.setItem("currentPrice", currentPrice);
    localStorage.setItem("previousPrice", previousPrice);

    // Notify price update
    sounds.priceChange.play();
    showNotification("Price has been updated!", "purple");
  }
  displayPrices();
}

function displayPrices() {
  document.getElementById("prevPriceBox").textContent = `Previous Price: NLE ${previousPrice.toFixed(2)}`;
  document.getElementById("currPriceBox").textContent = `Current Price: NLE ${currentPrice.toFixed(2)}`;
  const trend = document.getElementById("trendBox");
  if (currentPrice > previousPrice) {
    trend.textContent = "Trend: Upward 📈";
    trend.style.color = "green";
  } else if (currentPrice < previousPrice) {
    trend.textContent = "Trend: Downward 📉";
    trend.style.color = "red";
  } else {
    trend.textContent = "Trend: Stable ➖";
    trend.style.color = "gray";
  }

  const estimatedDTC = (userBalance / 20).toFixed(2);
  document.getElementById("balance").textContent = `Balance: NLE ${userBalance.toFixed(2)} | Est. DTC: ${estimatedDTC}`;
}

// Trade Logic
function buy() {
  if (!userName) return alert("Enter your name before trading.");
  if (!isMarketOpen) return alert("Market is closed.");
  if (userBalance < currentPrice) {
    sounds.insufficient.play();
    showNotification("Insufficient balance!", "red");
    return;
  }
  if (sessionTrades >= maxTradesPerSession) return alert("Max trades reached.");
  if (buyCount > sellCount) return alert("Sell previous buy first.");

  userBalance -= currentPrice;
  trades.push({ type: "Buy", price: currentPrice, outcome: "Pending" });
  buyCount++;
  sessionTrades++;
  persist();
  updateUI();

  sounds.buySell.play();
  showNotification("Buy trade placed!", "green");
}

function sell() {
  if (!userName) return alert("Enter your name before trading.");
  if (!isMarketOpen) return alert("Market is closed.");

  const lastTrade = trades[trades.length - 1];
  if (!lastTrade || lastTrade.type !== "Buy" || lastTrade.outcome !== "Pending") {
    return alert("You must buy first.");
  }

  const profit = currentPrice > lastTrade.price;
  const outcome = profit ? "Profit" : "Loss";
  const diff = Math.abs(currentPrice - lastTrade.price);

  userBalance += profit ? lastTrade.price + diff : lastTrade.price - diff;
  lastTrade.outcome = outcome;
  trades.push({ type: "Sell", price: currentPrice, outcome });
  sellCount++;
  sessionTrades++;
  persist();
  updateUI();

  sounds.buySell.play();
  showNotification("Sell trade completed!", "green");

  if (profit) {
    sounds.profit.play();
    showNotification("Profit made!", "green");
  } else {
    sounds.loss.play();
    showNotification("You made a loss.", "red");
  }
}

// Withdrawal Receipt
document.getElementById("withdrawBtn").addEventListener("click", () => {
  const name = document.getElementById("userFullName").value.trim();
  const addr = document.getElementById("userAddress").value.trim();
  const phone = document.getElementById("userPhone").value.trim();
  const amount = parseFloat(document.getElementById("withdrawAmount").value);
  const img = document.getElementById("userImage").files[0];

  if (!name || !addr || !phone || !amount || !img) {
    alert("Please complete all fields and upload an image.");
    return;
  }
  if (amount < 150 || amount > 250) {
    alert("Withdrawal must be between NLE 150 and NLE 250.");
    return;
  }

  alert(`Withdrawal of NLE ${amount.toFixed(2)} processed. This is your receipt.`);
});

// Fund Me
document.getElementById("fundMeBtn").addEventListener("click", () => {
  if (userBalance < 25 && !refundGiven) {
    userBalance += fundAmount;
    refundGiven = true;
    localStorage.setItem("refundGiven", "true");
    persist();
    alert("You've received NLE 25.00.");
  } else if (userBalance >= 25) {
    alert("You already have enough funds.");
  } else {
    alert("Fund Me is only available when your balance is below NLE 25.00.");
  }
});

// Trade History
document.getElementById("toggleTradeHistory").addEventListener("click", () => {
  const history = document.getElementById("tradeHistoryContainer");
  history.style.display = history.style.display === "none" ? "block" : "none";
});

function updateTradeHistory() {
  const container = document.getElementById("tradeHistoryContainer");
  container.innerHTML = trades.map(t => {
    const color = t.outcome === "Profit" ? "green" : t.outcome === "Loss" ? "red" : "yellow";
    return `<div style="color:${color}">${t.type} at NLE ${t.price.toFixed(2)} — ${t.outcome}</div>`;
  }).join("");
}

// Utility
function persist() {
  localStorage.setItem("userBalance", userBalance);
  localStorage.setItem("trades", JSON.stringify(trades));
  localStorage.setItem("buyCount", buyCount);
  localStorage.setItem("sellCount", sellCount);
  localStorage.setItem("sessionTrades", sessionTrades);
}

function updateUI() {
  displayPrices();
  updateTradeHistory();
}

// Event Bindings
document.getElementById("buyBtn").addEventListener("click", buy);
document.getElementById("sellBtn").addEventListener("click", sell);

// Loops
setInterval(updateMarketStatus, 1000);
setInterval(updatePrice, 1000);
setInterval(() => {
  document.getElementById("datetime").textContent = new Date().toLocaleString();
}, 1000);

// Init
updateMarketStatus();
updatePrice();
updateUI();
