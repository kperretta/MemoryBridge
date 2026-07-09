/* T4 - Profilo di un membro familiare + timeline dei ricordi ordinati per data evento */

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
    el.innerHTML = `
        <div class="flex-row" style="align-items:flex-start;gap:20px">
            <div class="post-avatar" style="width:80px;height:80px;font-size:28px;flex-shrink:0">
                ${initials(p.firstName + ' ' + p.lastName)}
            </div>
            <div style="flex:1">
                <h1 style="margin:0">${p.firstName} ${p.lastName}</h1>
                <p class="text-muted">${range} ${p.birthPlace ? '· ' + p.birthPlace : ''}</p>
                ${p.description ? `<p class="mt-1">${escapeHtml(p.description)}</p>` : ''}
            </div>
        </div>
    `;
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
            <p class="text-muted" style="font-size:14px;margin-top:4px">
                di ${escapeHtml(m.authorName)}
            </p>
            <p class="mt-1">${escapeHtml(truncate(m.content, 140))}</p>
        `;
        item.addEventListener('click', () => openMemoryModal(m));
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
        <p style="white-space:pre-wrap;line-height:1.7">${escapeHtml(m.content)}</p>
        ${m.description ? `<p class="text-muted mt-2">${escapeHtml(m.description)}</p>` : ''}
    `;
    document.getElementById('memory-modal').classList.remove('hidden');
}
function closeMemoryModal() {
    document.getElementById('memory-modal').classList.add('hidden');
}

function truncate(s, n) {
    if (!s) return '';
    return s.length > n ? s.substring(0, n) + '…' : s;
}
function escapeHtml(s) {
    if (s == null) return '';
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
        .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
