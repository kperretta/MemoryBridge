/* T4 - Profilo membro con foto e timeline dei ricordi (immagini/audio inclusi) */

(async function init() {
    await requireAuth();
    renderNavbar();

    const id = new URLSearchParams(window.location.search).get('id');
    if (!id) {
        document.getElementById('profile-card').innerHTML = '<p class="error-message">ID membro mancante</p>';
        return;
    }

    try {
        const [person, memories] = await Promise.all([
            api.get(`/api/tree?id=${id}`),
            api.get(`/api/memories?personId=${id}`)
        ]);
        renderProfile(person);
        renderTimeline(memories);
    } catch (e) {
        document.getElementById('profile-card').innerHTML = `<p class="error-message">Errore: ${e.message}</p>`;
    }
})();

function renderProfile(p) {
    const el = document.getElementById('profile-card');
    const range = `${p.birthDate ? p.birthDate.substring(0,4) : '?'}${p.deathDate ? ' – ' + p.deathDate.substring(0,4) : ''}`;
    const avatar = p.mediaId
        ? `<img src="api/media?id=${p.mediaId}" style="width:80px;height:80px;border-radius:50%;object-fit:cover;flex-shrink:0">`
        : `<div class="post-avatar" style="width:80px;height:80px;font-size:28px;flex-shrink:0">${initials(p.firstName + ' ' + p.lastName)}</div>`;

    el.innerHTML = `
        <div class="flex-row" style="align-items:flex-start;gap:20px">
            ${avatar}
            <div style="flex:1">
                <h1 style="margin:0">${p.firstName} ${p.lastName}</h1>
                <p class="text-muted">${range} ${p.birthPlace ? '· ' + p.birthPlace : ''}</p>
                ${p.description ? `<p class="mt-1">${escapeHtml(p.description)}</p>` : ''}
            </div>
        </div>
    `;
}

function renderMediaBlock(m) {
    if (!m.mediaId) return '';
    const ct = m.mediaContentType || '';
    const isImage = m.type === 'photo' || m.type === 'image' || ct.startsWith('image/');
    const isAudio = m.type === 'audio' || ct.startsWith('audio/');
    const isVideo = m.type === 'video' || ct.startsWith('video/');

    if (isImage) {
        return `<img src="api/media?id=${m.mediaId}" style="max-width:100%;max-height:300px;border-radius:8px;margin:10px 0;display:block">`;
    }
    if (isAudio) {
        return `<audio controls src="api/media?id=${m.mediaId}" style="width:100%;margin:10px 0"></audio>`;
    }
    if (isVideo) {
        return `<video controls src="api/media?id=${m.mediaId}" style="max-width:100%;max-height:300px;border-radius:8px;margin:10px 0"></video>`;
    }
    return '';
}

function renderTimeline(memories) {
    const el = document.getElementById('timeline');
    if (memories.length === 0) {
        el.innerHTML = '<p class="text-muted">Nessun ricordo salvato per questa persona.</p>';
        return;
    }
    el.innerHTML = '';
    memories.forEach(m => {
        const item = document.createElement('div');
        item.className = 'timeline-item card card-hover';
        item.innerHTML = `
            <div class="timeline-date">${m.eventDate ? formatDate(m.eventDate) : formatDate(m.createdAt)}</div>
            <div class="post-title">${escapeHtml(m.title || 'Ricordo')}</div>
            <p class="text-muted" style="font-size:14px;margin-top:4px">di ${escapeHtml(m.authorName)}</p>
            ${renderMediaBlock(m)}
            ${m.content ? `<p class="mt-1">${escapeHtml(truncate(m.content, 140))}</p>` : ''}
        `;
        item.addEventListener('click', (e) => {
            // se cliccano sull'audio o video non aprire modal
            if (['AUDIO', 'VIDEO'].includes(e.target.tagName)) return;
            openMemoryModal(m);
        });
        el.appendChild(item);
    });
}

function openMemoryModal(m) {
    document.getElementById('memory-title').textContent = m.title || 'Ricordo';
    document.getElementById('memory-body').innerHTML = `
        <p class="text-muted mb-2">
            Raccontato da <strong>${escapeHtml(m.authorName)}</strong>
            ${m.eventDate ? ' · Evento del ' + formatDate(m.eventDate) : ''}
        </p>
        ${renderMediaBlock(m)}
        <p style="white-space:pre-wrap;line-height:1.7">${escapeHtml(m.content)}</p>
        ${m.description ? `<p class="text-muted mt-2">${escapeHtml(m.description)}</p>` : ''}
    `;
    document.getElementById('memory-modal').classList.remove('hidden');
}
function closeMemoryModal() { document.getElementById('memory-modal').classList.add('hidden'); }
window.closeMemoryModal = closeMemoryModal;

function truncate(s, n) {
    if (!s) return '';
    return s.length > n ? s.substring(0, n) + '…' : s;
}
function escapeHtml(s) {
    if (s == null) return '';
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
        .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
