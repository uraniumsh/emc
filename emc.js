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

// ÍCONOS SVG (Estilo iOS 26)
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
let replyingTo = null;
let currentForumImg = ""; 
let pendingVipPost = null; 
let claimContext = null; // Contexto para reclamar pantallas

// ==========================================
// 3. INICIALIZACIÓN DE SESIÓN Y SEGURIDAD
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

    const addBtn = document.getElementById('btn-add-post-header');
    if(addBtn) addBtn.classList.add('hidden');

    if (isAdmin) {
        activateAdminUI();
        if (addBtn) addBtn.classList.remove('hidden');
    }
    
    if(categories.length > 0) renderAll(); else renderGrid(); 
    updateProfileUI();
}
window.onload = initSession;

// ==========================================
// 4. ESCUCHADORES EN TIEMPO REAL
// ==========================================
function escucharDatos() {
    try {
        const cachedProducts = localStorage.getItem('u_prod_cache');
        const cachedCats = localStorage.getItem('u_cat_cache');
        if (cachedCats) categories = JSON.parse(cachedCats);
        if (cachedProducts) products = JSON.parse(cachedProducts);
        if (categories.length > 0) renderAll(); else if (products.length > 0) renderGrid();
    } catch(e) {}

    db.collection("productos").onSnapshot(snap => {
        products = [];
        snap.forEach(doc => products.push({ id: doc.id, ...doc.data() }));
        localStorage.setItem('u_prod_cache', JSON.stringify(products));
        if (categories.length > 0) renderAll(); else renderGrid();
    });

    db.collection("categorias").onSnapshot(snap => {
        categories = [];
        snap.forEach(doc => categories.push({ id: doc.id, ...doc.data() }));
        localStorage.setItem('u_cat_cache', JSON.stringify(categories));
        
        if(categories.length === 0) {
            const defaultCats = ['NETFLIX', 'DISNEY+', 'MAX', 'PRIME VIDEO', 'SPOTIFY', 'CRUNCHYROLL', 'IPTV'];
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

// ==========================================
// 5. UTILIDADES UI Y MODALES APPLE
// ==========================================
function showToast(msg) {
    const c = document.getElementById('toast-container');
    const t = document.createElement('div'); t.className = 'toast'; t.innerText = msg;
    c.appendChild(t);
    setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.remove(), 300); }, 3000);
}

function openModal(id) { 
    const el = document.getElementById(id);
    if(el) {
        el.classList.remove('hidden'); 
        el.classList.remove('closing');
    }
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

/* FIX MENÚS APPLE */
function openMenu() {
    const menu = document.getElementById('mobile-menu');
    menu.classList.remove('hidden');
    menu.style.pointerEvents = 'auto';
    document.getElementById('menu-user-name').innerText = currentUser?.registered ? currentUser.name : "Invitado";
    document.getElementById('menu-user-id').innerText = `ID: #${myUserId}`;
    
    if (isAdmin) { document.getElementById('btn-admin-menu').classList.remove('hidden'); }
    if (localStorage.getItem('admin_auth') === 'true') {
        document.getElementById('btn-logout-menu').classList.remove('hidden');
    }
}
function closeMenu() { 
    const menu = document.getElementById('mobile-menu');
    menu.style.pointerEvents = 'none';
    menu.classList.add('hidden'); 
}

/* SISTEMA NATIVO DE ALERTAS SIN ALERT/CONFIRM */
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
// 6. LOGIN ADMIN Y PANEL DE CONTROL
// ==========================================
async function handleLogin() {
    const em = document.getElementById('l-email').value.trim().toLowerCase();
    const pa = document.getElementById('l-pass').value.trim();
    if(!em || !pa) return showToast("INGRESA DATOS");

    try {
        const usersSnap = await db.collection("usuarios")
            .where("adminEmail", "==", em)
            .where("adminPass", "==", pa)
            .get();

        if(!usersSnap.empty) {
            const adminDoc = usersSnap.docs[0];
            myUserId = adminDoc.id; 
            localStorage.setItem('u_id', myUserId);
            localStorage.setItem('admin_auth', 'true'); 
            
            showToast("SESIÓN DE ADMIN INICIADA");
            setTimeout(() => location.reload(), 500); 
        } else { 
            showToast("CREDENCIALES INCORRECTAS"); 
        }
    } catch (error) { showToast("ERROR DE ACCESO"); }
}

function activateAdminUI() {
    const loginBox = document.getElementById('login-box');
    if (loginBox) loginBox.classList.add('hidden');
    const logoutBox = document.getElementById('logout-box');
    if (logoutBox) logoutBox.classList.remove('hidden');
    const logoutMenu = document.getElementById('btn-logout-menu');
    if (logoutMenu) logoutMenu.classList.remove('hidden');

    if(currentUser) {
        if(currentUser.role === 'superadmin') {
            const btnSec = document.getElementById('btn-security');
            if (btnSec) btnSec.classList.remove('hidden');
            const adminList = document.getElementById('admin-list-container');
            if (adminList) adminList.classList.remove('hidden');
            cargarAdminsEnDashboard(); 
        }
        cargarUsuariosEnDashboard();
    }
}

async function handleLogout() {
    localStorage.setItem('admin_auth', 'false'); 
    let originalId = localStorage.getItem('original_uid');
    if (originalId) { myUserId = originalId; localStorage.setItem('u_id', originalId); }
    location.reload(); 
}

function cargarUsuariosEnDashboard() {
    const tbody = document.getElementById('users-table');
    if(!tbody) return;
    
    db.collection("usuarios").orderBy("lastActive", "desc").onSnapshot(snap => {
        tbody.innerHTML = '';
        snap.forEach(doc => {
            const u = doc.data();
            if(u.id === "170125") return; 
            
            const isBanned = u.banned === true;
            const nombreMostrar = u.registered ? (u.name || u.username) : 'Invitado';
            
            tbody.innerHTML += `
            <tr style="opacity: ${isBanned ? '0.5' : '1'}">
                <td><strong>${nombreMostrar}</strong><br><span class="text-muted">#${u.id}</span></td>
                <td>$${(u.balance || 0).toLocaleString()}</td>
                <td>
                    <button class="btn-sm-danger" style="${!isBanned ? 'background: rgba(50,215,75,0.1); color: var(--success);' : ''}" onclick="toggleBan('${u.id}', ${!isBanned})">${isBanned ? 'Desbanear' : 'Banear'}</button>
                    ${isAdmin && u.role !== 'admin' ? `<button class="btn-sm-danger" style="margin-top:4px;" onclick="deleteUser('${u.id}')">Eliminar</button>` : ''}
                </td>
            </tr>`;
        });
    });
}

async function toggleBan(id, status) {
    await db.collection("usuarios").doc(id).update({ banned: status });
    showToast(`USUARIO ${status ? 'BANEADO' : 'DESBANEADO'}`);
}

function deleteUser(id) {
    if(!isAdmin) return;
    iosConfirm("Eliminar Usuario", `¿Eliminar al usuario #${id} permanentemente? Su saldo y acceso se perderán.`, async () => {
        await db.collection("usuarios").doc(id).delete();
        showToast("USUARIO ELIMINADO");
    });
}

async function addSubAdmin() {
    if(currentUser?.role !== "superadmin") return showToast("ACCESO DENEGADO");
    const id = document.getElementById('new-admin-id').value.trim();
    const email = document.getElementById('new-admin-email').value.trim().toLowerCase();
    const pass = document.getElementById('new-admin-pass').value.trim();
    if(!id || !email || !pass) return showToast("DATOS INCOMPLETOS");
    await db.collection("usuarios").doc(id).update({ role: 'admin', adminEmail: email, adminPass: pass });
    showToast("SUB-ADMIN CREADO"); closeModal('modal-manage-admins');
}

function cargarAdminsEnDashboard() {
    const area = document.getElementById('admins-render-area');
    if(!area) return;
    db.collection("usuarios").where("role", "==", "admin").onSnapshot(snap => {
        area.innerHTML = '';
        if(snap.empty) { area.innerHTML = '<p class="text-muted">No hay sub-admins activos.</p>'; return; }
        snap.forEach(doc => {
            const data = doc.data();
            area.innerHTML += `
            <div style="display:flex; justify-content:space-between; align-items:center; border-bottom: 1px solid rgba(255,255,255,0.1); padding: 8px 0;">
                <div><strong>ID:</strong> ${data.id} <br><span class="text-muted">${data.adminEmail}</span></div>
                <button onclick="deleteAdmin('${doc.id}')" class="btn-sm-danger">Remover</button>
            </div>`;
        });
    });
}

function deleteAdmin(docId) {
    iosConfirm("Remover Permisos", "¿Quitar permisos de administrador a este usuario?", async () => {
        await db.collection("usuarios").doc(docId).update({ role: 'user', adminEmail: null, adminPass: null });
        showToast("PERMISOS REMOVIDOS");
    });
}

async function updateSuperAdminCreds() {
    if(currentUser?.role !== "superadmin") return showToast("SOLO SÚPER ADMIN");
    const newEmail = document.getElementById('sec-new-email').value.trim().toLowerCase();
    const newPass = document.getElementById('sec-new-pass').value.trim();
    if(!newEmail || !newPass) return showToast("INGRESA AMBOS DATOS");
    await db.collection("usuarios").doc("170125").update({ adminEmail: newEmail, adminPass: newPass });
    closeModal('modal-security'); showToast("¡CREDENCIALES ACTUALIZADAS CON ÉXITO!");
}

async function inicializarSuperAdminSeguro() {
    const saDoc = await db.collection("usuarios").doc("170125").get();
    if (!saDoc.exists || !saDoc.data().adminEmail) {
        await db.collection("usuarios").doc("170125").set({
            role: 'superadmin', balance: 0, registered: true, username: 'admin', name: 'SÚPER ADMIN',
            id: "170125", adminEmail: 'admin@uranium.co', adminPass: '1234'               
        }, { merge: true });
    }
}
inicializarSuperAdminSeguro();
// ==========================================
// 7. RENDERIZADO DE PRODUCTOS (ESTILO APPLE)
// ==========================================
function renderGrid(filterCat = null) {
    const grid = document.getElementById('products-grid');
    if (!grid) return;
    grid.innerHTML = '';
    showView('store');

    let toShow = products;
    if (filterCat) {
        toShow = products.filter(p => p.category === filterCat);
    }

    toShow.forEach(p => {
        const finalPrice = p.discount > 0 ? (p.price - p.discount) : p.price;
        const discountTag = p.discount > 0 ? `<div class="discount-tag">-$${p.discount.toLocaleString()}</div>` : '';
        
        grid.innerHTML += `
        <div class="card" onclick="verProducto('${p.id}')">
            <div class="card-img" style="background-image: url('${p.img}')">
                ${discountTag}
            </div>
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
                <div class="card-img" style="background-image: url('${p.img}')">
                    ${discountTag}
                </div>
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
// 8. DETALLE DE PRODUCTO Y RECLAMAR PANTALLA
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
    if (isAdmin) {
        adminPanel.classList.remove('hidden');
        adminPanel.innerHTML = `
            <button class="apple-btn" onclick="editProduct('${id}')">${ICONS.edit} Editar</button>
            <button class="apple-btn" style="background:var(--danger); color:white;" onclick="deleteProduct('${id}')">${ICONS.trash} Eliminar</button>
        `;
    } else {
        adminPanel.classList.add('hidden');
    }

    // Configurar botones de acción de usuario
    const userActions = document.getElementById('detail-user-actions');
    userActions.innerHTML = `
        <button class="apple-btn" style="margin-bottom:10px;" onclick="addToCart('${p.id}', 1)">Agregar al Carrito</button>
        <button class="apple-btn" style="background:var(--success); color:white;" onclick="abrirClaim('${p.id}')">Reclamar Pantalla Ahora</button>
    `;

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
    
    const msg = `🚨 *NUEVA PANTALLA RECLAMADA* 🚨\n\n` +
                `👤 *Usuario:* ${name}\n` +
                `📱 *WhatsApp:* ${phone}\n` +
                `🛒 *Producto:* ${claimContext.name}\n` +
                `🆔 *ID del Sistema:* #${myUserId}`;
    
    sendTelegramNotification(msg);
    closeModal('modal-claim');
    showToast("¡Solicitud enviada! Te contactaremos vía WhatsApp.");
    document.getElementById('claim-name').value = "";
    document.getElementById('claim-phone').value = "";
    claimContext = null;
}

// ==========================================
// 9. CARRITO DE COMPRAS (MATEMÁTICAS EXACTAS)
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
    c.classList.toggle('open');
    if (c.classList.contains('open')) renderCart();
}

function renderCart() {
    const items = document.getElementById('cart-items');
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
        
        // APLICANDO EL DESCUENTO A LA MATEMÁTICA DEL CARRITO
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
    document.getElementById('cart-total').innerText = `$${total.toLocaleString()}`;
}

async function payCart(method) {
    if (Object.keys(cart).length === 0) return showToast("CARRITO VACÍO");

    let total = 0;
    let itemsText = "";
    const itemsToUpdate = [];

    // Recalcular el total con descuentos justos antes de pagar
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
// 10. GESTIÓN DE RECIBOS Y COMPROBANTES
// ==========================================
function triggerReceiptInput() { document.getElementById('receipt-input').click(); }

document.getElementById('receipt-input').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    document.getElementById('receipt-preview').innerText = "Archivo seleccionado: " + file.name;
    currentReceiptFile = file;
});

async function sendReceipt() {
    if (!currentReceiptFile) return showToast("ADJUNTA EL COMPROBANTE");
    
    document.getElementById('btn-send-receipt').innerText = "Enviando...";
    document.getElementById('btn-send-receipt').disabled = true;

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
        if(document.getElementById('cart-sidebar').classList.contains('open')) toggleCart();
        
    } catch (error) {
        showToast("ERROR AL ENVIAR");
    } finally {
        document.getElementById('btn-send-receipt').innerText = "Enviar a Verificación";
        document.getElementById('btn-send-receipt').disabled = false;
        currentReceiptFile = null;
        document.getElementById('receipt-preview').innerText = "";
        document.getElementById('receipt-input').value = "";
    }
}

// ==========================================
// 11. SISTEMA DE FORO (CON MODO VIP)
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
            if (val === post.password || isAdmin) {
                accederChat(post);
            } else {
                showToast("CONTRASEÑA INCORRECTA");
            }
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
    
    if (isAdmin) {
        document.getElementById('chat-admin-actions').innerHTML = `
            <button class="btn-sm-danger" onclick="deletePost('${post.id}')">${ICONS.trash} Eliminar Debate</button>
        `;
    } else {
        document.getElementById('chat-admin-actions').innerHTML = '';
    }

    renderChatMessages(post);
}

function renderChatMessages(post) {
    const c = document.getElementById('chat-messages');
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

// ==========================================
// 12. GESTIÓN ADMIN (CRUD PRODUCTOS)
// ==========================================
async function saveProduct() {
    if (!isAdmin) return;
    const name = document.getElementById('p-name').value.trim();
    const desc = document.getElementById('p-desc').value.trim();
    const price = parseInt(document.getElementById('p-price').value);
    const stock = parseInt(document.getElementById('p-stock').value);
    const cat = document.getElementById('p-cat').value;
    const discount = parseInt(document.getElementById('p-discount').value) || 0;

    if (!name || !price || isNaN(price) || isNaN(stock)) return showToast("DATOS INVÁLIDOS");

    const data = { name, desc, price, stock, category: cat, discount, img: currentImg };

    if (editingId) {
        await db.collection("productos").doc(editingId).update(data);
        showToast("PRODUCTO ACTUALIZADO");
    } else {
        await db.collection("productos").add(data);
        showToast("PRODUCTO CREADO");
    }
    closeModal('modal-product');
    renderGrid(); 
}

function deleteProduct(id) {
    if (!isAdmin) return;
    iosConfirm("Eliminar Producto", "¿Seguro que quieres borrar este artículo?", async () => {
        await db.collection("productos").doc(id).delete();
        showToast("ELIMINADO");
        showView('store');
    });
}
