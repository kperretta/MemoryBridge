/**
 * Inietta la navbar in tutte le pagine autenticate.
 * Uso: metti <div id="navbar-slot"></div> come primo elemento del body e chiama renderNavbar('home')
 * dove il parametro è la sezione attiva.
 */
function renderNavbar(activeSection) {
    const slot = document.getElementById('navbar-slot');
    if (!slot) return;

    const user = window.currentUser;
    const name = user ? user.firstName : '';

    slot.innerHTML = `
        <nav class="navbar">
            <a href="home.html" class="logo">Memory Bridge</a>
            <div class="nav-links">
                <a href="home.html" class="${activeSection === 'home' ? 'active' : ''}">Home</a>
                <a href="chat.html" class="${activeSection === 'chat' ? 'active' : ''}">Racconta</a>
                <a href="upload.html" class="${activeSection === 'upload' ? 'active' : ''}">Aggiungi contenuti</a>
                <a href="tree.html" class="${activeSection === 'tree' ? 'active' : ''}">Albero</a>
                ${name ? `<span class="user-badge">${name}</span>` : ''}
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
    window.location.href = 'index.html';
}
