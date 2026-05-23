// --- BASE DE DATOS MÚLTIPLES ACTIVOS ---
const assetsDB = [
    { id: 'eurusd', name: 'EUR/USD', payout: 0.85, basePrice: 1.08550, volatility: 0.00010 },
    { id: 'gbpjpy', name: 'GBP/JPY', payout: 0.82, basePrice: 150.250, volatility: 0.01500 },
    { id: 'crypto', name: 'Crypto Idx', payout: 0.88, basePrice: 45000.5, volatility: 15.0000 },
    { id: 'gold', name: 'Gold OTC', payout: 0.90, basePrice: 2340.10, volatility: 1.5000 }
];

let activeTabs = [0, 1, 2]; 
let activeAssetIndex = 0; 
const MAX_HISTORY = 50;

// Inicialización de historial y animación suave (easing)
assetsDB.forEach(asset => {
    asset.history = [];
    asset.currentPrice = asset.basePrice;
    asset.targetPrice = asset.basePrice;
    for(let i=0; i<MAX_HISTORY; i++) {
        asset.currentPrice += (Math.random() - 0.5) * asset.volatility;
        asset.history.push(asset.currentPrice);
    }
});

// --- ESTADO GLOBAL ---
let state = {
    account: 'practice',
    balancePrac: 10000.00,
    balanceReal: 0.00,
    amount: 1000,
    duration: 60,
    activeTrades: [],
    closedTrades: []
};

// --- UI Y PANELES ---
const formatMoney = (val, real = false) => (real ? 'COL$ ' : '$') + val.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2});

function renderTabs() {
    const container = document.getElementById('tabs-container');
    container.innerHTML = '';
    activeTabs.forEach(assetIdx => {
        const asset = assetsDB[assetIdx];
        const tab = document.createElement('div');
        tab.className = `tab ${assetIdx === activeAssetIndex ? 'active' : ''}`;
        tab.innerHTML = `<span>${asset.name}</span> <span class="payout">${(asset.payout * 100)}%</span>`;
        tab.onclick = () => {
            activeAssetIndex = assetIdx;
            document.getElementById('chart-title-overlay').innerText = asset.name;
            renderTabs(); updateUI();
        };
        container.appendChild(tab);
    });
}

function updateUI() {
    const isReal = state.account === 'real';
    const bal = isReal ? state.balanceReal : state.balancePrac;
    const asset = assetsDB[activeAssetIndex];
    
    document.getElementById('header-balance').innerText = formatMoney(bal, isReal);
    document.getElementById('header-balance').style.color = isReal ? 'var(--green)' : 'var(--orange)';
    document.getElementById('header-type').innerText = isReal ? 'REAL' : 'PRÁCTICA';
    
    document.getElementById('pop-real-bal').innerText = formatMoney(state.balanceReal, true);
    document.getElementById('pop-prac-bal').innerText = formatMoney(state.balancePrac, false);
    document.getElementById('check-real').style.display = isReal ? 'block' : 'none';
    document.getElementById('check-prac').style.display = !isReal ? 'block' : 'none';

    document.getElementById('display-amount').innerText = `$${state.amount.toLocaleString()}`;
    document.getElementById('numpad-display').innerText = `$${state.amount.toLocaleString()}`;
    
    const profit = state.amount * asset.payout;
    document.getElementById('display-profit-val').innerText = `+$${profit.toLocaleString('en-US', {minimumFractionDigits: 2})}`;
    document.getElementById('display-profit-pct').innerText = `${(asset.payout * 100)}%`;
    
    document.querySelectorAll('.dyn-prof').forEach(el => el.innerText = `${(asset.payout * 100)}%`);
    updatePortfolioUI();
    updateHistoryUI();
}

function openPanel(id) {
    closeAllPanels();
    document.getElementById('overlay-bg').classList.add('active');
    document.getElementById(id).classList.add('active');
}

function closeAllPanels() {
    document.getElementById('overlay-bg').classList.remove('active');
    document.querySelectorAll('.slide-panel').forEach(p => p.classList.remove('active'));
}

// --- INTERACCIONES Y TECLADO ---
let numpadStr = "";
function typeNumpad(val) {
    if(val === 'del') numpadStr = numpadStr.slice(0, -1);
    else if(numpadStr.length < 7) numpadStr += val;
    setAmount(parseFloat(numpadStr) || 0, false);
}
function setAmount(val, resetStr = true) {
    state.amount = val; if(resetStr) numpadStr = val.toString(); updateUI();
}
function setTime(sec, label) {
    state.duration = sec; document.getElementById('display-time').innerText = label; closeAllPanels();
}
function switchAccount(type) {
    state.account = type; updateUI(); closeAllPanels(); showToast(`Cambiado a Cuenta ${type === 'real' ? 'Real' : 'de Práctica'}`, true, 'info');
}
function reloadPractice() {
    state.balancePrac = 10000; updateUI(); closeAllPanels(); showToast('Cuenta recargada', true);
}
function depositReal(amount) {
    state.balanceReal += amount; updateUI(); closeAllPanels(); showToast(`Depósito de COL$ ${amount.toLocaleString()} exitoso`, true);
}
function toggleIndicator(name) {
    showToast(`Indicador ${name} aplicado`, true, 'info'); closeAllPanels();
}

// --- TOASTS (Notificaciones Animadas) ---
function showToast(msg, isWin, type='normal') {
    const c = document.getElementById('toast-container');
    const t = document.createElement('div');
    t.className = `toast ${type === 'info' ? 'info' : (isWin ? 'win' : 'loss')}`;
    t.innerText = msg;
    c.appendChild(t);
    setTimeout(() => { t.style.animation = 'fadeOut 0.3s forwards'; setTimeout(() => t.remove(), 300); }, 3000);
}

// --- LÓGICA DE TRADING EN VIVO ---
function triggerTrade(dir) {
    const currentBal = state.account === 'real' ? state.balanceReal : state.balancePrac;
    if(currentBal < state.amount || state.amount <= 0) { showToast('Saldo insuficiente', false); return; }

    const asset = assetsDB[activeAssetIndex];
    if(state.account === 'real') state.balanceReal -= state.amount; else state.balancePrac -= state.amount;
    
    const trade = {
        id: Math.random().toString(36).substr(2, 5),
        assetIndex: activeAssetIndex,
        dir: dir, amount: state.amount,
        strikePrice: asset.currentPrice,
        payout: asset.payout,
        timeLeft: state.duration,
        account: state.account
    };
    state.activeTrades.push(trade);
    updateUI();
    showToast(`Orden: ${dir === 'CALL' ? 'SUBE' : 'BAJA'} a ${asset.currentPrice.toFixed(4)}`, true, 'info');
}

function updatePortfolioUI() {
    const portEl = document.getElementById('portfolio-content');
    if(state.activeTrades.length === 0) { portEl.innerHTML = "Sin operaciones activas."; return; }
    let html = '';
    state.activeTrades.forEach(t => {
        html += `<div style="display:flex; justify-content:space-between; padding:10px; border-bottom:1px solid var(--border); color:white;">
            <div style="text-align:left;"><b>${assetsDB[t.assetIndex].name}</b><br><span style="color:${t.dir==='CALL'?'var(--green)':'var(--red)'}">${t.dir}</span> | $${t.amount}</div>
            <div style="text-align:right;"><b>${t.timeLeft}s</b><br>Strike: ${t.strikePrice.toFixed(4)}</div></div>`;
    });
    portEl.innerHTML = html;
}

function updateHistoryUI() {
    const histEl = document.getElementById('history-content');
    if(state.closedTrades.length === 0) { histEl.innerHTML = "Historial vacío."; return; }
    let html = '';
    [...state.closedTrades].reverse().slice(0, 10).forEach(t => {
        html += `<div style="display:flex; justify-content:space-between; padding:10px; border-bottom:1px solid var(--border); color:white;">
            <div style="text-align:left;"><b>${assetsDB[t.assetIndex].name}</b><br><span style="color:${t.dir==='CALL'?'var(--green)':'var(--red)'}">${t.dir}</span></div>
            <div style="text-align:right;"><span style="color:${t.profit > 0 ? 'var(--green)' : 'var(--red)'}; font-weight:bold;">${t.profit > 0 ? '+' : ''}$${t.profit.toFixed(2)}</span></div></div>`;
    });
    histEl.innerHTML = html;
}

// --- MOTOR DE MERCADO (TICK CADA 1.5s) ---
setInterval(() => {
    assetsDB.forEach(asset => {
        asset.targetPrice = asset.currentPrice + ((Math.random() - 0.5) * asset.volatility);
        asset.history.shift();
        asset.history.push(asset.targetPrice);
    });

    for(let i = state.activeTrades.length - 1; i >= 0; i--) {
        const t = state.activeTrades[i];
        t.timeLeft--;
        if(t.timeLeft <= 0) {
            const finalAsset = assetsDB[t.assetIndex];
            let isWin = false;
            if(t.dir === 'CALL' && finalAsset.targetPrice > t.strikePrice) isWin = true;
            if(t.dir === 'PUT' && finalAsset.targetPrice < t.strikePrice) isWin = true;

            let profitAmount = 0;
            if(isWin) {
                profitAmount = t.amount * t.payout;
                const totalReturn = t.amount + profitAmount;
                if(t.account === 'real') state.balanceReal += totalReturn; else state.balancePrac += totalReturn;
                showToast(`¡Ganancia! +$${profitAmount.toLocaleString()}`, true);
            } else {
                profitAmount = -t.amount;
                showToast('Operación sin beneficio', false);
            }
            
            t.profit = profitAmount;
            state.closedTrades.push(t);
            state.activeTrades.splice(i, 1);
        }
    }
    updateUI();
}, 1500);

// --- RENDERIZADO DEL GRÁFICO (60FPS SMOOTH) ---
const canvas = document.getElementById('chart');
const ctx = canvas.getContext('2d');
let width, height;

function resizeCanvas() {
    const dpr = window.devicePixelRatio || 1;
    width = canvas.parentElement.clientWidth; height = canvas.parentElement.clientHeight;
    canvas.width = width * dpr; canvas.height = height * dpr;
    ctx.scale(dpr, dpr);
}
window.addEventListener('resize', resizeCanvas);

function drawChart() {
    ctx.clearRect(0, 0, width, height);
    const asset = assetsDB[activeAssetIndex];
    
    // Easing smooth para la gráfica
    asset.currentPrice += (asset.targetPrice - asset.currentPrice) * 0.1;
    let visualHistory = [...asset.history];
    visualHistory[visualHistory.length - 1] = asset.currentPrice;

    const min = Math.min(...visualHistory); const max = Math.max(...visualHistory);
    const range = (max - min) || 1;
    const finalMin = min - (range * 0.1); const finalMax = max + (range * 0.1);
    const finalRange = finalMax - finalMin;

    ctx.strokeStyle = 'rgba(255,255,255,0.03)'; ctx.lineWidth = 1;
    for(let i=0; i<width; i+=60) { ctx.beginPath(); ctx.moveTo(i,0); ctx.lineTo(i,height); ctx.stroke(); }
    for(let i=0; i<height; i+=40) { ctx.beginPath(); ctx.moveTo(0,i); ctx.lineTo(width,i); ctx.stroke(); }

    state.activeTrades.forEach(t => {
        if(t.assetIndex !== activeAssetIndex) return;
        const y = height - ((t.strikePrice - finalMin) / finalRange) * height;
        ctx.beginPath(); ctx.strokeStyle = t.dir === 'CALL' ? '#26b948' : '#ff4b4b';
        ctx.lineWidth = 1; ctx.setLineDash([4, 4]);
        ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke(); ctx.setLineDash([]);
    });

    ctx.beginPath();
    const isUp = visualHistory[visualHistory.length-1] >= visualHistory[visualHistory.length-10];
    ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 2; ctx.lineJoin = 'round';

    let lastX, lastY;
    for(let i=0; i<visualHistory.length; i++) {
        const x = (i / (visualHistory.length - 1)) * (width - 50); 
        const y = height - ((visualHistory[i] - finalMin) / finalRange) * height;
        if(i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        if(i === visualHistory.length - 1) { lastX = x; lastY = y; }
    }
    ctx.stroke();

    ctx.lineTo(lastX, height); ctx.lineTo(0, height);
    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, 'rgba(255, 255, 255, 0.15)'); grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = grad; ctx.fill();

    ctx.beginPath(); ctx.strokeStyle = isUp ? 'rgba(38, 185, 72, 0.8)' : 'rgba(255, 75, 75, 0.8)';
    ctx.lineWidth = 1; ctx.setLineDash([3, 3]);
    ctx.moveTo(lastX, lastY); ctx.lineTo(width, lastY); ctx.stroke(); ctx.setLineDash([]);

    ctx.beginPath(); ctx.arc(lastX, lastY, 4, 0, Math.PI*2);
    ctx.fillStyle = isUp ? '#26b948' : '#ff4b4b'; ctx.fill();
    ctx.shadowBlur = 8; ctx.shadowColor = ctx.fillStyle; ctx.fill(); ctx.shadowBlur = 0;

    ctx.fillStyle = ctx.fillStyle; ctx.fillRect(width - 50, lastY - 10, 50, 20);
    ctx.beginPath(); ctx.moveTo(width - 50, lastY - 10); ctx.lineTo(width - 56, lastY); ctx.lineTo(width - 50, lastY + 10); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = 'bold 10px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(asset.currentPrice.toFixed(4), width - 25, lastY + 3); ctx.textAlign = 'left';

    requestAnimationFrame(drawChart);
}

// --- INICIO ---
renderTabs();
resizeCanvas();
updateUI();
requestAnimationFrame(drawChart);
