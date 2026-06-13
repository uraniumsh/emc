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

// ==========================================
// 3. INICIALIZACIÓN DE SESIÓN Y SEGURIDAD
// ==========================================
async function initSession() {
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
            document.body.innerHTML = `<div style="background:black; color:var(--danger); height:100dvh; display:flex; align-items:center; justify-content:center; text-align:center;"><h1>🚫 CUENTA SUSPENDIDA</h1></div>`;
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
// 4. ESCUCHADORES EN TIEMPO REAL (FIREBASE + CACHÉ)
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
                document.body.innerHTML = `<div style="background:black; color:var(--danger); height:100dvh; display:flex; align-items:center; justify-content:center; text-align:center;"><h1>🚫 CUENTA SUSPENDIDA</h1></div>`;
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
// 5. UTILIDADES UI Y MENÚ APPLE
// ==========================================
function showToast(msg) {
    const c = document.getElementById('toast-container');
    const t = document.createElement('div'); t.className = 'toast'; t.innerText = msg;
    c.appendChild(t);
    setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.remove(), 300); }, 3000);
}

function openModal(id) { 
    const el = document.getElementById(id);
    if(el) el.classList.remove('hidden'); 
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
    document.getElementById('mobile-menu').classList.remove('hidden');
    document.getElementById('menu-user-name').innerText = currentUser?.registered ? currentUser.name : "Invitado";
    document.getElementById('menu-user-id').innerText = `ID: #${myUserId}`;
    
    if (isAdmin) { document.getElementById('btn-admin-menu').classList.remove('hidden'); }
    if (localStorage.getItem('admin_auth') === 'true') {
        document.getElementById('btn-logout-menu').classList.remove('hidden');
    }
}
function closeMenu() { document.getElementById('mobile-menu').classList.add('hidden'); }

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

async function deleteUser(id) {
    if(!isAdmin) return;
    if(confirm(`¿Estás completamente seguro de eliminar el usuario #${id}? Esto borrará su saldo y todo su acceso permanentemente.`)) {
        await db.collection("usuarios").doc(id).delete();
        showToast("USUARIO ELIMINADO");
    }
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
        if(snap.empty) { area.innerHTML = '<p class="text-muted">No hay sub-administradores activos.</p>'; return; }
        snap.forEach(doc => {
            const data = doc.data();
            area.innerHTML += `
            <div style="display:flex; justify-content:space-between; align-items:center; border-bottom: 1px solid var(--border-color); padding: 8px 0;">
                <div><strong>ID:</strong> ${data.id} <br><span class="text-muted">${data.adminEmail}</span></div>
                <button onclick="deleteAdmin('${doc.id}')" class="btn-sm-danger">Remover</button>
            </div>`;
        });
    });
}

async function deleteAdmin(docId) {
    if(confirm("¿Quitar permisos de administrador a este usuario?")) {
        await db.collection("usuarios").doc(docId).update({ role: 'user', adminEmail: null, adminPass: null });
        showToast("PERMISOS REMOVIDOS");
    }
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
// 7. PERFIL, SALDO Y COMPROBANTES
// ==========================================
function updateProfileUI() {
    const pId = document.getElementById('profile-id');
    const pName = document.getElementById('profile-name-display');
    const wBal = document.getElementById('wallet-balance');
    const rSec = document.getElementById('register-section');

    if(pId) pId.innerText = myUserId;
    if(pName) pName.innerText = currentUser?.registered ? currentUser.name : "Invitado";
    if(wBal) wBal.innerText = `$${(currentUser?.balance || 0).toLocaleString()}`;
    
    if(rSec) {
        if(currentUser?.registered) {
            rSec.classList.add('hidden');
        } else {
            rSec.classList.remove('hidden');
        }
    }
}

async function registerUser() {
    const user = document.getElementById('reg-username').value.trim();
    const name = document.getElementById('reg-name').value.trim();
    
    if(!user || !name) return showToast("LLENA TODOS LOS DATOS");
    
    const snapshot = await db.collection("usuarios").where("username", "==", user).get();
    if (!snapshot.empty) {
        if (snapshot.docs[0].id !== myUserId) {
            return showToast("EL USUARIO YA EXISTE, ELIGE OTRO");
        }
    }

    await db.collection("usuarios").doc(myUserId).update({
        username: user, 
        name: name, 
        registered: true, 
        balance: firebase.firestore.FieldValue.increment(5000)
    });
    
    showToast("¡REGISTRO EXITOSO! +$5000 AÑADIDOS");
    closeModal('modal-profile'); 
}

async function addBalanceToUser() {
    if(!isAdmin) return;
    const id = document.getElementById('bal-user-id').value.trim();
    const amt = parseInt(document.getElementById('bal-amount').value);
    if(!id || isNaN(amt)) return showToast("DATOS INVÁLIDOS");
    const doc = await db.collection("usuarios").doc(id).get();
    if(!doc.exists) return showToast("USUARIO NO ENCONTRADO EN LA BD");
    await db.collection("usuarios").doc(id).update({ balance: firebase.firestore.FieldValue.increment(amt) });
    showToast(`$${amt} RECARGADOS AL ID #${id}`); closeModal('modal-add-balance');
}

function openUserRecharge() {
    closeModal('modal-profile');
    document.getElementById('r-name').value = currentUser?.name || "";
    document.getElementById('r-phone').value = "";
    document.getElementById('r-amount').value = "";
    document.getElementById('recharge-form').classList.remove('hidden');
    document.getElementById('recharge-processing').classList.add('hidden');
    openModal('modal-user-recharge');
}

function processRecharge() {
    const name = document.getElementById('r-name').value.trim();
    const phone = document.getElementById('r-phone').value.trim();
    const amount = document.getElementById('r-amount').value;
    
    if(!name || !phone || !amount) return showToast("LLENA TODOS LOS DATOS");

    document.getElementById('recharge-form').classList.add('hidden');
    document.getElementById('recharge-processing').classList.remove('hidden');

    currentReceiptContext = {
        type: 'recharge', name: name, phone: phone, amount: amount,
        token: "REC-" + Math.random().toString(36).substr(2,5).toUpperCase()
    };

    setTimeout(() => {
        closeModal('modal-user-recharge');
        showReceiptModal(`Envía $${parseInt(amount).toLocaleString()} al NEQUI 3137084357 para recargar tu saldo.`);
    }, 1500);
}

function showReceiptModal(instructionText) {
    document.getElementById('receipt-instructions').innerText = instructionText + "\nAdjunta el comprobante aquí debajo.";
    document.getElementById('receipt-file-input').value = "";
    document.getElementById('receipt-preview').src = "";
    document.getElementById('receipt-preview').classList.add('hidden');
    document.getElementById('receipt-upload-label').classList.remove('hidden');
    currentReceiptFile = null;
    
    document.getElementById('receipt-form').classList.remove('hidden');
    document.getElementById('receipt-processing').classList.add('hidden');

    openModal('modal-receipt');
}

function previewReceipt() {
    const file = document.getElementById('receipt-file-input').files[0];
    if(file) {
        currentReceiptFile = file;
        const reader = new FileReader();
        reader.onload = (e) => {
            document.getElementById('receipt-preview').src = e.target.result;
            document.getElementById('receipt-preview').classList.remove('hidden');
            document.getElementById('receipt-upload-label').classList.add('hidden');
        }
        reader.readAsDataURL(file);
    }
}

async function submitReceipt() {
    if(!currentReceiptFile) return showToast("DEBES ADJUNTAR EL COMPROBANTE");

    document.getElementById('receipt-form').classList.add('hidden');
    document.getElementById('receipt-processing').classList.remove('hidden');

    let caption = "";
    if(currentReceiptContext.type === 'recharge') {
        caption = `💰 *SOLICITUD DE RECARGA*\n\n*Token:* ${currentReceiptContext.token}\n*Usuario:* ${currentReceiptContext.name}\n*WhatsApp:* ${currentReceiptContext.phone}\n*ID:* #${myUserId}\n*Monto a recargar:* $${currentReceiptContext.amount}\n\n_Revisa el comprobante y recarga la billetera manualmente._`;
        addLog(`TOKEN: ${currentReceiptContext.token}`, `RECARGA PENDIENTE | $${currentReceiptContext.amount}`);
        
    } else if (currentReceiptContext.type === 'vip_access') {
        const gananciaCreador = currentReceiptContext.amount * 0.7;
        const gananciaUranium = currentReceiptContext.amount * 0.3;
        caption = `💎 *PAGO VIP NEQUI (COMPROBANTE)*\n\n*Token:* ${currentReceiptContext.token}\n*Debate:* ${currentReceiptContext.title}\n*Comprador ID:* #${myUserId}\n*Creador WA:* ${currentReceiptContext.authorPhone}\n*Pagado:* $${currentReceiptContext.amount}\n\n⚠️ *ACCIÓN REQUERIDA:*\n1. Añade el ID #${myUserId} a la accessList del debate en Firebase.\n2. Transfiere $${gananciaCreador} al creador.\n*Ganancia Uranium:* $${gananciaUranium}`;
        addLog(`TOKEN: ${currentReceiptContext.token}`, `VIP NEQUI | Total: $${currentReceiptContext.amount}`);
        
    } else {
        caption = `🛒 *NUEVA ORDEN (COMPROBANTE)*\n\n*Token:* ${currentReceiptContext.token}\n*Cliente:* ${currentReceiptContext.name}\n*WhatsApp:* ${currentReceiptContext.phone}\n*ID:* #${myUserId}\n*Servicios:* ${currentReceiptContext.details}\n*Total Pagado:* $${currentReceiptContext.amount}`;
        addLog(`TOKEN: ${currentReceiptContext.token}`, `NEQUI PENDIENTE | Total: $${currentReceiptContext.amount}`);
        cart = {}; updateCartUI(); 
    }

    await sendTelegramPhoto(currentReceiptFile, caption);

    closeModal('modal-receipt');
    showToast("¡COMPROBANTE ENVIADO CON ÉXITO! REVISAREMOS TU PAGO PRONTO.");
}

// ==========================================
// 8. CATEGORÍAS Y PRODUCTOS (PUBLICAR/ELIMINAR)
// ==========================================
async function saveNewCategory() {
    const name = document.getElementById('new-cat-name').value.trim();
    if(name) {
        await db.collection("categorias").add({ name: name.toUpperCase() });
        closeModal('modal-add-cat'); showToast("CATEGORÍA CREADA");
        document.getElementById('new-cat-name').value = "";
    }
}

function openDeleteCatModal() {
    const sel = document.getElementById('d-cat-select');
    sel.innerHTML = categories.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    openModal('modal-delete-cat');
}

async function deleteCategory() {
    const id = document.getElementById('d-cat-select').value;
    if(!id) return showToast("SELECCIONA UNA CATEGORÍA");
    if(confirm("¿Seguro que quieres eliminar esta plataforma de raíz?")) {
        await db.collection("categorias").doc(id).delete();
        closeModal('modal-delete-cat');
        showToast("CATEGORÍA ELIMINADA");
    }
}

function openPublishModal(id = null) {
    editingId = id;
    if(id) {
        document.getElementById('pub-title').innerText = "Editar Producto";
        const p = products.find(prod => prod.id.toString() === id.toString());
        if(!p) return;
        
        document.getElementById('p-name').value = p.name || "";
        document.getElementById('p-short').value = p.short || "";
        document.getElementById('p-price').value = p.price || "";
        document.getElementById('p-cat-select').value = p.catId || "";
        document.getElementById('p-desc').value = p.desc || "";
        document.getElementById('p-contact').value = p.contact || "";
        document.getElementById('p-wa').value = p.wa || "";
        document.getElementById('p-pinned').checked = p.pinned || false;
        
        currentImg = p.img || "";
        if(currentImg) {
            document.getElementById('file-preview').src = currentImg;
            document.getElementById('file-preview').classList.remove('hidden');
            document.getElementById('upload-label').classList.add('hidden');
        }
    } else {
        document.getElementById('pub-title').innerText = "Nuevo Producto";
        resetForm();
    }
    openModal('modal-publish');
}

async function deleteProduct(id) {
    if(confirm("¿Seguro que quieres eliminar este producto de la tienda para siempre?")) {
        await db.collection("productos").doc(id.toString()).delete();
        showToast("PRODUCTO ELIMINADO 🗑️");
    }
}

function previewImage() {
    const file = document.getElementById('file-input').files[0];
    if(file) {
        const reader = new FileReader();
        reader.onloadend = () => {
            currentImg = reader.result;
            document.getElementById('file-preview').src = reader.result;
            document.getElementById('file-preview').classList.remove('hidden');
            document.getElementById('upload-label').classList.add('hidden');
        }; reader.readAsDataURL(file);
    }
}

async function handleSaveProduct() {
    const name = document.getElementById('p-name').value.trim();
    const price = document.getElementById('p-price').value;
    
    if(!currentImg || !name || !price) return showToast("FOTO, NOMBRE Y PRECIO OBLIGATORIOS");

    const data = {
        name, price: parseFloat(price),
        short: document.getElementById('p-short').value.trim(),
        desc: document.getElementById('p-desc').value.trim(),
        contact: document.getElementById('p-contact').value.trim() || "3128194596",
        wa: document.getElementById('p-wa').value.trim() || `Hola URANIUM, me interesa ${name}`,
        catId: document.getElementById('p-cat-select').value,
        pinned: document.getElementById('p-pinned').checked, 
        img: currentImg,
    };

    if(editingId) {
        await db.collection("productos").doc(editingId.toString()).update(data);
    } else {
        data.reactions = {}; data.comments = [];
        await db.collection("productos").add(data);
    }

    closeModal('modal-publish'); showToast(editingId ? "PRODUCTO ACTUALIZADO" : "PRODUCTO PUBLICADO"); 
}

function resetForm() {
    document.querySelectorAll('#modal-publish input[type="text"], #modal-publish input[type="number"], #modal-publish textarea').forEach(i => i.value = "");
    const cb = document.getElementById('p-pinned'); if(cb) cb.checked = false;
    const fp = document.getElementById('file-preview'); if(fp) fp.classList.add('hidden');
    const ul = document.getElementById('upload-label'); if(ul) ul.classList.remove('hidden');
    currentImg = "";
}

// ==========================================
// 9. RENDERIZAR INTERFAZ PRINCIPAL (TIENDA Y DETALLES)
// ==========================================
function renderGrid(catId = 'all') {
    const grid = document.getElementById('product-grid');
    if(!grid) return; grid.innerHTML = '';
    
    let filtered = products.filter(p => catId === 'all' || p.catId === catId);
    filtered.sort((a, b) => (b.pinned === true) - (a.pinned === true));
    
    filtered.forEach(p => {
        const card = document.createElement('div');
        card.className = 'product-card';
        card.onclick = () => openDetail(p.id);
        
        card.innerHTML = `
            ${isAdmin ? `
            <div style="position:absolute; top:8px; right:8px; z-index:10; display:flex; gap:5px;">
                <button onclick="event.stopPropagation(); openPublishModal('${p.id}')" style="background:var(--accent); color:white; border:none; border-radius:50%; width:24px; height:24px; font-size:12px;">✏️</button>
                <button onclick="event.stopPropagation(); deleteProduct('${p.id}')" style="background:var(--danger); color:white; border:none; border-radius:50%; width:24px; height:24px; font-size:12px;">✕</button>
            </div>
            ` : ''}
            <div class="card-img">
                <div class="price-tag">$${parseFloat(p.price).toLocaleString()}</div>
                <img src="${p.img}">
            </div>
            <div class="card-product-name">${p.name}</div>
        `;
        grid.appendChild(card);
    });
}

function renderAll() {
    const navMob = document.getElementById('mobile-nav-cats');
    const sel = document.getElementById('p-cat-select');
    const selDel = document.getElementById('d-cat-select');
    
    let htmlMob = categories.map(c => `<button onclick="setActiveCat(this, '${c.id}')">${c.name}</button>`).join('');
    let htmlOptions = categories.map(c => `<option value="${c.id}">${c.name}</option>`).join('');

    if(navMob) navMob.innerHTML = `<button class="active" onclick="setActiveCat(this, 'all')">Todas</button>` + htmlMob;
    if(sel) sel.innerHTML = htmlOptions;
    if(selDel) selDel.innerHTML = htmlOptions;
    
    renderGrid();
}

function setActiveCat(btn, catId) {
    document.querySelectorAll('.mobile-cat-nav button').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    renderGrid(catId);
}

function formatText(text) {
    if (!text) return "";
    return String(text)
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/__(.*?)__/g, '<em>$1</em>')
        .replace(/>(.*?)</g, '<mark style="background:rgba(255,215,0,0.3); color:white; padding:0 4px; border-radius:4px;">$1</mark>')
        .replace(/=#([0-9A-Fa-f]{6})(.*?)(?=\s|$)/g, '<span style="color:#$1">$2</span>')
        .replace(/\n/g, '<br>');
}

function openDetail(id) {
    const p = products.find(prod => prod.id.toString() === id.toString());
    if(!p) return;
    const body = document.getElementById('detail-body');
    
    let likes = 0, dislikes = 0;
    let myReaction = p.reactions ? p.reactions[myUserId] : null;
    
    if(p.reactions) {
        for(let user in p.reactions) {
            if(p.reactions[user] === 'like') likes++;
            if(p.reactions[user] === 'dislike') dislikes++;
        }
    }

    let commentsHTML = (p.comments || []).map(c => `
        <div style="border-bottom: 1px solid var(--border-color); padding: 10px 0; font-size: 13px;">
            <strong style="color:var(--text-muted); font-size:11px;">#${c.userId}</strong><br>
            ${c.text}
        </div>
    `).join('');

    body.innerHTML = `
        <div class="detail-layout">
            <div class="detail-img-container"><img src="${p.img}"></div>
            <div class="detail-info">
                <h2 style="margin-bottom:5px;">${p.name}</h2>
                <h3 style="color:var(--accent); margin-bottom:15px;">$${parseFloat(p.price).toLocaleString()}</h3>
                <p style="font-size:14px; flex-grow:1; line-height:1.6;">${formatText(p.desc || '')}</p>
                
                <div class="social-bar">
                    <button onclick="handleReaction('${p.id}', 'like')" style="color: ${myReaction==='like' ? 'var(--accent)' : 'inherit'}">👍 <span>${likes}</span></button>
                    <button onclick="handleReaction('${p.id}', 'dislike')" style="color: ${myReaction==='dislike' ? 'var(--danger)' : 'inherit'}">👎 <span>${dislikes}</span></button>
                </div>

                <div style="display:flex; flex-direction:column; gap:10px;">
                    <button class="apple-btn" onclick="addToCart('${p.id}'); closeModal('modal-detail')">Añadir al carrito</button>
                    <button class="apple-btn-secondary" style="background:#28a745; color:white;" onclick="window.open('https://wa.me/57${p.contact || '3128194596'}?text=${encodeURIComponent(p.wa || 'Hola')}')">Chat WhatsApp</button>
                    <button class="apple-btn-secondary" style="background:#da0081; color:white;" onclick="buyDirectNequi('${p.id}')">Pago Rápido Nequi</button>
                </div>

                <div style="margin-top: 30px; border-top: 1px solid var(--border-color); padding-top:20px;">
                    <h4 style="margin-bottom:10px;">Reseñas</h4>
                    <div style="display:flex; gap:10px; margin-bottom:15px;">
                        <input type="text" id="com-text-${p.id}" placeholder="Opina sobre esto..." style="flex-grow:1; background:var(--surface-elevated); border:none; padding:10px 15px; border-radius:20px; color:white; outline:none;">
                        <button class="apple-btn" style="width:auto; padding:10px 20px; border-radius:20px;" onclick="addComment('${p.id}')">Enviar</button>
                    </div>
                    <div style="max-height:150px; overflow-y:auto; padding-right:10px;">${commentsHTML || '<p class="text-muted" style="font-size:12px;">Sé el primero en comentar.</p>'}</div>
                </div>
            </div>
        </div>
    `; 
    openModal('modal-detail');
}

async function handleReaction(id, type) {
    const ref = db.collection("productos").doc(id.toString());
    const doc = await ref.get();
    let reactions = doc.data().reactions || {};
    if(reactions[myUserId] === type) delete reactions[myUserId]; else reactions[myUserId] = type;
    await ref.update({ reactions });
    openDetail(id); 
}

async function addComment(id) {
    const input = document.getElementById(`com-text-${id}`);
    if(!input.value) return showToast("ESCRIBE ALGO");
    await db.collection("productos").doc(id.toString()).update({
        comments: firebase.firestore.FieldValue.arrayUnion({ userId: myUserId, text: input.value, timestamp: new Date().toISOString() })
    });
    input.value = ""; showToast("COMENTARIO ENVIADO"); openDetail(id);
}

function openBigEditor() {
    document.getElementById('big-editor-area').value = document.getElementById('p-desc').value;
    openModal('modal-big-editor');
}
function saveBigEditor() {
    document.getElementById('p-desc').value = document.getElementById('big-editor-area').value;
    closeModal('modal-big-editor');
}

// ==========================================
// 10. CARRITO Y PAGOS
// ==========================================
function addToCart(id) {
    if(cartCooldowns[id] && (Date.now() - cartCooldowns[id] < 1000)) return showToast("ESPERA...");
    cartCooldowns[id] = Date.now();
    
    const productData = products.find(p => p.id.toString() === id.toString());
    if(!productData) return;

    if(cart[id]) cart[id].qty++; else cart[id] = {...productData, qty: 1};
    updateCartUI(); showToast("AÑADIDO AL CARRITO");
}

function removeFromCart(id) { delete cart[id]; updateCartUI(); }

function updateCartUI() {
    const list = document.getElementById('cart-list'); let total = 0, count = 0;
    list.innerHTML = Object.values(cart).map(p => {
        total += (p.price * p.qty); count += p.qty;
        return `
        <div style="background:var(--surface-elevated); padding:12px; border-radius:10px; margin-bottom:10px; display:flex; justify-content:space-between; align-items:center;">
            <div><strong style="font-size:14px;">${p.name} (x${p.qty})</strong><br><span style="color:var(--accent); font-weight:bold;">$${(p.price * p.qty).toLocaleString()}</span></div>
            <button onclick="removeFromCart('${p.id}')" style="background:var(--danger); color:white; border:none; border-radius:50%; width:24px; height:24px; cursor:pointer;">✕</button>
        </div>`;
    }).join('');
    document.getElementById('cart-count').innerText = count; 
    document.getElementById('cart-total').innerText = `$${total.toLocaleString()}`; 
    document.getElementById('pay-val').innerText = `$${total.toLocaleString()}`;
}

function goToWalletPayment() {
    const total = Object.values(cart).reduce((sum, p) => sum + (p.price * p.qty), 0);
    if(total === 0) return showToast("CARRITO VACÍO");
    if(currentUser.balance < total) return showToast("SALDO INSUFICIENTE. ¡RECARGA!");

    document.getElementById('w-pay-name').value = currentUser?.registered ? currentUser.name : "";
    document.getElementById('w-pay-phone').value = "";
    document.getElementById('w-pay-val').innerText = `$${total.toLocaleString()}`;
    
    closeModal('modal-cart');
    document.getElementById('wallet-form').classList.remove('hidden');
    document.getElementById('wallet-processing').classList.add('hidden');
    openModal('modal-wallet-confirm');
}

async function processWalletPayment() {
    const name = document.getElementById('w-pay-name').value.trim();
    const phone = document.getElementById('w-pay-phone').value.trim();
    const total = Object.values(cart).reduce((sum, p) => sum + (p.price * p.qty), 0);
    
    if(!name || phone.length < 10) return showToast("DATOS INVÁLIDOS");
    if(currentUser.balance < total) return showToast("SALDO INSUFICIENTE");

    document.getElementById('wallet-form').classList.add('hidden');
    document.getElementById('wallet-processing').classList.remove('hidden');

    await db.collection("usuarios").doc(myUserId).update({ balance: firebase.firestore.FieldValue.increment(-total) });
    
    const token = "WAL-" + Math.random().toString(36).substr(2,5).toUpperCase();
    let details = Object.values(cart).map(p => `${p.qty}x ${p.name}`).join(', ');
    addLog(`TOKEN: ${token}`, `WALLET: ${details} | Total: $${total}`);
    
    let tgMsg = `🟢 *COMPRA (BILLETERA)* 🟢\n\n*Token:* ${token}\n*Cliente:* ${name} (${phone})\n*ID:* #${myUserId}\n*Servicios:* ${details}\n*Total:* $${total}`;
    sendTelegramNotification(tgMsg);

    setTimeout(() => {
        cart = {}; updateCartUI(); closeModal('modal-wallet-confirm'); 
        showToast("¡COMPRA EXITOSA!");
    }, 1500);
}

function goToPayment() {
    if(Object.keys(cart).length === 0) return showToast("CARRITO VACÍO");
    closeModal('modal-cart'); openModal('modal-nequi');
}

function buyDirectNequi(id) {
    const p = products.find(prod => prod.id.toString() === id.toString()); 
    if(!p) return;
    cart = {}; addToCart(id); 
    closeModal('modal-detail'); openModal('modal-nequi');
}

function processPayment() {
    const name = document.getElementById('pay-name').value.trim();
    const phone = document.getElementById('pay-phone').value.trim();
    if(!name || phone.length < 10) return showToast("DATOS INVÁLIDOS");

    let total = Object.values(cart).reduce((sum, p) => sum + (p.price * p.qty), 0);

    document.getElementById('nequi-form').classList.add('hidden');
    document.getElementById('nequi-processing').classList.remove('hidden');

    currentReceiptContext = {
        type: 'checkout', name: name, phone: phone, amount: total,
        details: Object.values(cart).map(p => `${p.qty}x ${p.name}`).join(', '),
        token: "ORD-" + Math.random().toString(36).substr(2,5).toUpperCase()
    };

    setTimeout(() => {
        closeModal('modal-nequi');
        showReceiptModal(`Envía $${total.toLocaleString()} al NEQUI 3137074357 para completar tu orden.`);
        document.getElementById('nequi-form').classList.remove('hidden');
        document.getElementById('nequi-processing').classList.add('hidden');
    }, 2000); 
}

function addLog(action, item) {
    const log = document.getElementById('log-table');
    if(log) log.innerHTML = `<tr><td>${new Date().toLocaleTimeString()}</td><td>${action}</td><td>${item}</td></tr>` + log.innerHTML;
}

// ==========================================
// 11. COMUNIDAD Y FORO (ESTILO iMESSAGE CON VIP)
// ==========================================
function openForumModal() {
    if(!currentUser || !currentUser.registered) return showToast("DEBES REGISTRAR TU PERFIL PARA CREAR UN DEBATE");
    document.getElementById('f-title').value = "";
    document.getElementById('f-content').value = "";
    document.getElementById('f-password').value = "";
    document.getElementById('f-type').value = "publico";
    
    const vipPriceInput = document.getElementById('f-vip-price');
    const vipPhoneInput = document.getElementById('f-vip-phone');
    if(vipPriceInput) vipPriceInput.value = "";
    if(vipPhoneInput) vipPhoneInput.value = "";
    
    currentForumImg = "";
    const preview = document.getElementById('f-preview');
    if(preview) {
        preview.src = "";
        preview.classList.add('hidden');
    }
    const label = document.getElementById('f-upload-label');
    if(label) label.classList.remove('hidden');

    toggleForumPassword();
    openModal('modal-forum');
}

function toggleForumPassword() {
    const type = document.getElementById('f-type').value;
    const pwdInput = document.getElementById('f-password');
    const vipOptions = document.getElementById('f-vip-options');
    
    if(pwdInput) pwdInput.classList.add('hidden');
    if(vipOptions) vipOptions.classList.add('hidden');
    
    if(type === 'clave' && pwdInput) pwdInput.classList.remove('hidden');
    if(type === 'vip' && vipOptions) vipOptions.classList.remove('hidden');
}

function previewForumImage() {
    const file = document.getElementById('f-file-input').files[0];
    if(file) {
        const reader = new FileReader();
        reader.onloadend = () => {
            currentForumImg = reader.result;
            document.getElementById('f-preview').src = reader.result;
            document.getElementById('f-preview').classList.remove('hidden');
            document.getElementById('f-upload-label').classList.add('hidden');
        }; reader.readAsDataURL(file);
    }
}

async function saveForumPost() {
    const title = document.getElementById('f-title').value.trim();
    const content = document.getElementById('f-content').value.trim();
    const type = document.getElementById('f-type').value;
    const password = document.getElementById('f-password').value.trim();
    
    if(!title || !content) return showToast("FALTAN DATOS");
    if(type === 'clave' && !password) return showToast("DEBES ESTABLECER UNA CLAVE");

    let vipPrice = 0;
    let vipPhone = "";
    if(type === 'vip') {
        const priceInput = document.getElementById('f-vip-price');
        const phoneInput = document.getElementById('f-vip-phone');
        if(priceInput && phoneInput) {
            vipPrice = parseInt(priceInput.value);
            vipPhone = phoneInput.value.trim();
        }
        if(!vipPrice || !vipPhone) return showToast("DEBES PONER EL PRECIO Y TU WHATSAPP");
    }

    await db.collection("foro").add({
        authorId: myUserId, 
        authorName: currentUser.name || "Invitado", 
        title: title, 
        content: content, 
        img: currentForumImg, 
        type: type, 
        password: password, 
        vipPrice: vipPrice, 
        vipPhone: vipPhone, 
        accessList: [myUserId], 
        replies: [], 
        timestamp: new Date().toISOString()
    });

    closeModal('modal-forum'); 
    showToast("¡DEBATE PUBLICADO!");
}

function renderForum() {
    const feed = document.getElementById('forum-feed');
    if(!feed) return;
    
    feed.innerHTML = forumPosts.map(post => {
        let tag = '';
        if(post.type === 'vip') tag = '<span class="tag vip">VIP</span>';
        if(post.type === 'clave') tag = '<span class="tag locked">🔒 Clave</span>';
        if(post.type === 'cerrado') tag = '<span class="tag locked">Cerrado</span>';
        
        return `
        <div class="forum-thread-card" onclick="openForumThread('${post.id}')" style="position:relative;">
            ${isAdmin ? `<button onclick="event.stopPropagation(); deleteForumPost('${post.id}')" style="position:absolute; top:10px; right:10px; background:var(--danger); color:white; border:none; border-radius:50%; width:24px; height:24px;">✕</button>` : ''}
            <div style="flex-grow: 1; padding-right: 30px; display:flex; align-items:center;">
                ${post.img ? `<img src="${post.img}" style="width:40px; height:40px; border-radius:8px; object-fit:cover; margin-right:12px;">` : ''}
                <div>
                    <h3 style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-bottom:5px;">${post.title}</h3>
                    <span class="text-muted" style="font-size:12px;">Por ${post.authorName} • ${(post.replies||[]).length} msjs</span>
                </div>
            </div>
            <div>${tag}</div>
        </div>`;
    }).join('');
}

async function openForumThread(postId) {
    const post = forumPosts.find(p => p.id === postId);
    if(!post) return;
    
    if (post.type === 'vip' && !isAdmin) {
        if (!post.accessList || !post.accessList.includes(myUserId)) {
            pendingVipPost = post; 
            const priceFormat = post.vipPrice ? post.vipPrice.toLocaleString() : "0";
            document.getElementById('vip-buy-title').innerText = post.title;
            document.getElementById('vip-buy-price').innerText = "$" + priceFormat;
            openModal('modal-buy-vip');
            return; 
        }
    }

    if (post.type === 'clave' && !isAdmin) {
        const guess = prompt("Este debate requiere contraseña:");
        if (guess !== post.password) return showToast("CONTRASEÑA INCORRECTA");
    }

    currentThreadId = postId;
    showView('forum-detail');
    
    document.getElementById('chat-title-display').innerText = post.title;
    
    let statusHtml = post.type === 'cerrado' ? 'Debate cerrado' : `Activo`;
    if (isAdmin) {
        statusHtml += ` &nbsp;|&nbsp; <button onclick="deleteForumPost('${post.id}')" style="background:var(--danger); color:white; border:none; padding:3px 8px; border-radius:6px; font-size:10px; cursor:pointer; font-weight:bold;">🗑️ ELIMINAR</button>`;
    }
    document.getElementById('chat-status-display').innerHTML = statusHtml;
    
    const inputArea = document.querySelector('.chat-input-area');
    if(post.type === 'cerrado' && !isAdmin) {
        if(inputArea) inputArea.classList.add('hidden'); 
    } else {
        if(inputArea) inputArea.classList.remove('hidden');
    }

    renderChatMessages(post);
}

function renderChatMessages(post) {
    const container = document.getElementById('chat-messages');
    
    let html = `
    <div class="chat-bubble other">
        <div class="sender-name" style="color:var(--accent);">${post.authorName} (Autor)</div>
        ${post.img ? `<img src="${post.img}" style="width:100%; border-radius:10px; margin-bottom:10px;">` : ''}
        ${post.content}
        <div class="chat-time">${new Date(post.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
        ${post.type !== 'cerrado' || isAdmin ? `<button class="btn-reply-chat" onclick="setReplyTo('${post.authorName}', '${post.content.replace(/'/g,"\\'")}')">Responder</button>` : ''}
    </div>`;

    (post.replies || []).forEach(r => {
        const isMe = r.authorId === myUserId;
        const refHtml = r.replyToText ? `<div class="reply-reference"><em>${r.replyToText.substring(0, 40)}${r.replyToText.length>40?'...':''}</em></div>` : '';
        
        html += `
        <div class="chat-bubble ${isMe ? 'me' : 'other'}">
            ${!isMe ? `<div class="sender-name">${r.authorName}</div>` : ''}
            ${refHtml}
            ${r.text}
            <div class="chat-time">${new Date(r.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
            ${post.type !== 'cerrado' || isAdmin ? `<button class="btn-reply-chat" style="${isMe ? 'color:rgba(255,255,255,0.8);' : ''}" onclick="setReplyTo('${r.authorName}', '${r.text.replace(/'/g,"\\'")}')">Responder</button>` : ''}
        </div>`;
    });
    
    container.innerHTML = html;
    setTimeout(() => { container.scrollTop = container.scrollHeight; }, 50); 
}

function setReplyTo(name, textSnippet) {
    replyingTo = textSnippet;
    document.getElementById('reply-to-name').innerText = name;
    document.getElementById('replying-to-box').classList.remove('hidden');
    document.getElementById('chat-input').focus();
}

function cancelReply() {
    replyingTo = null;
    document.getElementById('replying-to-box').classList.add('hidden');
}

async function sendForumReply() {
    if(!currentUser || !currentUser.registered) return showToast("DEBES REGISTRARTE PARA COMENTAR");
    
    const input = document.getElementById('chat-input');
    const text = input.value.trim();
    if(!text || !currentThreadId) return;
    
    await db.collection("foro").doc(currentThreadId).update({
        replies: firebase.firestore.FieldValue.arrayUnion({
            authorId: myUserId, authorName: currentUser.name, text: text,
            replyToText: replyingTo, timestamp: new Date().toISOString()
        })
    });
    
    input.value = '';
    cancelReply();
}

async function deleteForumPost(id) {
    if(confirm("¿Seguro que quieres borrar este debate entero?")) {
        await db.collection("foro").doc(id).delete();
        showView('foro'); 
        showToast("DEBATE ELIMINADO");
    }
}

// ==========================================
// 12. PASARELA DE PAGO VIP
// ==========================================
async function processVipWallet() {
    if(!pendingVipPost) return;
    const price = pendingVipPost.vipPrice || 0;
    
    if(currentUser.balance < price) return showToast("SALDO INSUFICIENTE EN BILLETERA");

    closeModal('modal-buy-vip');
    showToast("Procesando acceso...");

    await db.collection("usuarios").doc(myUserId).update({ 
        balance: firebase.firestore.FieldValue.increment(-price) 
    });
    
    await db.collection("foro").doc(pendingVipPost.id).update({
        accessList: firebase.firestore.FieldValue.arrayUnion(myUserId)
    });

    const gananciaCreador = price * 0.7;
    const gananciaUranium = price * 0.3;
    const phoneFormat = pendingVipPost.vipPhone || "Desconocido";

    let tgMsg = `💎 *ACCESO VIP VENDIDO (BILLETERA)* 💎\n\n*Debate:* ${pendingVipPost.title}\n*Comprador ID:* #${myUserId}\n*Creador ID:* #${pendingVipPost.authorId}\n*Precio Pagado:* $${price}\n\n⚠️ *ACCIÓN REQUERIDA:*\nTransfiere $${gananciaCreador} al creador (WA: ${phoneFormat})\nTu ganancia libre: $${gananciaUranium}`;
    sendTelegramNotification(tgMsg);

    setTimeout(() => { 
        showToast("¡ACCESO CONCEDIDO!");
        openForumThread(pendingVipPost.id); 
    }, 1500);
}

function processVipNequi() {
    if(!pendingVipPost) return;
    closeModal('modal-buy-vip');
    
    const price = pendingVipPost.vipPrice || 0;

    currentReceiptContext = {
        type: 'vip_access', 
        postId: pendingVipPost.id,
        title: pendingVipPost.title,
        authorPhone: pendingVipPost.vipPhone || "Desconocido",
        amount: price,
        token: "VIP-" + Math.random().toString(36).substr(2,5).toUpperCase()
    };
    
    showReceiptModal(`Envía $${price.toLocaleString()} al NEQUI 3137074357 para entrar al debate VIP.\nUna vez verificado, un admin te dará acceso.`);
}
