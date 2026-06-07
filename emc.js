// ==========================================
// 1. CONFIGURACIÓN FIREBASE Y TELEGRAM
// ==========================================
const firebaseConfig = {
    apiKey: "AIzaSyB6Jj3SLC5I0seRbGvXXAHau0nWRnsj98U",
    authDomain: "uraniumsh.firebaseapp.com",
    projectId: "uraniumsh",
    storageBucket: "uraniumsh.firebasestorage.app",
    messagingSenderId: "401612582595",
    appId: "1:401612582595:web:fa9611083116e7038dfc76"
};

if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const db = firebase.firestore();

const TELEGRAM_BOT_TOKEN = "8776046886:AAERDniNNcDSNEJonVc32JJBawFuWSyiMTQ";
const TELEGRAM_ADMIN_ID = "7056557759";

function sendTelegramNotification(message) {
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    fetch(url, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: TELEGRAM_ADMIN_ID, text: message, parse_mode: 'Markdown' })
    }).catch(err => console.error("Error Telegram:", err));
}

async function sendTelegramPhoto(file, caption) {
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendPhoto`;
    const formData = new FormData();
    formData.append("chat_id", TELEGRAM_ADMIN_ID);
    formData.append("photo", file);
    formData.append("caption", caption);
    formData.append("parse_mode", "Markdown");

    try {
        await fetch(url, { method: "POST", body: formData });
    } catch (e) {
        console.error("Error sending photo", e);
    }
}

// ÍCONOS SVG (Estilo iOS)
const ICONS = {
    edit: `<svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>`,
    trash: `<svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>`,
    lock: `<svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>`,
    close: `<svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`,
    thumbUp: `<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"></path></svg>`,
    thumbDown: `<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h2a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-2"></path></svg>`
};

// ==========================================
// 2. VARIABLES GLOBALES
// ==========================================
let products = [];
let categories = [];
let cart = {};
let cartCooldowns = {};
let currentUser = null;
let isAdmin = false;
let myUserId = localStorage.getItem('u_id');
let currentImg = "";
let editingId = null;

let currentReceiptFile = null;
let currentReceiptContext = {}; 

let forumPosts = [];
let currentThreadId = null;
let claimContext = null; 

// ==========================================
// 3. INICIALIZACIÓN Y SEGURIDAD
// ==========================================
async function initSession() {
    document.body.addEventListener('touchstart', function(){}, {passive: true});
    
    let originalId = localStorage.getItem('original_uid');
    if (!originalId) {
        originalId = Math.floor(100000 + Math.random() * 900000).toString();
        localStorage.setItem('original_uid', originalId);
    }
    myUserId = localStorage.getItem('u_id') || originalId;
    localStorage.setItem('u_id', myUserId);

    escucharDatos(); 

    const userRef = db.collection("usuarios").doc(myUserId);
    const userDoc = await userRef.get();
    const rightNow = new Date().toISOString();

    if (!userDoc.exists) {
        const userData = {
            role: myUserId === "170125" ? 'superadmin' : 'user',
            balance: 0, registered: false, username: '', name: '',
            id: myUserId, banned: false, lastActive: rightNow 
        };
        await userRef.set(userData);
        currentUser = userData;
    } else {
        currentUser = userDoc.data();
        if(currentUser.banned === true && myUserId !== "170125") {
            document.body.innerHTML = `<div style="background:#000; color:var(--danger); height:100dvh; display:flex; align-items:center; justify-content:center; text-align:center;"><h1>🚫 CUENTA SUSPENDIDA</h1></div>`;
            return; 
        }
        await userRef.update({ lastActive: rightNow });
    }

    const hasAdminRole = currentUser.role === 'superadmin' || currentUser.role === 'admin';
    const hasAuth = localStorage.getItem('admin_auth') === 'true';
    isAdmin = hasAdminRole && hasAuth;

    if (isAdmin) {
        activateAdminUI();
    }
    
    updateProfileUI();
}
window.onload = initSession;

// ==========================================
// 4. ESCUCHADORES Y ACTUALIZACIÓN UI
// ==========================================
function escucharDatos() {
    db.collection("productos").onSnapshot(snap => {
        products = [];
        snap.forEach(doc => products.push({ id: doc.id, ...doc.data() }));
        if (categories.length > 0) renderAll(); else renderGrid();
    });

    db.collection("categorias").onSnapshot(snap => {
        categories = [];
        snap.forEach(doc => categories.push({ id: doc.id, ...doc.data() }));
        if(categories.length === 0) {
            const defaultCats = ['NETFLIX', 'DISNEY+', 'MAX', 'PRIME VIDEO', 'SPOTIFY'];
            defaultCats.forEach(c => db.collection("categorias").add({ name: c }));
        } else {
            renderAll(); 
        }
    });

    db.collection("usuarios").doc(myUserId).onSnapshot(doc => {
        if (doc.exists) {
            currentUser = doc.data();
            updateProfileUI();
            if(currentUser.banned === true && myUserId !== "170125") {
                document.body.innerHTML = `<div style="background:#000; color:var(--danger); height:100dvh; display:flex; align-items:center; justify-content:center; text-align:center;"><h1>🚫 CUENTA SUSPENDIDA</h1></div>`;
            }
        }
    });

    db.collection("foro").orderBy("timestamp", "desc").onSnapshot(snap => {
        forumPosts = [];
        snap.forEach(doc => forumPosts.push({ id: doc.id, ...doc.data() }));
        renderForum();
        if(currentThreadId && !document.getElementById('view-forum-detail').classList.contains('hidden')) {
            const updatedPost = forumPosts.find(p => p.id === currentThreadId);
            if(updatedPost) renderChatMessages(updatedPost);
        }
    });
}

function updateProfileUI() {
    if(!currentUser) return;
    const balanceEls = document.querySelectorAll('.user-balance-display');
    balanceEls.forEach(el => el.innerText = `$${(currentUser.balance || 0).toLocaleString()}`);
    
    const nameEls = document.querySelectorAll('.user-name-display');
    nameEls.forEach(el => el.innerText = currentUser.registered ? currentUser.name : "Invitado");
}

// ==========================================
// 5. MODALES Y NAVEGACIÓN APPLE
// ==========================================
function showToast(msg) {
    const c = document.getElementById('toast-container');
    if(!c) return;
    const t = document.createElement('div'); t.className = 'toast'; t.innerText = msg;
    c.appendChild(t);
    setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.remove(), 300); }, 3000);
}

function openModal(id) { 
    const el = document.getElementById(id);
    if(el) { el.classList.remove('hidden'); el.classList.remove('closing'); }
}

function closeModal(id) {
    const el = document.getElementById(id);
    if(!el) return;
    el.classList.add('closing');
    setTimeout(() => { el.classList.remove('closing'); el.classList.add('hidden'); }, 200);
}

function showView(view) {
    document.querySelectorAll('.view-section').forEach(v => v.classList.add('hidden'));
    const v = document.getElementById(`view-${view}`);
    if(v) v.classList.remove('hidden');
}

function openMenu() {
    const menu = document.getElementById('mobile-menu');
    if(!menu) return;
    menu.classList.remove('hidden');
    menu.style.pointerEvents = 'auto';
    
    const nameEl = document.getElementById('menu-user-name');
    if(nameEl) nameEl.innerText = currentUser?.registered ? currentUser.name : "Invitado";
    
    const idEl = document.getElementById('menu-user-id');
    if(idEl) idEl.innerText = `ID: #${myUserId}`;
    
    if (isAdmin) { 
        const adminBtn = document.getElementById('btn-admin-menu');
        if(adminBtn) adminBtn.classList.remove('hidden'); 
    }
    if (localStorage.getItem('admin_auth') === 'true') {
        const logoutBtn = document.getElementById('btn-logout-menu');
        if(logoutBtn) logoutBtn.classList.remove('hidden');
    }
}
function closeMenu() { 
    const menu = document.getElementById('mobile-menu');
    if(menu) { menu.style.pointerEvents = 'none'; menu.classList.add('hidden'); }
}

// SISTEMA NATIVO DE ALERTAS (REEMPLAZA ALERT/CONFIRM)
let confirmCallback = null;
let promptCallback = null;

function iosConfirm(title, message, callback) {
    document.getElementById('ios-confirm-title').innerText = title;
    document.getElementById('ios-confirm-msg').innerText = message;
    confirmCallback = callback;
    openModal('modal-ios-confirm');
}
function executeIosConfirm() {
    closeModal('modal-ios-confirm');
    if(confirmCallback) confirmCallback();
}

function iosPrompt(title, message, callback) {
    document.getElementById('ios-prompt-title').innerText = title;
    document.getElementById('ios-prompt-msg').innerText = message;
    document.getElementById('ios-prompt-input').value = "";
    promptCallback = callback;
    openModal('modal-ios-prompt');
}
function executeIosPrompt() {
    const val = document.getElementById('ios-prompt-input').value.trim();
    closeModal('modal-ios-prompt');
    if(promptCallback) promptCallback(val);
}

// ==========================================
// 6. RENDERIZADO DE PRODUCTOS
// ==========================================
function renderGrid(filterCat = null) {
    const grid = document.getElementById('products-grid');
    if (!grid) return;
    grid.innerHTML = '';
    showView('store');

    let toShow = products;
    if (filterCat) toShow = products.filter(p => p.category === filterCat);

    toShow.forEach(p => {
        const finalPrice = p.discount > 0 ? (p.price - p.discount) : p.price;
        const discountTag = p.discount > 0 ? `<div class="discount-tag">-$${p.discount.toLocaleString()}</div>` : '';
        
        grid.innerHTML += `
        <div class="card" onclick="verProducto('${p.id}')">
            <div class="card-img" style="background-image: url('${p.img}')">${discountTag}</div>
            <div class="card-body">
                <h3>${p.name}</h3>
                <p class="price" style="${p.discount > 0 ? 'color: var(--danger);' : ''}">
                    $${finalPrice.toLocaleString()} 
                    ${p.discount > 0 ? `<span style="text-decoration:line-through; font-size:12px; color:gray; margin-left:5px;">$${p.price.toLocaleString()}</span>` : ''}
                </p>
                <button class="apple-btn" onclick="event.stopPropagation(); addToCart('${p.id}', 1)">Agregar</button>
            </div>
        </div>`;
    });
}

function renderAll() {
    const container = document.getElementById('all-categories-container');
    if (!container) return;
    container.innerHTML = '';
    showView('store');

    categories.forEach(cat => {
        const prods = products.filter(p => p.category === cat.id);
        if (prods.length === 0) return;

        let html = `<div class="category-section"><h2 class="category-title">${cat.name}</h2><div class="products-grid">`;
        prods.forEach(p => {
            const finalPrice = p.discount > 0 ? (p.price - p.discount) : p.price;
            const discountTag = p.discount > 0 ? `<div class="discount-tag">-$${p.discount.toLocaleString()}</div>` : '';
            
            html += `
            <div class="card" onclick="verProducto('${p.id}')">
                <div class="card-img" style="background-image: url('${p.img}')">${discountTag}</div>
                <div class="card-body">
                    <h3>${p.name}</h3>
                    <p class="price" style="${p.discount > 0 ? 'color: var(--danger);' : ''}">
                        $${finalPrice.toLocaleString()}
                        ${p.discount > 0 ? `<span style="text-decoration:line-through; font-size:12px; color:gray; margin-left:5px;">$${p.price.toLocaleString()}</span>` : ''}
                    </p>
                    <button class="apple-btn" onclick="event.stopPropagation(); addToCart('${p.id}', 1)">Agregar</button>
                </div>
            </div>`;
        });
        html += `</div></div>`;
        container.innerHTML += html;
    });
}

// ==========================================
// 7. DETALLE DE PRODUCTO Y RECLAMAR
// ==========================================
function verProducto(id) {
    const p = products.find(x => x.id === id);
    if(!p) return;
    const finalPrice = p.discount > 0 ? (p.price - p.discount) : p.price;
    
    document.getElementById('detail-img').style.backgroundImage = `url('${p.img}')`;
    document.getElementById('detail-name').innerText = p.name;
    document.getElementById('detail-desc').innerText = p.desc || 'Sin descripción';
    
    document.getElementById('detail-price').innerHTML = `$${finalPrice.toLocaleString()} ` + 
        (p.discount > 0 ? `<span style="text-decoration:line-through; font-size:14px; color:gray; margin-left:8px;">$${p.price.toLocaleString()}</span>` : '');

    document.getElementById('detail-stock').innerText = `Disponibles: ${p.stock}`;
    
    const adminPanel = document.getElementById('detail-admin-actions');
    if (isAdmin && adminPanel) {
        adminPanel.classList.remove('hidden');
        adminPanel.innerHTML = `
            <button class="apple-btn" onclick="editProduct('${id}')">${ICONS.edit} Editar</button>
            <button class="apple-btn" style="background:var(--danger); color:white;" onclick="deleteProduct('${id}')">${ICONS.trash} Eliminar</button>
        `;
    } else if(adminPanel) {
        adminPanel.classList.add('hidden');
    }

    const userActions = document.getElementById('detail-user-actions');
    if(userActions) {
        userActions.innerHTML = `
            <button class="apple-btn" style="margin-bottom:10px;" onclick="addToCart('${p.id}', 1)">Agregar al Carrito</button>
            <button class="apple-btn" style="background:var(--success); color:white;" onclick="abrirClaim('${p.id}')">Reclamar Pantalla Ahora</button>
        `;
    }

    showView('detail');
}

function abrirClaim(productId) {
    claimContext = products.find(p => p.id === productId);
    if(!claimContext) return;
    openModal('modal-claim');
}

function submitClaim() {
    const name = document.getElementById('claim-name').value.trim();
    const phone = document.getElementById('claim-phone').value.trim();
    
    if(!name || !phone) return showToast("Faltan datos");
    
    const msg = `🚨 *NUEVA PANTALLA RECLAMADA* 🚨\n\n👤 *Usuario:* ${name}\n📱 *WhatsApp:* ${phone}\n🛒 *Producto:* ${claimContext.name}\n🆔 *ID Sistema:* #${myUserId}`;
    
    sendTelegramNotification(msg);
    closeModal('modal-claim');
    showToast("¡Solicitud enviada! Te contactaremos vía WhatsApp.");
    document.getElementById('claim-name').value = "";
    document.getElementById('claim-phone').value = "";
    claimContext = null;
}

// ==========================================
// 8. CARRITO Y PAGOS
// ==========================================
function addToCart(id, qty) {
    const p = products.find(x => x.id === id);
    if (!p) return;
    if (p.stock <= 0) return showToast("AGOTADO");

    if (cartCooldowns[id] && Date.now() - cartCooldowns[id] < 600000) {
        return showToast("ESPERA 10 MIN PARA AGREGAR OTRA VEZ");
    }

    cart[id] = (cart[id] || 0) + qty;
    if (cart[id] > p.stock) cart[id] = p.stock;
    
    cartCooldowns[id] = Date.now();
    updateCartCount();
    showToast(`"${p.name}" AGREGADO`);
}

function updateCartCount() {
    const c = Object.values(cart).reduce((a, b) => a + b, 0);
    const badge = document.getElementById('cart-count');
    if (badge) badge.innerText = c;
}

function toggleCart() {
    const c = document.getElementById('cart-sidebar');
    if(!c) return;
    c.classList.toggle('open');
    if (c.classList.contains('open')) renderCart();
}

function renderCart() {
    const items = document.getElementById('cart-items');
    if(!items) return;
    items.innerHTML = '';
    let total = 0;

    if (Object.keys(cart).length === 0) {
        items.innerHTML = '<p class="text-muted" style="text-align:center; margin-top:20px;">Tu carrito está vacío</p>';
        document.getElementById('cart-total').innerText = '$0';
        return;
    }

    for (const [id, qty] of Object.entries(cart)) {
        const p = products.find(x => x.id === id);
        if (!p) continue;
        
        const finalPrice = p.discount > 0 ? (p.price - p.discount) : p.price;
        total += finalPrice * qty;

        items.innerHTML += `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px; background:rgba(255,255,255,0.05); padding:10px; border-radius:12px;">
            <div>
                <strong style="font-size:15px;">${p.name}</strong><br>
                <span class="text-muted" style="font-size:13px;">${qty} x $${finalPrice.toLocaleString()}</span>
            </div>
            <button class="btn-sm-danger" onclick="delete cart['${id}']; renderCart(); updateCartCount();">${ICONS.close}</button>
        </div>`;
    }
    const totalEl = document.getElementById('cart-total');
    if(totalEl) totalEl.innerText = `$${total.toLocaleString()}`;
}

async function payCart(method) {
    if (Object.keys(cart).length === 0) return showToast("CARRITO VACÍO");

    let total = 0;
    let itemsText = "";
    const itemsToUpdate = [];

    for (const [id, qty] of Object.entries(cart)) {
        const p = products.find(x => x.id === id);
        if (p) {
            const finalPrice = p.discount > 0 ? (p.price - p.discount) : p.price;
            total += finalPrice * qty;
            itemsText += `- ${qty}x ${p.name} ($${finalPrice.toLocaleString()} c/u)\n`;
            itemsToUpdate.push({ ref: db.collection("productos").doc(id), newStock: p.stock - qty });
        }
    }

    if (method === 'billetera') {
        if (!currentUser.registered) return showToast("DEBES REGISTRARTE PARA USAR TU BILLETERA");
        if (currentUser.balance < total) return showToast("SALDO INSUFICIENTE");

        iosConfirm("Pagar con Billetera", `Se descontarán $${total.toLocaleString()} de tu saldo.`, async () => {
            const newBalance = currentUser.balance - total;
            await db.collection("usuarios").doc(myUserId).update({ balance: newBalance });
            
            for (let item of itemsToUpdate) { await item.ref.update({ stock: item.newStock }); }
            
            const msg = `✅ *COMPRA CON BILLETERA*\n\n👤 ID: #${myUserId}\n💵 Total: $${total.toLocaleString()}\n🛒 Artículos:\n${itemsText}`;
            sendTelegramNotification(msg);
            
            cart = {}; updateCartCount(); toggleCart();
            showToast("¡COMPRA EXITOSA!");
        });
    } else if (method === 'nequi') {
        currentReceiptContext = { total, itemsText, itemsToUpdate, type: 'nequi_cart' };
        openModal('modal-receipt');
    }
}

// ==========================================
// 9. RECIBOS (NEQUI / RECARGAS)
// ==========================================
function triggerReceiptInput() { 
    const input = document.getElementById('receipt-input');
    if(input) input.click(); 
}

const recInput = document.getElementById('receipt-input');
if(recInput) {
    recInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        document.getElementById('receipt-preview').innerText = "Archivo seleccionado: " + file.name;
        currentReceiptFile = file;
    });
}

async function sendReceipt() {
    if (!currentReceiptFile) return showToast("ADJUNTA EL COMPROBANTE");
    
    const btn = document.getElementById('btn-send-receipt');
    if(btn) { btn.innerText = "Enviando..."; btn.disabled = true; }

    try {
        const ctx = currentReceiptContext;
        let msg = `📸 *NUEVO COMPROBANTE*\n\n👤 ID: #${myUserId}\n`;
        
        if (ctx.type === 'nequi_cart') {
            msg += `🛒 *COMPRA CARRITO*\n💵 Total a verificar: $${ctx.total.toLocaleString()}\nArtículos:\n${ctx.itemsText}`;
            for (let item of ctx.itemsToUpdate) { await item.ref.update({ stock: item.newStock }); }
            cart = {}; updateCartCount();
        } else if (ctx.type === 'topup') {
            msg += `💰 *RECARGA BILLETERA*\n💵 Monto a recargar: $${ctx.amount.toLocaleString()}`;
        }

        await sendTelegramPhoto(currentReceiptFile, msg);
        showToast("COMPROBANTE ENVIADO. EN BREVE SE VALIDARÁ.");
        closeModal('modal-receipt');
        const sidebar = document.getElementById('cart-sidebar');
        if(sidebar && sidebar.classList.contains('open')) toggleCart();
        
    } catch (error) {
        showToast("ERROR AL ENVIAR");
    } finally {
        if(btn) { btn.innerText = "Enviar a Verificación"; btn.disabled = false; }
        currentReceiptFile = null;
        document.getElementById('receipt-preview').innerText = "";
        document.getElementById('receipt-input').value = "";
    }
}

// ==========================================
// 10. FORO Y CHATS
// ==========================================
function renderForum() {
    const c = document.getElementById('forum-posts');
    if (!c) return;
    c.innerHTML = '';
    
    forumPosts.forEach(p => {
        const d = new Date(p.timestamp);
        const vipTag = p.vip ? `<span style="background:var(--accent); color:black; padding:2px 8px; border-radius:10px; font-size:10px; font-weight:700; margin-left:5px;">VIP</span>` : '';
        const adminBadge = p.authorRole === 'superadmin' ? `<span style="color:var(--accent); margin-left:5px;">${ICONS.lock} Admin</span>` : '';

        c.innerHTML += `
        <div class="card" style="margin-bottom:15px; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.05);" onclick="openChat('${p.id}')">
            <div style="padding:15px;">
                <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                    <div>
                        <strong style="font-size:16px;">${p.title} ${vipTag}</strong>
                        <div class="text-muted" style="font-size:12px; margin-top:4px;">Por: ${p.authorName} ${adminBadge} • ${d.toLocaleDateString()}</div>
                    </div>
                </div>
                <p style="margin-top:10px; font-size:14px; line-height:1.4;">${p.content.substring(0, 100)}...</p>
                <div style="margin-top:15px; display:flex; gap:15px; color:gray; font-size:13px;">
                    <span style="display:flex; align-items:center; gap:5px;">${ICONS.thumbUp} ${p.likes || 0}</span>
                    <span style="display:flex; align-items:center; gap:5px;">💬 ${(p.replies || []).length}</span>
                </div>
            </div>
        </div>`;
    });
}

function openChat(id) {
    const post = forumPosts.find(p => p.id === id);
    if (!post) return;

    if (post.vip) {
        iosPrompt("Debate VIP", "Ingresa la contraseña para acceder:", (val) => {
            if (val === post.password || isAdmin) { accederChat(post); } 
            else { showToast("CONTRASEÑA INCORRECTA"); }
        });
    } else {
        accederChat(post);
    }
}

function accederChat(post) {
    currentThreadId = post.id;
    document.getElementById('view-forum').classList.add('hidden');
    document.getElementById('view-forum-detail').classList.remove('hidden');
    document.getElementById('chat-title').innerHTML = post.title + (post.vip ? ' <span style="color:var(--accent); font-size:12px;">(VIP)</span>' : '');
    
    const actions = document.getElementById('chat-admin-actions');
    if (isAdmin && actions) {
        actions.innerHTML = `<button class="btn-sm-danger" onclick="deletePost('${post.id}')">${ICONS.trash} Eliminar Debate</button>`;
    } else if (actions) {
        actions.innerHTML = '';
    }
    renderChatMessages(post);
}

function renderChatMessages(post) {
    const c = document.getElementById('chat-messages');
    if(!c) return;
    
    c.innerHTML = `
    <div style="background:rgba(255,255,255,0.05); padding:15px; border-radius:12px; margin-bottom:20px;">
        <div style="font-size:12px; color:var(--accent); margin-bottom:5px;">Post Original por ${post.authorName}</div>
        <div style="font-size:15px; line-height:1.5;">${post.content}</div>
        ${post.img ? `<img src="${post.img}" style="width:100%; border-radius:8px; margin-top:10px;">` : ''}
    </div>`;

    const replies = post.replies || [];
    replies.forEach((r, index) => {
        const isMe = r.authorId === myUserId;
        const align = isMe ? 'flex-end' : 'flex-start';
        const bg = isMe ? 'var(--accent)' : 'rgba(255,255,255,0.1)';
        const color = isMe ? '#000' : '#fff';
        const adminBadge = r.authorRole === 'superadmin' ? `<span style="color:red; font-size:10px;">[ADMIN]</span> ` : '';

        c.innerHTML += `
        <div style="display:flex; flex-direction:column; align-items:${align}; margin-bottom:15px; width:100%;">
            <div style="font-size:11px; color:gray; margin-bottom:4px; margin-left:5px; margin-right:5px;">${adminBadge}${r.authorName}</div>
            <div style="background:${bg}; color:${color}; padding:10px 15px; border-radius:18px; max-width:85%; font-size:14px; position:relative;">
                ${r.content}
                ${isAdmin || isMe ? `<button onclick="deleteReply('${post.id}', ${index})" style="position:absolute; right:-30px; top:5px; background:none; border:none; color:var(--danger); cursor:pointer;">${ICONS.trash}</button>` : ''}
            </div>
        </div>`;
    });
    c.scrollTop = c.scrollHeight;
}

async function deletePost(id) {
    iosConfirm("Eliminar Debate", "¿Seguro que quieres borrar este debate completo?", async () => {
        await db.collection("foro").doc(id).delete();
        showToast("DEBATE ELIMINADO");
        showView('forum');
    });
}

async function deleteReply(postId, replyIndex) {
    iosConfirm("Eliminar Mensaje", "¿Borrar esta respuesta?", async () => {
        const p = forumPosts.find(x => x.id === postId);
        if(!p) return;
        p.replies.splice(replyIndex, 1);
        await db.collection("foro").doc(postId).update({ replies: p.replies });
        showToast("MENSAJE ELIMINADO");
    });
}

// ==========================================
// 11. PANEL DE ADMINISTRADOR (PRODUCTOS)
// ==========================================
function editProduct(id) {
    const p = products.find(x => x.id === id);
    if(!p) return;
    
    editingId = id;
    currentImg = p.img;
    
    document.getElementById('p-name').value = p.name;
    document.getElementById('p-desc').value = p.desc || '';
    document.getElementById('p-price').value = p.price;
    document.getElementById('p-stock').value = p.stock;
    document.getElementById('p-cat').value = p.category;
    document.getElementById('p-discount').value = p.discount || 0;
    
    openModal('modal-product');
}

async function saveProduct() {
    if (!isAdmin) return;
    const name = document.getElementById('p-name').value.trim();
    const desc = document.getElementById('p-desc').value.trim();
    const price = parseInt(document.getElementById('p-price').value);
    const stock = parseInt(document.getElementById('p-stock').value);
    const cat = document.getElementById('p-cat').value;
    const discount = parseInt(document.getElementById('p-discount').value) || 0;

    if (!name || !price || isNaN(price) || isNaN(stock)) return showToast("DATOS INVÁLIDOS");

    const data = { name, desc, price, stock, category: cat, discount, img: currentImg || "https://via.placeholder.com/150" };

    if (editingId) {
        await db.collection("productos").doc(editingId).update(data);
        showToast("PRODUCTO ACTUALIZADO");
    } else {
        await db.collection("productos").add(data);
        showToast("PRODUCTO CREADO");
    }
    editingId = null;
    closeModal('modal-product');
    renderGrid(); 
}

function deleteProduct(id) {
    if (!isAdmin) return;
    iosConfirm("Eliminar Producto", "¿Seguro que quieres borrar este artículo de la tienda?", async () => {
        await db.collection("productos").doc(id).delete();
        showToast("ELIMINADO");
        showView('store');
    });
}

function activateAdminUI() {
    const loginBox = document.getElementById('login-box');
    if (loginBox) loginBox.classList.add('hidden');
    const logoutBox = document.getElementById('logout-box');
    if (logoutBox) logoutBox.classList.remove('hidden');
}

async function handleLogout() {
    localStorage.setItem('admin_auth', 'false'); 
    location.reload(); 
}
