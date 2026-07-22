/* T5 - Feed con overlay split: contenuto a sinistra, commenti a destra */

let currentOverlayMemory = null;
let feedMemories = [];

(async function init() {
    await requireAuth();
    renderNavbar('home');
    await loadFeed();

    // Se arrivo con ?open=<memoryId> (es. da "Mostra contenuto"), apro subito l'overlay
    const openId = new URLSearchParams(window.location.search).get('open');
    if (openId) {
        const m = feedMemories.find(x => String(x.id) === openId);
        if (m) openOverlay(m);
    }
})();

async function loadFeed() {
    const feedEl = document.getElementById('feed');
    feedEl.innerHTML = '<p class="text-muted">Caricamento…</p>';
    try {
        feedMemories = await api.get('/api/memories');
        if (feedMemories.length === 0) {
            feedEl.innerHTML = `<div class="card text-center">
                <p class="text-muted">Non ci sono ancora ricordi. <a href="create.html">Crea il primo!</a></p>
            </div>`;
            return;
        }
        feedEl.innerHTML = '';
        feedMemories.forEach(m => feedEl.appendChild(renderPost(m)));
    } catch (e) {
        feedEl.innerHTML = `<p class="error-message">Errore: ${e.message}</p>`;
    }
}

function mediaKind(m) {
    const ct = m.mediaContentType || '';
    if (m.type === 'photo' || m.type === 'image' || ct.startsWith('image/')) return 'image';
    if (m.type === 'audio' || ct.startsWith('audio/')) return 'audio';
    if (m.type === 'video' || ct.startsWith('video/')) return 'video';
    return null;
}

function renderMediaBlock(m, maxH = 400) {
    if (!m.mediaId) return '';
    const kind = mediaKind(m);
    if (kind === 'image') return `<img src="api/media?id=${m.mediaId}" style="max-width:100%;max-height:${maxH}px;border-radius:8px;margin:12px 0;display:block">`;
    if (kind === 'audio') return `<audio controls src="api/media?id=${m.mediaId}" style="width:100%;margin:12px 0"></audio>`;
    if (kind === 'video') return `<video controls src="api/media?id=${m.mediaId}" style="max-width:100%;max-height:${maxH}px;border-radius:8px;margin:12px 0"></video>`;
    return `<p><a href="api/media?id=${m.mediaId}" target="_blank">Apri allegato</a></p>`;
}

/**
 * Disegna l'avatar di un autore: se ha una foto profilo (avatarMediaId) mostra
 * un'immagine tonda; altrimenti mostra le iniziali come prima (fallback).
 */
function renderAvatar(name, avatarMediaId) {
    if (avatarMediaId) {
        return `<img class="post-avatar" src="api/media?id=${avatarMediaId}" alt="${escapeHtml(name || '')}"
                     style="width:40px;height:40px;border-radius:50%;object-fit:cover;flex-shrink:0">`;
    }
    return `<div class="post-avatar">${initials(name)}</div>`;
}

/**
 * Disegna il bottone like (cuore + conteggio). Usa data-memory-id per essere
 * ritrovato da handleLikeClick e aggiornato ovunque compaia (feed + overlay).
 */
function renderLikeButton(m) {
    const liked = !!m.likedByMe;
    const count = m.likeCount || 0;
    return `
        <button class="like-btn ${liked ? 'liked' : ''}" data-memory-id="${m.id}" type="button" aria-pressed="${liked}" aria-label="Metti mi piace">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="${liked ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.8 1-1a5.5 5.5 0 0 0 0-7.8z"/>
            </svg>
            <span class="like-count">${count}</span>
        </button>`;
}

function renderPost(m) {
    const el = document.createElement('article');
    el.className = 'feed-post';
    el.innerHTML = `
        <div class="post-header">
            ${renderAvatar(m.authorName, m.authorAvatarMediaId)}
            <div>
                <div class="post-author">${m.authorName}</div>
                <div class="post-meta">Data di pubblicazione: ${formatDateTime(m.createdAt)}</div>
            </div>
        </div>
        ${m.title ? `<div class="post-title">${escapeHtml(m.title)}</div>` : ''}
        ${renderMediaBlock(m, 300)}
        ${m.content ? `<div class="post-content">${escapeHtml(truncate(m.content, 220)).replace(/\n/g, '<br>')}</div>` : ''}
        ${m.taggedPersonName ? `<div class="post-tag">${m.taggedPersonName}</div>` : ''}
        <div class="post-actions">
            ${renderLikeButton(m)}
            <p class="text-muted" style="font-size:13px;margin:0">Clicca per aprire e commentare →</p>
        </div>
    `;
    // Il click sul post apre l'overlay (ma non se cliccano sul like o su player audio/video)
    el.addEventListener('click', (e) => {
        if (['AUDIO', 'VIDEO'].includes(e.target.tagName)) return;
        if (e.target.closest('.like-btn')) return;
        openOverlay(m);
    });
    return el;
}

/* ============ LIKE (delegato su tutto il documento: funziona sia nel feed che nell'overlay) ============ */
document.addEventListener('click', async (e) => {
    const btn = e.target.closest('.like-btn');
    if (!btn) return;
    e.preventDefault();
    e.stopPropagation();
    if (btn.disabled) return;

    const memoryId = Number(btn.dataset.memoryId);
    btn.disabled = true;
    try {
        const result = await api.post('/api/likes', { memoryId });

        // Aggiorna il modello locale così, se il post viene ridisegnato, resta coerente
        const m = feedMemories.find(x => x.id === memoryId);
        if (m) { m.likedByMe = result.liked; m.likeCount = result.count; }
        if (currentOverlayMemory && currentOverlayMemory.id === memoryId) {
            currentOverlayMemory.likedByMe = result.liked;
            currentOverlayMemory.likeCount = result.count;
        }

        // Aggiorna TUTTI i bottoni like di questo ricordo presenti in pagina
        // (può comparire sia nella card del feed sia nell'overlay aperto)
        document.querySelectorAll(`.like-btn[data-memory-id="${memoryId}"]`).forEach(b => {
            b.classList.toggle('liked', result.liked);
            b.setAttribute('aria-pressed', String(result.liked));
            const svg = b.querySelector('svg');
            if (svg) svg.setAttribute('fill', result.liked ? 'currentColor' : 'none');
            const countEl = b.querySelector('.like-count');
            if (countEl) countEl.textContent = result.count;
        });
    } catch (err) {
        alert('Errore: ' + err.message);
    } finally {
        btn.disabled = false;
    }
});

/* ============ OVERLAY SPLIT ============ */
const overlayEl = document.getElementById('post-overlay');
const overlayContentEl = document.getElementById('overlay-content');
const overlayCommentsListEl = document.getElementById('overlay-comments-list');

function openOverlay(m) {
    currentOverlayMemory = m;
    overlayContentEl.innerHTML = `
        <div class="post-header">
            ${renderAvatar(m.authorName, m.authorAvatarMediaId)}
            <div>
                <div class="post-author">${m.authorName}</div>
                <div class="post-meta">${formatDateTime(m.createdAt)}</div>
            </div>
        </div>
        <h2 style="margin:12px 0 6px">${escapeHtml(m.title || 'Ricordo')}</h2>
        ${renderMediaBlock(m, 380)}
        ${m.content ? `<p style="white-space:pre-wrap;line-height:1.7">${escapeHtml(m.content)}</p>` : ''}
        ${m.description ? `<p class="text-muted mt-2">${escapeHtml(m.description)}</p>` : ''}
        ${m.taggedPersonName ? `<div class="post-tag mt-2">${m.taggedPersonName}</div>` : ''}
        <div class="post-actions mt-2">
            ${renderLikeButton(m)}
        </div>
    `;
    loadOverlayComments(m.id);
    overlayEl.classList.add('open');
    document.body.style.overflow = 'hidden';
}

function closeOverlay() {
    overlayEl.classList.remove('open');
    document.body.style.overflow = '';
    currentOverlayMemory = null;
    // Pulisce ?open= dall'URL
    if (window.location.search.includes('open=')) {
        history.replaceState(null, '', 'home.html');
    }
}

document.getElementById('overlay-close').addEventListener('click', closeOverlay);
overlayEl.addEventListener('click', (e) => { if (e.target === overlayEl) closeOverlay(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeOverlay(); });

async function loadOverlayComments(memoryId) {
    overlayCommentsListEl.innerHTML = '<p class="text-muted">Caricamento…</p>';
    try {
        const comments = await api.get(`/api/comments?memoryId=${memoryId}`);
        if (comments.length === 0) {
            overlayCommentsListEl.innerHTML = '<p class="text-muted">Nessun commento ancora. Scrivi il primo!</p>';
            return;
        }
        overlayCommentsListEl.innerHTML = comments.map(c => `
            <div class="overlay-comment" style="display:flex;gap:8px;align-items:flex-start">
                ${renderAvatar(c.authorName, c.authorAvatarMediaId)}
                <div>
                    <span class="comment-author">${escapeHtml(c.authorName)}</span>
                    <span>${escapeHtml(c.text)}</span>
                </div>
            </div>
        `).join('');
        overlayCommentsListEl.scrollTop = overlayCommentsListEl.scrollHeight;
    } catch (e) {
        overlayCommentsListEl.innerHTML = `<p class="error-message">${e.message}</p>`;
    }
}

document.getElementById('overlay-comment-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentOverlayMemory) return;
    const input = document.getElementById('overlay-comment-input');
    const text = input.value.trim();
    if (!text) return;
    try {
        await api.post('/api/comments', { memoryId: currentOverlayMemory.id, text });
        input.value = '';
        await loadOverlayComments(currentOverlayMemory.id);
    } catch (err) {
        alert('Errore: ' + err.message);
    }
});

function truncate(s, n) { return s && s.length > n ? s.substring(0, n) + '…' : (s || ''); }
function escapeHtml(s) {
    if (s == null) return '';
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
        .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}