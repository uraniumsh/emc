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

// ==========================================
// 2. ÍCONOS VECTORIALES (APPLE SAN FRANCISCO)
// ==========================================
const ICONS = {
    edit: `<svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>`,
    trash: `<svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>`,
    lock: `<svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>`,
    close: `<svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`,
    thumbUp: `<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"></path></svg>`,
    chat: `<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>`,
    admin: `<svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>`,
    alert: `<svg viewBox="0 0 24 24" width="48" height="48" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>`
};

// ==========================================
// 3. VARIABLES GLOBALES
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
// 4. INICIALIZACIÓN Y SEGURIDAD
// ==========================================
async function initSession() {
    document.body.addEventListener('touchstart', function(){}, {passive: true});
    injectIOSModalContainer();

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
        checkBannedStatus();
        await userRef.update({ lastActive: rightNow });
    }

    const hasAdminRole = currentUser.role === 'superadmin' || currentUser.role === 'admin';
    const hasAuth = localStorage.getItem('admin_auth') === 'true';
    isAdmin = hasAdminRole && hasAuth;

    if (isAdmin) activateAdminUI();
    updateProfileUI();
}
window.onload = initSession;

function checkBannedStatus() {
    if(currentUser && currentUser.banned === true && myUserId !== "170125") {
        document.body.innerHTML = `
        <div style="background:var(--bg-color, #000); color:var(--text-main, #fff); height:100dvh; display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center; padding:20px;">
            <div style="color:var(--danger, #ff3b30); margin-bottom:20px;">${ICONS.alert}</div>
            <h1 style="font-size:24px; font-weight:700; margin-bottom:10px;">Cuenta Suspendida</h1>
            <p style="color:var(--text-muted, #8e8e93); font-size:15px; max-width:300px;">El acceso a tu cuenta ha sido restringido permanentemente.</p>
        </div>`;
    }
}

// ==========================================
// 5. SISTEMA NATIVO DE ALERTAS iOS
// ==========================================
function injectIOSModalContainer() {
    if (document.getElementById('sys-ios-modal')) return;
    
    // Inyectamos el CSS estricto para que la alerta no se vuelva invisible
    const style = document.createElement('style');
    style.innerHTML = `
        #sys-ios-modal { position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.5); display: flex; justify-content: center; align-items: center; z-index: 99999; backdrop-filter: blur(4px); -webkit-backdrop-filter: blur(4px); transition: opacity 0.2s ease; }
        #sys-ios-modal.hidden { display: none !important; opacity: 0; pointer-events: none; }
        #sys-ios-modal.closing { opacity: 0; }
        .ios-dialog { background: #fff; width: 270px; border-radius: 14px; text-align: center; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.2); font-family: -apple-system, BlinkMacSystemFont, "San Francisco", "Segoe UI", sans-serif; color: #000; }
        @media (prefers-color-scheme: dark) {
            .ios-dialog { background: #252525; color: #fff; border: 1px solid rgba(255,255,255,0.1); }
        }
        .ios-dialog-content { padding: 20px 16px; }
        .ios-dialog-title { font-weight: 600; font-size: 17px; margin-bottom: 5px; }
        .ios-dialog-msg { font-size: 13px; opacity: 0.8; line-height: 1.3; }
        .ios-dialog-input { margin-top: 15px; width: 90%; padding: 8px; border: 1px solid rgba(128,128,128,0.3); border-radius: 6px; font-size: 14px; background: transparent; color: inherit; }
        .ios-dialog-actions { display: flex; border-top: 1px solid rgba(128,128,128,0.2); }
        .ios-dialog-btn { flex: 1; background: transparent; border: none; padding: 12px; font-size: 17px; color: #0a84ff; cursor: pointer; font-family: inherit; margin: 0; }
        .ios-dialog-btn:not(:last-child) { border-right: 1px solid rgba(128,128,128,0.2); }
        .ios-dialog-btn.bold { font-weight: 600; }
    `;
    document.head.appendChild(style);

    const div = document.createElement('div');
    div.id = 'sys-ios-modal';
    div.className = 'modal hidden';
    div.innerHTML = `
        <div class="ios-dialog">
            <div class="ios-dialog-content">
                <div class="ios-dialog-title" id="sys-ios-title">Título</div>
                <div class="ios-dialog-msg" id="sys-ios-msg">Mensaje</div>
                <input type="text" class="ios-dialog-input hidden" id="sys-ios-input" />
            </div>
            <div class="ios-dialog-actions" id="sys-ios-actions"></div>
        </div>
    `;
    document.body.appendChild(div);
}

function showIOSModal(title, msg, type, callback) {
    const modal = document.getElementById('sys-ios-modal');
    if(!modal) return;
    
    document.getElementById('sys-ios-title').innerText = title;
    document.getElementById('sys-ios-msg').innerText = msg;
    
    const input = document.getElementById('sys-ios-input');
    const actions = document.getElementById('sys-ios-actions');
    actions.innerHTML = '';
    
    input.classList.add('hidden');
    input.value = '';

    if (type === 'alert') {
        actions.innerHTML = `<button class="ios-dialog-btn bold" onclick="closeSysModal(); if(window.tempSysCallback) window.tempSysCallback();">OK</button>`;
        window.tempSysCallback = callback || null;
    } 
    else if (type === 'confirm') {
        window.tempSysCallback = callback;
        actions.innerHTML = `
            <button class="ios-dialog-btn" onclick="closeSysModal()">Cancelar</button>
            <button class="ios-dialog-btn bold" onclick="closeSysModal(); if(window.tempSysCallback) window.tempSysCallback();">Confirmar</button>
        `;
    }
    else if (type === 'prompt') {
        input.classList.remove('hidden');
        input.focus();
        window.tempSysCallback = callback;
        actions.innerHTML = `
            <button class="ios-dialog-btn" onclick="closeSysModal()">Cancelar</button>
            <button class="ios-dialog-btn bold" onclick="const val = document.getElementById('sys-ios-input').value.trim(); closeSysModal(); if(window.tempSysCallback) window.tempSysCallback(val);">Aceptar</button>
        `;
    }
    
    modal.classList.remove('hidden');
    modal.classList.remove('closing');
}

function closeSysModal() {
    const modal = document.getElementById('sys-ios-modal');
    if(!modal) return;
    modal.classList.add('closing');
    setTimeout(() => { modal.classList.add('hidden'); modal.classList.remove('closing'); }, 200);
}

function iosAlert(title, message) { showIOSModal(title, message, 'alert'); }
function iosConfirm(title, message, callback) { showIOSModal(title, message, 'confirm', callback); }
function iosPrompt(title, message, callback) { showIOSModal(title, message, 'prompt', callback); }

// ==========================================
// 6. UTILIDADES & UI
// ==========================================
function getFinalPrice(p) {
    let price = Number(p.price) || 0;
    let discount = Number(p.discount) || 0;
    return discount > 0 ? (price - discount) : price;
}

function showToast(msg) {
    let c = document.getElementById('toast-container');
    if(!c) {
        c = document.createElement('div');
        c.id = 'toast-container';
        document.body.appendChild(c);
    }
    const t = document.createElement('div'); 
    t.className = 'toast'; 
    t.innerText = msg;
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
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function openMenu() {
    const menu = document.getElementById('mobile-menu');
    if(!menu) return;
    menu.classList.remove('hidden');
    menu.style.pointerEvents = 'auto';
    
    const nameEl = document.getElementById('menu-user-name');
    if(nameEl) nameEl.innerText = (currentUser && currentUser.registered) ? currentUser.name : "Invitado";
    
    const idEl = document.getElementById('menu-user-id');
    if(idEl) idEl.innerText = `ID: #${myUserId}`;
    
    if (isAdmin) { 
        const adminBtn = document.getElementById('btn-admin-menu');
        if(adminBtn) adminBtn.classList.remove('hidden'); 
    }
}

function closeMenu() { 
    const menu = document.getElementById('mobile-menu');
    if(menu) { menu.style.pointerEvents = 'none'; menu.classList.add('hidden'); }
}

function updateProfileUI() {
    if(!currentUser) return;
    document.querySelectorAll('.user-balance-display').forEach(el => el.innerText = `$${(currentUser.balance || 0).toLocaleString()}`);
    document.querySelectorAll('.user-name-display').forEach(el => el.innerText = (currentUser && currentUser.registered) ? currentUser.name : "Invitado");
}

// ==========================================
// 7. ESCUCHADORES FIREBASE
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
            checkBannedStatus();
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

// ==========================================
// 8. RENDERIZADO DE PRODUCTOS (Clases Restauradas)
// ==========================================
function renderGrid(filterCat = null) {
    const grid = document.getElementById('products-grid');
    if (!grid) return;
    grid.innerHTML = '';
    showView('store');

    let toShow = products;
    if (filterCat) toShow = products.filter(p => p.category === filterCat);

    toShow.forEach(p => {
        const finalPrice = getFinalPrice(p);
        const discountTag = p.discount > 0 ? `<div class="discount-tag">-$${p.discount.toLocaleString()}</div>` : '';
        
        grid.innerHTML += `
        <div class="card" onclick="verProducto('${p.id}')">
            <div class="card-img" style="background-image: url('${p.img}')">${discountTag}</div>
            <div class="card-body" style="padding:12px; flex-grow:1; display:flex; flex-direction:column; justify-content:space-between;">
                <h3 style="font-size:15px; font-weight:600; margin-bottom:5px;">${p.name}</h3>
                <div>
                    <p class="price" style="font-weight:700; font-size:16px; margin-bottom:10px; ${p.discount > 0 ? 'color: var(--danger, #ff3b30);' : ''}">
                        $${finalPrice.toLocaleString()} 
                        ${p.discount > 0 ? `<br><span style="text-decoration:line-through; font-weight:400; font-size:12px; color:gray;">$${p.price.toLocaleString()}</span>` : ''}
                    </p>
                    <button class="apple-btn" onclick="event.stopPropagation(); addToCart('${p.id}', 1)">Agregar</button>
                </div>
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

        let html = `<div class="category-section" style="margin-bottom:30px;"><h2 class="category-title" style="font-size:22px; font-weight:700; margin-bottom:15px;">${cat.name}</h2><div class="products-grid">`;
        prods.forEach(p => {
            const finalPrice = getFinalPrice(p);
            const discountTag = p.discount > 0 ? `<div class="discount-tag">-$${p.discount.toLocaleString()}</div>` : '';
            
            html += `
            <div class="card" onclick="verProducto('${p.id}')">
                <div class="card-img" style="background-image: url('${p.img}')">${discountTag}</div>
                <div class="card-body" style="padding:12px; display:flex; flex-direction:column; flex-grow:1; justify-content:space-between;">
                    <h3 style="font-size:15px; font-weight:600; margin-bottom:5px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${p.name}</h3>
                    <div>
                        <p class="price" style="font-weight:700; font-size:15px; margin-bottom:10px; ${p.discount > 0 ? 'color: var(--danger, #ff3b30);' : ''}">
                            $${finalPrice.toLocaleString()}
                            ${p.discount > 0 ? `<span style="text-decoration:line-through; font-weight:400; font-size:12px; color:gray; margin-left:5px;">$${p.price.toLocaleString()}</span>` : ''}
                        </p>
                        <button class="apple-btn" onclick="event.stopPropagation(); addToCart('${p.id}', 1)">Agregar</button>
                    </div>
                </div>
            </div>`;
        });
        html += `</div></div>`;
        container.innerHTML += html;
    });
}

// ==========================================
// 9. DETALLE Y RECLAMACIÓN
// ==========================================
function verProducto(id) {
    const p = products.find(x => x.id === id);
    if(!p) return;
    const finalPrice = getFinalPrice(p);
    
    document.getElementById('detail-img').style.backgroundImage = `url('${p.img}')`;
    document.getElementById('detail-name').innerText = p.name;
    document.getElementById('detail-desc').innerText = p.desc || 'Sin descripción';
    
    document.getElementById('detail-price').innerHTML = `$${finalPrice.toLocaleString()} ` + 
        (p.discount > 0 ? `<span style="text-decoration:line-through; font-weight:400; font-size:14px; color:gray; margin-left:8px;">$${p.price.toLocaleString()}</span>` : '');

    document.getElementById('detail-stock').innerText = `Disponibles: ${p.stock}`;
    
    const adminPanel = document.getElementById('detail-admin-actions');
    if (isAdmin && adminPanel) {
        adminPanel.classList.remove('hidden');
        adminPanel.innerHTML = `
            <button class="apple-btn" onclick="editProduct('${id}')">${ICONS.edit} Editar</button>
            <button class="apple-btn" style="background:var(--danger, #ff3b30); color:white;" onclick="deleteProduct('${id}')">${ICONS.trash} Eliminar</button>
        `;
    } else if(adminPanel) {
        adminPanel.classList.add('hidden');
    }

    const userActions = document.getElementById('detail-user-actions');
    if(userActions) {
        userActions.innerHTML = `
            <button class="apple-btn" style="margin-bottom:12px;" onclick="addToCart('${p.id}', 1)">Añadir al Carrito</button>
            <button class="apple-btn" style="background:var(--success, #34c759); color:white;" onclick="abrirClaim('${p.id}')">Reclamar Pantalla Ahora</button>
        `;
    }

    showView('detail');
}

function abrirClaim(productId) {
    claimContext = products.find(p => p.id === productId);
    if(!claimContext) return;
    
    // Restaurado al uso de tu modal HTML original para evitar conflictos
    openModal('modal-claim');
}

function submitClaim() {
    const name = document.getElementById('claim-name').value.trim();
    const phone = document.getElementById('claim-phone').value.trim();
    
    if(!name || !phone) return showToast("Por favor, completa todos los datos.");
    
    const msg = `*NUEVA PANTALLA RECLAMADA*\n\n*Usuario:* ${name}\n*WhatsApp:* ${phone}\n*Producto:* ${claimContext.name}\n*ID Sistema:* #${myUserId}`;
    
    sendTelegramNotification(msg);
    closeModal('modal-claim');
    iosAlert("Solicitud Enviada", "Nos pondremos en contacto contigo vía WhatsApp a la brevedad posible.");
    document.getElementById('claim-name').value = "";
    document.getElementById('claim-phone').value = "";
    claimContext = null;
}

// ==========================================
// 10. CARRITO Y PAGOS 
// ==========================================
function addToCart(id, qty) {
    const p = products.find(x => x.id === id);
    if (!p) return;
    if (p.stock <= 0) return iosAlert("Agotado", "Este producto ya no tiene existencias.");

    if (cartCooldowns[id] && Date.now() - cartCooldowns[id] < 600000) {
        return iosAlert("Límite de Tiempo", "Por favor espera 10 minutos para agregar este mismo artículo nuevamente.");
    }

    cart[id] = (cart[id] || 0) + qty;
    if (cart[id] > p.stock) cart[id] = p.stock;
    
    cartCooldowns[id] = Date.now();
    updateCartCount();
    showToast(`Agregado a tu carrito`);
}

function updateCartCount() {
    const c = Object.values(cart).reduce((a, b) => a + b, 0);
    const badge = document.getElementById('cart-count');
    if (badge) badge.innerText = c;
    
    // Soporte opcional para badges múltiples si los tienes
    const badges = document.querySelectorAll('.cart-badge');
    badges.forEach(b => {
        b.innerText = c;
        b.style.display = c > 0 ? 'flex' : 'none';
    });
}

function toggleCart() {
    const c = document.getElementById('cart-sidebar');
    if(!c) return;
    
    c.classList.toggle('open');
    if (c.classList.contains('open') || c.style.transform === 'translateX(0%)') {
        renderCart();
    }
}

function renderCart() {
    const items = document.getElementById('cart-items');
    if(!items) return;
    items.innerHTML = '';
    let total = 0;

    if (Object.keys(cart).length === 0) {
        items.innerHTML = '<p class="text-muted" style="text-align:center; margin-top:40px; font-size:15px;">Tu carrito está vacío.</p>';
        document.getElementById('cart-total').innerText = '$0';
        return;
    }

    for (const [id, qty] of Object.entries(cart)) {
        const p = products.find(x => x.id === id);
        if (!p) continue;
        
        const finalPrice = getFinalPrice(p);
        total += finalPrice * qty;

        items.innerHTML += `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px; background:rgba(128,128,128,0.1); padding:12px 15px; border-radius:14px;">
            <div style="flex-grow:1; padding-right:10px;">
                <strong style="font-size:15px; font-weight:600;">${p.name}</strong><br>
                <span class="text-muted" style="font-size:13px; opacity:0.8;">Cant: ${qty} | $${finalPrice.toLocaleString()} c/u</span>
            </div>
            <button style="background:transparent; border:none; color:var(--danger, #ff3b30); padding:5px; cursor:pointer;" onclick="delete cart['${id}']; renderCart(); updateCartCount();">${ICONS.trash}</button>
        </div>`;
    }
    const totalEl = document.getElementById('cart-total');
    if(totalEl) totalEl.innerText = `$${total.toLocaleString()}`;
}

async function payCart(method) {
    if (Object.keys(cart).length === 0) return iosAlert("Carrito Vacío", "No tienes artículos en tu carrito para comprar.");

    let total = 0;
    let itemsText = "";
    const itemsToUpdate = [];

    for (const [id, qty] of Object.entries(cart)) {
        const p = products.find(x => x.id === id);
        if (p) {
            const finalPrice = getFinalPrice(p);
            total += finalPrice * qty;
            itemsText += `- ${qty}x ${p.name} ($${finalPrice.toLocaleString()} c/u)\n`;
            itemsToUpdate.push({ ref: db.collection("productos").doc(id), newStock: p.stock - qty });
        }
    }

    if (method === 'billetera') {
        if (!currentUser || !currentUser.registered) return iosAlert("Acción Requerida", "Debes registrarte en la plataforma para usar tu billetera.");
        if (currentUser.balance < total) return iosAlert("Saldo Insuficiente", "No tienes suficiente saldo en tu billetera para realizar esta compra.");

        iosConfirm("Confirmar Pago", `Se descontarán $${total.toLocaleString()} de tu saldo. ¿Deseas continuar?`, async () => {
            const newBalance = currentUser.balance - total;
            await db.collection("usuarios").doc(myUserId).update({ balance: newBalance });
            
            for (let item of itemsToUpdate) { await item.ref.update({ stock: item.newStock }); }
            
            const msg = `*COMPRA CON BILLETERA*\n\n*ID:* #${myUserId}\n*Total:* $${total.toLocaleString()}\n*Artículos:*\n${itemsText}`;
            sendTelegramNotification(msg);
            
            cart = {}; updateCartCount(); toggleCart();
            iosAlert("Compra Exitosa", "Tu pago ha sido procesado exitosamente.");
        });
    } else if (method === 'nequi') {
        currentReceiptContext = { total, itemsText, itemsToUpdate, type: 'nequi_cart' };
        openModal('modal-receipt');
    }
}

// ==========================================
// 11. RECIBOS NEQUI
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
        document.getElementById('receipt-preview').innerText = "Documento adjunto: " + file.name;
        currentReceiptFile = file;
    });
}

async function sendReceipt() {
    if (!currentReceiptFile) return iosAlert("Error", "Por favor selecciona una imagen del comprobante antes de enviar.");
    
    const btn = document.getElementById('btn-send-receipt');
    if(btn) { btn.innerText = "Procesando..."; btn.disabled = true; }

    try {
        const ctx = currentReceiptContext;
        let msg = `*NUEVO COMPROBANTE*\n\n*ID:* #${myUserId}\n`;
        
        if (ctx.type === 'nequi_cart') {
            msg += `*TIPO:* COMPRA EN TIENDA\n*TOTAL A VERIFICAR:* $${ctx.total.toLocaleString()}\n*ARTÍCULOS:*\n${ctx.itemsText}`;
            for (let item of ctx.itemsToUpdate) { await item.ref.update({ stock: item.newStock }); }
            cart = {}; updateCartCount();
        } else if (ctx.type === 'topup') {
            msg += `*TIPO:* RECARGA BILLETERA\n*MONTO A RECARGAR:* $${ctx.amount.toLocaleString()}`;
        }

        await sendTelegramPhoto(currentReceiptFile, msg);
        iosAlert("Enviado", "El comprobante ha sido enviado a revisión. En breve procesaremos tu solicitud.");
        closeModal('modal-receipt');
        const sidebar = document.getElementById('cart-sidebar');
        if(sidebar && sidebar.classList.contains('open')) toggleCart();
        
    } catch (error) {
        iosAlert("Error", "Ocurrió un problema al enviar el comprobante. Inténtalo de nuevo.");
    } finally {
        if(btn) { btn.innerText = "Enviar a Verificación"; btn.disabled = false; }
        currentReceiptFile = null;
        document.getElementById('receipt-preview').innerText = "";
        document.getElementById('receipt-input').value = "";
    }
}

// ==========================================
// 12. FORO / CHATS 
// ==========================================
function renderForum() {
    const c = document.getElementById('forum-posts');
    if (!c) return;
    c.innerHTML = '';
    
    forumPosts.forEach(p => {
        const d = new Date(p.timestamp);
        const vipTag = p.vip ? `<span style="background:var(--accent, #0a84ff); color:#fff; padding:2px 8px; border-radius:10px; font-size:10px; font-weight:700; margin-left:5px;">VIP</span>` : '';
        const adminBadge = p.authorRole === 'superadmin' ? `<span style="color:var(--accent, #0a84ff); font-size:12px; margin-left:6px; display:inline-flex; align-items:center; gap:3px;">${ICONS.admin} Admin</span>` : '';

        c.innerHTML += `
        <div class="card" style="margin-bottom:12px; padding:15px; border-radius:14px; background:rgba(128,128,128,0.05);" onclick="openChat('${p.id}')">
            <div style="flex-grow:1;">
                <div style="display:flex; align-items:center; gap:8px; margin-bottom:6px;">
                    <strong style="font-size:16px; font-weight:600;">${p.title}</strong>
                    ${vipTag}
                </div>
                <div style="font-size:13px; color:gray; margin-bottom:8px;">Por: ${p.authorName} ${adminBadge}</div>
                <p style="font-size:14px; line-height:1.4; opacity:0.9;">${p.content.substring(0, 80)}...</p>
                <div style="margin-top:12px; display:flex; gap:16px; color:gray; font-size:13px; font-weight:500;">
                    <span style="display:flex; align-items:center; gap:6px;">${ICONS.thumbUp} ${p.likes || 0}</span>
                    <span style="display:flex; align-items:center; gap:6px;">${ICONS.chat} ${(p.replies || []).length}</span>
                </div>
            </div>
        </div>`;
    });
}

function openChat(id) {
    const post = forumPosts.find(p => p.id === id);
    if (!post) return;

    if (post.vip) {
        iosPrompt("Acceso VIP requerido", "Ingresa la clave de acceso al debate:", (val) => {
            if (val === post.password || isAdmin) { accederChat(post); } 
            else { iosAlert("Acceso Denegado", "La contraseña es incorrecta."); }
        });
    } else {
        accederChat(post);
    }
}

function accederChat(post) {
    currentThreadId = post.id;
    document.getElementById('view-forum').classList.add('hidden');
    document.getElementById('view-forum-detail').classList.remove('hidden');
    document.getElementById('chat-title').innerHTML = post.title + (post.vip ? ' <span style="color:var(--accent, #0a84ff); font-size:11px; margin-left:5px; padding:2px 6px; border:1px solid var(--accent, #0a84ff); border-radius:10px;">VIP</span>' : '');
    
    const actions = document.getElementById('chat-admin-actions');
    if (isAdmin && actions) {
        actions.innerHTML = `<button style="background:transparent; border:none; color:var(--danger, #ff3b30); cursor:pointer;" onclick="deletePost('${post.id}')">${ICONS.trash}</button>`;
    } else if (actions) {
        actions.innerHTML = '';
    }
    renderChatMessages(post);
}

function renderChatMessages(post) {
    const c = document.getElementById('chat-messages');
    if(!c) return;
    
    c.innerHTML = `
    <div style="background:rgba(128,128,128,0.1); padding:16px; border-radius:18px; margin-bottom:24px;">
        <div style="font-size:12px; font-weight:600; color:var(--accent, #0a84ff); margin-bottom:8px;">Hilo original por ${post.authorName}</div>
        <div style="font-size:15px; line-height:1.5;">${post.content}</div>
        ${post.img ? `<img src="${post.img}" style="width:100%; border-radius:12px; margin-top:12px;">` : ''}
    </div>`;

    const replies = post.replies || [];
    replies.forEach((r, index) => {
        const isMe = r.authorId === myUserId;
        const align = isMe ? 'flex-end' : 'flex-start';
        const bg = isMe ? 'var(--accent, #0a84ff)' : 'rgba(128,128,128,0.15)';
        const color = isMe ? '#ffffff' : 'inherit';
        const adminBadge = r.authorRole === 'superadmin' ? `<span style="color:var(--danger, #ff3b30); font-size:10px; font-weight:700;">[STAFF]</span> ` : '';

        c.innerHTML += `
        <div style="display:flex; flex-direction:column; align-items:${align}; margin-bottom:16px; width:100%;">
            <div style="font-size:11px; font-weight:500; color:gray; margin-bottom:4px; margin-left:8px; margin-right:8px;">${adminBadge}${r.authorName}</div>
            <div style="background:${bg}; color:${color}; padding:10px 16px; border-radius:18px; max-width:85%; font-size:15px; position:relative;">
                ${r.content}
                ${isAdmin || isMe ? `<button onclick="deleteReply('${post.id}', ${index})" style="position:absolute; ${isMe ? 'left:-30px;' : 'right:-30px;'} top:8px; background:none; border:none; color:gray; cursor:pointer;">${ICONS.trash}</button>` : ''}
            </div>
        </div>`;
    });
    c.scrollTop = c.scrollHeight;
}

async function deletePost(id) {
    iosConfirm("Eliminar Debate", "¿Estás seguro de borrar este hilo de conversación completamente?", async () => {
        await db.collection("foro").doc(id).delete();
        showView('forum');
        iosAlert("Eliminado", "El debate fue eliminado del sistema.");
    });
}

async function deleteReply(postId, replyIndex) {
    iosConfirm("Eliminar Mensaje", "¿Borrar esta respuesta del debate?", async () => {
        const p = forumPosts.find(x => x.id === postId);
        if(!p) return;
        p.replies.splice(replyIndex, 1);
        await db.collection("foro").doc(postId).update({ replies: p.replies });
    });
}

// ==========================================
// 13. PANEL ADMINISTRATIVO
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

    if (!name || !price || isNaN(price) || isNaN(stock)) return iosAlert("Datos Inválidos", "Revisa que los campos numéricos estén correctos.");

    const data = { name, desc, price, stock, category: cat, discount, img: currentImg || "https://via.placeholder.com/300" };

    if (editingId) {
        await db.collection("productos").doc(editingId).update(data);
        iosAlert("Éxito", "El producto ha sido actualizado.");
    } else {
        await db.collection("productos").add(data);
        iosAlert("Éxito", "El producto ha sido creado correctamente.");
    }
    editingId = null;
    closeModal('modal-product');
    renderGrid(); 
}

function deleteProduct(id) {
    if (!isAdmin) return;
    iosConfirm("Confirmar Acción", "¿Estás seguro de que deseas eliminar este producto del inventario?", async () => {
        await db.collection("productos").doc(id).delete();
        showView('store');
        iosAlert("Eliminado", "Producto borrado del sistema.");
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
