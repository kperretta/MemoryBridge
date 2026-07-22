/**
 * Navbar condivisa. Uso: <div id="navbar-slot"></div> + renderNavbar('home').
 * Sezioni: home | chat | create | tree | invite | profile
 */
function renderNavbar(activeSection) {
    const slot = document.getElementById('navbar-slot');
    if (!slot) return;

    const user = window.currentUser;
    const name = user ? user.firstName : '';
    // IMPORTANTE: per il profilo serve l'ID del FamilyMember (nodo dell'albero),
    // non l'ID dello User. L'endpoint /api/tree?id=... si aspetta un familyMemberId.
    const memberId = user ? user.familyMemberId : null;

    slot.innerHTML = `
        <nav class="navbar">
            <a href="home.html" class="logo">
                <img src="img/site/logo.png" alt="Memory Bridge" height="80" width="80">
                <img src="img/site/title.png" alt="Memory Bridge" height="65" width="170">
            </a>
            <div class="nav-links">
                <a href="home.html" class="${activeSection === 'home' ? 'active' : ''}">Home</a>
                <a href="chat.html" class="${activeSection === 'chat' ? 'active' : ''}">Racconta</a>
                <a href="create.html" class="${activeSection === 'create' ? 'active' : ''}">Crea contenuto</a>
                <a href="tree.html" class="${activeSection === 'tree' ? 'active' : ''}">Albero</a>
                <a href="invite.html" class="${activeSection === 'invite' ? 'active' : ''}">Invita</a>

                ${name && memberId
        ? `<a href="profile.html?id=${memberId}" class="user-badge ${activeSection === 'profile' ? 'active' : ''}">${name}</a>`
        : (name ? `<span class="user-badge" title="Profilo non ancora collegato all'albero">${name}</span>` : '')
    }

                <a href="#" onclick="logout(event)" title="Esci">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle">
                        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                        <polyline points="16 17 21 12 16 7"/>
                        <line x1="21" y1="12" x2="9" y2="12"/>
                    </svg>
                </a>
            </div>
        </nav>
    `;
}

async function logout(e) {
    if (e) e.preventDefault();
    try { await api.post('/api/me', {}); } catch {}
    // window.location.replace evita che "indietro" torni alla pagina protetta
    // e "?_=" + Date.now() forza il browser a NON usare la cache
    window.location.replace('index.html?_=' + Date.now());
}