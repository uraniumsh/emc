// --- LÓGICA DEL MENÚ APPLE ---
function openMenu() {
    document.getElementById('mobile-menu').classList.remove('hidden');
    document.getElementById('menu-user-name').innerText = currentUser?.registered ? currentUser.name : "Invitado";
    document.getElementById('menu-user-id').innerText = `ID: #${myUserId}`;
    
    // Solo mostramos opciones admin si el usuario de la DB tiene el rol correspondiente
    if (isAdmin) {
        document.getElementById('btn-admin-menu').classList.remove('hidden');
    }
    
    // Si estás logueado en una cuenta secundaria admin, mostramos cerrar sesión
    if (localStorage.getItem('u_admin') === 'true' && myUserId !== localStorage.getItem('original_uid')) {
        document.getElementById('btn-logout-menu').classList.remove('hidden');
    }
}
function closeMenu() { document.getElementById('mobile-menu').classList.add('hidden'); }

// --- ELIMINAR USUARIO (NUEVO) ---
async function deleteUser(id) {
    if(!isAdmin) return;
    if(confirm(`¿Estás completamente seguro de eliminar el usuario #${id}? Esto borrará su saldo y acceso.`)) {
        await db.collection("usuarios").doc(id).delete();
        showToast("USUARIO ELIMINADO");
    }
}

// Modificar cargarUsuariosEnDashboard para usar botones limpios
function cargarUsuariosEnDashboard() {
    const tbody = document.getElementById('users-table');
    if(!tbody) return;
    
    db.collection("usuarios").orderBy("lastActive", "desc").onSnapshot(snap => {
        tbody.innerHTML = '';
        snap.forEach(doc => {
            const u = doc.data();
            if(u.id === "170125") return; // Súper admin oculto
            
            const isBanned = u.banned === true;
            const nombreMostrar = u.registered ? (u.name || u.username) : 'Invitado';
            
            tbody.innerHTML += `
            <tr style="opacity: ${isBanned ? '0.5' : '1'}">
                <td><strong>${nombreMostrar}</strong><br><span class="text-muted">#${u.id}</span></td>
                <td>$${(u.balance || 0).toLocaleString()}</td>
                <td>
                    <button class="btn-sm-danger" onclick="toggleBan('${u.id}', ${!isBanned})">${isBanned ? 'Desbanear' : 'Banear'}</button>
                    ${isAdmin && u.role !== 'admin' ? `<button class="btn-sm-danger" style="margin-top:4px;" onclick="deleteUser('${u.id}')">Eliminar</button>` : ''}
                </td>
            </tr>`;
        });
    });
}

// --- ACTUALIZACIÓN DE TARJETAS DE PRODUCTO ---
// Modifica la función renderGrid() para que el card coincida con CSS
function renderGrid(catId = 'all') {
    const grid = document.getElementById('product-grid');
    if(!grid) return; grid.innerHTML = '';
    
    let filtered = products.filter(p => catId === 'all' || p.catId === catId);
    
    filtered.forEach(p => {
        const card = document.createElement('div');
        card.className = 'product-card';
        card.onclick = () => openDetail(p.id);
        
        card.innerHTML = `
            ${isAdmin ? `<div style="position:absolute; top:8px; right:8px; z-index:10;"><button onclick="event.stopPropagation(); deleteProduct('${p.id}')" style="background:var(--danger); color:white; border:none; border-radius:50%; width:24px; height:24px;">✕</button></div>` : ''}
            <div class="card-img">
                <div class="price-tag">$${parseFloat(p.price).toLocaleString()}</div>
                <img src="${p.img}">
            </div>
            <button class="btn-add-cart" onclick="event.stopPropagation(); addToCart('${p.id}')">VER MÁS</button>
        `;
        grid.appendChild(card);
    });
}

// --- LÓGICA DEL FORO ESTILO iMESSAGE ---
let currentThreadId = null;
let replyingTo = null;

function toggleForumPassword() {
    const type = document.getElementById('f-type').value;
    const pwdInput = document.getElementById('f-password');
    if(type === 'clave') pwdInput.classList.remove('hidden'); else pwdInput.classList.add('hidden');
}

// Modifica saveForumPost() para incluir tipo
async function saveForumPost() {
    const title = document.getElementById('f-title').value.trim();
    const content = document.getElementById('f-content').value.trim();
    const type = document.getElementById('f-type').value;
    const password = document.getElementById('f-password').value.trim();
    
    if(!title || !content) return showToast("Faltan datos.");
    
    await db.collection("foro").add({
        authorId: myUserId, authorName: currentUser.name, title, content, type, password,
        replies: [], timestamp: new Date().toISOString()
    });
    closeModal('modal-forum'); showToast("Debate publicado");
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
        <div class="forum-thread-card" onclick="openForumThread('${post.id}')">
            <div>
                <h3>${post.title}</h3>
                <span class="text-muted">Por ${post.authorName}</span>
            </div>
            <div>${tag}</div>
        </div>`;
    }).join('');
}

async function openForumThread(postId) {
    const post = forumPosts.find(p => p.id === postId);
    
    if (post.type === 'vip' && !isAdmin) return showToast("Acceso denegado. Solo VIP.");
    if (post.type === 'clave') {
        const guess = prompt("Este debate requiere contraseña:");
        if (guess !== post.password && !isAdmin) return showToast("Contraseña incorrecta.");
    }

    currentThreadId = postId;
    showView('forum-detail');
    
    document.getElementById('chat-title-display').innerText = post.title;
    document.getElementById('chat-status-display').innerText = post.type === 'cerrado' ? 'Debate cerrado' : `${(post.replies||[]).length} mensajes`;
    
    const inputArea = document.querySelector('.chat-input-area');
    if(post.type === 'cerrado' && !isAdmin) inputArea.classList.add('hidden'); else inputArea.classList.remove('hidden');

    renderChatMessages(post);
}

function renderChatMessages(post) {
    const container = document.getElementById('chat-messages');
    
    // Mensaje Principal
    let html = `
    <div class="chat-bubble other">
        <div class="sender-name">${post.authorName} (Autor)</div>
        ${post.content}
    </div>`;

    // Respuestas
    (post.replies || []).forEach(r => {
        const isMe = r.authorId === myUserId;
        const refHtml = r.replyToText ? `<div class="reply-reference">${r.replyToText}</div>` : '';
        
        html += `
        <div class="chat-bubble ${isMe ? 'me' : 'other'}">
            ${!isMe ? `<div class="sender-name">${r.authorName}</div>` : ''}
            ${refHtml}
            ${r.text}
            <div class="chat-time">${new Date(r.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
            <button class="btn-reply-chat" onclick="setReplyTo('${r.authorName}', '${r.text.substring(0,20)}...')">Responder</button>
        </div>`;
    });
    
    container.innerHTML = html;
    container.scrollTop = container.scrollHeight; // Auto-scroll al fondo
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
    const input = document.getElementById('chat-input');
    const text = input.value.trim();
    if(!text || !currentThreadId) return;
    
    await db.collection("foro").doc(currentThreadId).update({
        replies: firebase.firestore.FieldValue.arrayUnion({
            authorId: myUserId, authorName: currentUser.name || 'Invitado', text: text,
            replyToText: replyingTo, timestamp: new Date().toISOString()
        })
    });
    
    input.value = '';
    cancelReply();
    // La actualización se reflejará sola si mantienes el onSnapshot del foro activo
}
