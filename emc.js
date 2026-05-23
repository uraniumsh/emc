// --- BASE DE DATOS DE ACTIVOS MÚLTIPLES ---
const assetsDB = [
    { id: 'eurusd', name: 'EUR/USD', payout: 0.85, price: 1.08550, history: [], volatility: 0.00010 },
    { id: 'gbpjpy', name: 'GBP/JPY', payout: 0.82, price: 150.250, history: [], volatility: 0.01500 },
    { id: 'crypto', name: 'Crypto Idx', payout: 0.88, price: 45000.5, history: [], volatility: 10.5000 },
    { id: 'gold', name: 'Gold OTC', payout: 0.90, price: 2340.10, history: [], volatility: 1.2000 }
];
let activeAssetIndex = 0;
const MAX_HISTORY = 60; // Puntos en el gráfico

// Inicializar historiales de cada activo
assetsDB.forEach(asset => {
    let currentPrice = asset.price;
    for(let i=0; i<MAX_HISTORY; i++) {
        currentPrice += (Math.random() - 0.5) * asset.volatility;
        asset.history.push(currentPrice);
    }
    asset.price = currentPrice;
});

// --- ESTADO GLOBAL ---
let state = {
    account: 'practice',
    balancePrac: 10000.00,
    balanceReal: 0.00,
    amount: 1000,
    duration: 60, // Segundos
    activeTrades: []
};

// --- RENDERIZADO DE TABS ---
function renderTabs() {
    const container = document.getElementById('tabs-container');
    container.innerHTML = '';
    assetsDB.forEach((asset, index) => {
        const tab = document.createElement('div');
        tab.className = `tab ${index === activeAssetIndex ? 'active' : ''}`;
        tab.innerHTML = `${asset.name} <span class="payout">${(asset.payout * 100)}%</span>`;
        tab.onclick = () => {
            activeAssetIndex = index;
            document.getElementById('chart-title-overlay').innerText = asset.name;
            renderTabs();
            updateUI();
        };
        container.appendChild(tab);
    });
}

// --- ACTUALIZACIÓN UI Y PANELES ---
const formatMoney = (val, real = false) => (real ? 'COL$ ' : '$') + val.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2});

function updateUI() {
    const isReal = state.account === 'real';
    const bal = isReal ? state.balanceReal : state.balancePrac;
    const asset = assetsDB[activeAssetIndex];
    
    // Header
    document.getElementById('header-balance').innerText = formatMoney(bal, isReal);
    document.getElementById('header-balance').style.color = isReal ? 'var(--green)' : 'var(--orange)';
    document.getElementById('header-type').innerText = isReal ? 'REAL' : 'PRÁCTICA';
    
    // Panel Cuentas
    document.getElementById('pop-real-bal').innerText = formatMoney(state.balanceReal, true);
    document.getElementById('pop-prac-bal').innerText = formatMoney(state.balancePrac, false);
    document.getElementById('check-real').style.display = isReal ? 'block' : 'none';
    document.getElementById('check-prac').style.display = !isReal ? 'block' : 'none';

    // Panel Inversión
    document.getElementById('display-amount').innerText = `$${state.amount.toLocaleString()}`;
    document.getElementById('numpad-display').innerText = `$${state.amount.toLocaleString()}`;
    
    // Beneficios y Porcentajes
    const profit = state.amount * asset.payout;
    document.getElementById('display-profit-val').innerText = `+$${profit.toLocaleString('en-US', {minimumFractionDigits: 2})}`;
    document.getElementById('display-profit-pct').innerText = `${(asset.payout * 100)}%`;
    
    document.getElementById('t-prof-1').innerText = `${(asset.payout * 100)}%`;
    document.getElementById('t-prof-2').innerText = `${(asset.payout * 100)}%`;
    document.getElementById('t-prof-3').innerText = `${(asset.payout * 100)}%`;

    updatePortfolioUI();
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

// --- INTERACCIONES Y BOTONES ---
let numpadStr = "";
function typeNumpad(val) {
    if(val === 'del') numpadStr = numpadStr.slice(0, -1);
    else if(numpadStr.length < 7) numpadStr += val;
    setAmount(parseFloat(numpadStr) || 0, false);
}
function setAmount(val, resetStr = true) {
    state.amount = val;
    if(resetStr) numpadStr = val.toString();
    updateUI();
}
function setTime(sec, label) {
    state.duration = sec;
    document.getElementById('display-time').innerText = label;
    closeAllPanels();
}
function switchAccount(type) {
    state.account = type; updateUI(); closeAllPanels(); showToast(`Cuenta cambiada a ${type.toUpperCase()}`, true);
}
function reloadPractice() {
    state.balancePrac = 10000; updateUI(); closeAllPanels(); showToast('Cuenta de práctica recargada', true);
}
function depositReal(amount) {
    state.balanceReal += amount; updateUI(); closeAllPanels(); showToast(`Depósito de COL$ ${amount.toLocaleString()} exitoso`, true);
}

// --- TOASTS ANIMADOS ---
function showToast(msg, isWin) {
    const c = document.getElementById('toast-container');
    const t = document.createElement('div');
    t.className = `toast ${isWin ? 'win' : 'loss'}`;
    t.innerText = msg;
    c.appendChild(t);
    setTimeout(() => { t.style.animation = 'fadeOut 0.3s forwards'; setTimeout(() => t.remove(), 300); }, 3000);
}

// --- LÓGICA DE TRADING REALISTA ---
function triggerTrade(dir) {
    const currentBal = state.account === 'real' ? state.balanceReal : state.balancePrac;
    if(currentBal < state.amount || state.amount <= 0) {
        showToast('Saldo insuficiente', false); return;
    }

    const asset = assetsDB[activeAssetIndex];
    if(state.account === 'real') state.balanceReal -= state.amount;
    else state.balancePrac -= state.amount;
    
    const trade = {
        id: Math.random().toString(36).substr(2, 5),
        assetIndex: activeAssetIndex,
        dir: dir,
        amount: state.amount,
        strikePrice: asset.price,
        payout: asset.payout,
        timeLeft: state.duration, // Segundos reales
        account: state.account
    };
    state.activeTrades.push(trade);
    updateUI();
    closeAllPanels();
    showToast(`Orden Abierta: ${dir === 'CALL' ? 'SUBE' : 'BAJA'} a ${asset.price.toFixed(4)}`, true);
}

function updatePortfolioUI() {
    const portEl = document.getElementById('portfolio-content');
    if(state.activeTrades.length === 0) {
        portEl.innerHTML = "No hay operaciones activas en este momento.";
        return;
    }
    let html = '';
    state.activeTrades.forEach(t => {
        html += `<div style="display:flex; justify-content:space-between; padding:10px; border-bottom:1px solid var(--border); color:white;">
            <div style="text-align:left;">
                <span style="font-weight:bold;">${assetsDB[t.assetIndex].name}</span><br>
                <span style="color:${t.dir==='CALL'?'var(--green)':'var(--red)'}">${t.dir}</span> | $${t.amount}
            </div>
            <div style="text-align:right;">
                <span style="font-size:16px; font-weight:bold;">${t.timeLeft}s</span><br>
                <span>Strike: ${t.strikePrice.toFixed(4)}</span>
            </div>
        </div>`;
    });
    portEl.innerHTML = html;
}

// --- MOTOR DEL GRÁFICO (TIEMPO REAL LENTO) ---
setInterval(() => {
    // 1. Mover todos los mercados cada 1 segundo (Tick Realista)
    assetsDB.forEach(asset => {
        const change = (Math.random() - 0.5) * asset.volatility;
        asset.price += change;
        asset.history.shift();
        asset.history.push(asset.price);
    });

    // 2. Procesar Trades Activos (Temporizador real en segundos)
    for(let i = state.activeTrades.length - 1; i >= 0; i--) {
        const t = state.activeTrades[i];
        t.timeLeft--;
        if(t.timeLeft <= 0) {
            const finalAsset = assetsDB[t.assetIndex];
            let isWin = false;
            if(t.dir === 'CALL' && finalAsset.price > t.strikePrice) isWin = true;
            if(t.dir === 'PUT' && finalAsset.price < t.strikePrice) isWin = true;

            if(isWin) {
                const profit = t.amount * (1 + t.payout);
                if(t.account === 'real') state.balanceReal += profit;
                else state.balancePrac += profit;
                showToast(`¡Ganancia! +${formatMoney(profit - t.amount, t.account==='real')}`, true);
            } else {
                showToast('Operación cerrada sin beneficio', false);
            }
            state.activeTrades.splice(i, 1);
        }
    }
    updateUI(); // Refresca saldos y portafolio si algo cambió
}, 1000); // 1 Tick por Segundo

// --- RENDERIZADO FLUIDO (CANVAS 60FPS) ---
const canvas = document.getElementById('chart');
const ctx = canvas.getContext('2d');
let width, height;

function resizeCanvas() {
    const dpr = window.devicePixelRatio || 1;
    width = canvas.parentElement.clientWidth;
    height = canvas.parentElement.clientHeight;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);
}
window.addEventListener('resize', resizeCanvas);

function drawChart() {
    ctx.clearRect(0, 0, width, height);
    
    const asset = assetsDB[activeAssetIndex];
    const hist = asset.history;
    const min = Math.min(...hist);
    const max = Math.max(...hist);
    const range = (max - min) || 1;
    const padding = height * 0.2; 
    const finalMin = min - (range * 0.1);
    const finalMax = max + (range * 0.1);
    const finalRange = finalMax - finalMin;

    // Cuadrícula sutil
    ctx.strokeStyle = 'rgba(255,255,255,0.03)';
    ctx.lineWidth = 1;
    for(let i=0; i<width; i+=80) { ctx.beginPath(); ctx.moveTo(i,0); ctx.lineTo(i,height); ctx.stroke(); }
    for(let i=0; i<height; i+=40) { ctx.beginPath(); ctx.moveTo(0,i); ctx.lineTo(width,i); ctx.stroke(); }

    // Renderizar Líneas de Trades Activos en el activo actual
    state.activeTrades.forEach(t => {
        if(t.assetIndex !== activeAssetIndex) return;
        const y = height - ((t.strikePrice - finalMin) / finalRange) * height;
        ctx.beginPath();
        ctx.strokeStyle = t.dir === 'CALL' ? '#26b948' : '#ff4b4b';
        ctx.lineWidth = 1.5; ctx.setLineDash([4, 4]);
        ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke(); ctx.setLineDash([]);
    });

    // Línea Principal (Interpolación suave nativa del Canvas)
    ctx.beginPath();
    const isUp = hist[hist.length-1] >= hist[0];
    ctx.strokeStyle = 'rgba(255,255,255,0.9)'; 
    ctx.lineWidth = 2.5; ctx.lineJoin = 'round';

    let lastX, lastY;
    for(let i=0; i<hist.length; i++) {
        const x = (i / (hist.length - 1)) * (width - 60); // Espacio derecho para la etiqueta
        const y = height - ((hist[i] - finalMin) / finalRange) * height;
        if(i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        if(i === hist.length - 1) { lastX = x; lastY = y; }
    }
    ctx.stroke();

    // Degradado bajo la línea
    ctx.lineTo(lastX, height); ctx.lineTo(0, height);
    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, 'rgba(255, 255, 255, 0.15)');
    grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = grad; ctx.fill();

    // Línea punteada dinámica hacia el eje Y
    ctx.beginPath();
    ctx.strokeStyle = isUp ? 'rgba(38, 185, 72, 0.8)' : 'rgba(255, 75, 75, 0.8)';
    ctx.lineWidth = 1; ctx.setLineDash([3, 3]);
    ctx.moveTo(lastX, lastY); ctx.lineTo(width, lastY); ctx.stroke(); ctx.setLineDash([]);

    // Punto Brillante Actual
    ctx.beginPath(); ctx.arc(lastX, lastY, 4, 0, Math.PI*2);
    ctx.fillStyle = isUp ? '#26b948' : '#ff4b4b'; ctx.fill();
    ctx.shadowBlur = 10; ctx.shadowColor = ctx.fillStyle; ctx.fill(); ctx.shadowBlur = 0;

    // Etiqueta Eje Y
    ctx.fillStyle = ctx.fillStyle;
    ctx.fillRect(width - 60, lastY - 12, 60, 24);
    ctx.beginPath(); ctx.moveTo(width - 60, lastY - 12); ctx.lineTo(width - 68, lastY); ctx.lineTo(width - 60, lastY + 12); ctx.fill();
    
    ctx.fillStyle = '#fff'; ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(hist[hist.length-1].toFixed(4), width - 30, lastY + 4);
    ctx.textAlign = 'left';

    requestAnimationFrame(drawChart); // Dibuja fluidamente los cambios del array
}

// --- INIT ---
renderTabs();
resizeCanvas();
updateUI();
requestAnimationFrame(drawChart);
