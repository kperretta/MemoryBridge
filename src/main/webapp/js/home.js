/* T5 - Feed della famiglia con visualizzazione e commento dei contenuti */

(async function init() {
    await requireAuth();
    renderNavbar('home');
    await loadFeed();
})();

async function loadFeed() {
    const feedEl = document.getElementById('feed');
    feedEl.innerHTML = '<p class="text-muted">Caricamento…</p>';

    try {
        const memories = await api.get('/api/memories');
        if (memories.length === 0) {
            feedEl.innerHTML = `<div class="card text-center">
                <p class="text-muted">Non ci sono ancora ricordi. <a href="chat.html">Racconta il primo!</a></p>
            </div>`;
            return;
        }
        feedEl.innerHTML = '';
        memories.forEach(m => feedEl.appendChild(renderPost(m)));
    } catch (e) {
        feedEl.innerHTML = `<p class="error-message">Errore: ${e.message}</p>`;
    }
}

function renderPost(m) {
    const el = document.createElement('article');
    el.className = 'feed-post';
    el.innerHTML = `
        <div class="post-header">
            <div class="post-avatar">${initials(m.authorName)}</div>
            <div>
                <div class="post-author">${m.authorName}</div>
                <div class="post-meta">${formatDateTime(m.createdAt)}</div>
            </div>
        </div>
        ${m.title ? `<div class="post-title">${escapeHtml(m.title)}</div>` : ''}
        <div class="post-content">${escapeHtml(m.content).replace(/\n/g, '<br>')}</div>
        ${m.taggedPersonName ? `<div class="post-tag">📌 ${m.taggedPersonName}</div>` : ''}
        <div class="comment-list" data-memory-id="${m.id}">
            <p class="text-muted" style="font-size:13px">Caricamento commenti…</p>
        </div>
        <form class="comment-form" data-memory-id="${m.id}">
            <input type="text" placeholder="Scrivi un commento…" required>
            <button type="submit" class="btn btn-secondary">Invia</button>
        </form>
    `;
    // Carica commenti in background
    loadComments(m.id, el.querySelector('.comment-list'));

    // Gestione submit commento
    el.querySelector('.comment-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const input = e.target.querySelector('input');
        const text = input.value.trim();
        if (!text) return;
        try {
            await api.post('/api/comments', { memoryId: m.id, text });
            input.value = '';
            await loadComments(m.id, el.querySelector('.comment-list'));
        } catch (err) {
            alert('Errore: ' + err.message);
        }
    });

    return el;
}

async function loadComments(memoryId, container) {
    try {
        const comments = await api.get(`/api/comments?memoryId=${memoryId}`);
        if (comments.length === 0) {
            container.innerHTML = '<p class="text-muted" style="font-size:13px">Nessun commento. Sii il primo!</p>';
            return;
        }
        container.innerHTML = comments.map(c => `
            <div class="comment">
                <span class="comment-author">${escapeHtml(c.authorName)}</span>
                <span>${escapeHtml(c.text)}</span>
            </div>
        `).join('');
    } catch (e) {
        container.innerHTML = `<p class="error-message">${e.message}</p>`;
    }
}

function escapeHtml(s) {
    if (s == null) return '';
    return String(s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
