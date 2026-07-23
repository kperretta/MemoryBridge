/* T4 - Profilo: dati, familiari stretti, personalità Iris, timeline verticale */

let allMembers = [];
let currentPerson = null;
let isOwnProfile = false;

(async function init() {
    await requireAuth();
    renderNavbar();

    const id = new URLSearchParams(window.location.search).get('id');
    if (!id) {
        document.getElementById('profile-card').innerHTML = '<p class="error-message">ID membro mancante</p>';
        return;
    }
    const memberId = parseInt(id);

    try {
        const [person, memories, tree] = await Promise.all([
            api.get(`/api/tree?id=${memberId}`),
            api.get(`/api/memories?personId=${memberId}`),
            api.get('/api/tree')
        ]);
        allMembers = tree;
        currentPerson = person;

        // Il bottone "Modifica profilo" compare solo se questo è il profilo
        // dell'utente attualmente loggato (aperto dalla navbar), non quando
        // si sta consultando il profilo di un altro familiare.
        isOwnProfile = !!(window.currentUser && window.currentUser.familyMemberId === memberId);
        document.getElementById('edit-profile-btn').classList.toggle('hidden', !isOwnProfile);

        renderProfile(person);
        renderRelatives(person);
        renderTimeline(memories);
        loadPersonality(memberId);
    } catch (e) {
        document.getElementById('profile-card').innerHTML = `<p class="error-message">Errore: ${e.message}</p>`;
    }
})();

function renderProfile(p) {
    const el = document.getElementById('profile-card');
    const range = `${p.birthDate ? formatDate(p.birthDate) : '?'}${p.deathDate ? ' – ' + formatDate(p.deathDate) : ''}`;
    const avatar = p.mediaId
        ? `<img src="api/media?id=${p.mediaId}" style="width:96px;height:96px;border-radius:50%;object-fit:cover;flex-shrink:0">`
        : `<div class="post-avatar" style="width:96px;height:96px;font-size:32px;flex-shrink:0">${initials(p.firstName + ' ' + p.lastName)}</div>`;

    el.innerHTML = `
        <div class="flex-row" style="align-items:flex-start;gap:24px;flex-wrap:wrap">
            ${avatar}
            <div style="flex:1;min-width:220px">
                <h1 style="margin:0 0 4px">${p.firstName} ${p.lastName}</h1>
                <p class="text-muted" style="font-size:15px">${range}</p>
                ${p.birthPlace ? `<p class="text-muted"> Nato/a a ${escapeHtml(p.birthPlace)}</p>` : ''}
                ${p.description ? `<p class="mt-1">${escapeHtml(p.description)}</p>` : ''}
            </div>
        </div>
    `;
}

/* Calcola i familiari stretti dal grafo: genitori, coniuge, figli, fratelli */
function renderRelatives(p) {
    const container = document.getElementById('relatives-list');
    const rels = [];

    const byId = id => allMembers.find(m => m.id === id);

    if (p.motherId) { const m = byId(p.motherId); if (m) rels.push({ m, role: 'Madre' }); }
    if (p.fatherId) { const m = byId(p.fatherId); if (m) rels.push({ m, role: 'Padre' }); }
    if (p.spouseId) { const m = byId(p.spouseId); if (m) rels.push({ m, role: 'Coniuge' }); }

    // Figli: chi ha p come madre o padre
    allMembers.filter(m => m.motherId === p.id || m.fatherId === p.id)
        .forEach(m => rels.push({ m, role: m.gender === 'F' ? 'Figlia' : 'Figlio' }));

    // Fratelli: stessi genitori (almeno uno in comune), escluso se stesso
    allMembers.filter(m => m.id !== p.id &&
        ((p.motherId && m.motherId === p.motherId) || (p.fatherId && m.fatherId === p.fatherId)))
        .forEach(m => rels.push({ m, role: m.gender === 'F' ? 'Sorella' : 'Fratello' }));

    if (rels.length === 0) {
        container.innerHTML = '<p class="text-muted">Nessun familiare collegato nell\'albero.</p>';
        return;
    }
    container.innerHTML = '';
    rels.forEach(({ m, role }) => {
        const chip = document.createElement('div');
        chip.className = 'relative-chip';
        const avatar = m.mediaId
            ? `<div class="chip-avatar"><img src="api/media?id=${m.mediaId}"></div>`
            : `<div class="chip-avatar">${initials(m.firstName + ' ' + m.lastName)}</div>`;
        chip.innerHTML = `
            ${avatar}
            <div>
                <div style="font-weight:600;font-size:14px">${m.firstName} ${m.lastName}</div>
                <div class="chip-role">${role}</div>
            </div>
        `;
        chip.addEventListener('click', () => window.location.href = `profile.html?id=${m.id}`);
        container.appendChild(chip);
    });
}

/* ===== Modifica profilo (solo proprietario) ===== */
document.getElementById('edit-profile-btn').addEventListener('click', () => {
    if (!isOwnProfile || !currentPerson) return;
    openEditModal(currentPerson);
});

function openEditModal(p) {
    document.getElementById('modal-title').textContent = 'Modifica profilo';
    document.getElementById('relation-hint').textContent = '';
    document.getElementById('member-id').value = p.id;
    document.getElementById('m-firstName').value = p.firstName || '';
    document.getElementById('m-lastName').value = p.lastName || '';
    document.getElementById('m-gender').value = p.gender || 'F';
    document.getElementById('m-birthDate').value = p.birthDate || '';
    document.getElementById('m-deathDate').value = p.deathDate || '';
    document.getElementById('m-birthPlace').value = p.birthPlace || '';
    document.getElementById('m-description').value = p.description || '';
    document.getElementById('m-photo').value = '';
    document.getElementById('m-photo-preview').innerHTML = p.mediaId
        ? `<img src="api/media?id=${p.mediaId}" style="max-width:100px;border-radius:8px;margin-top:8px">`
        : '';
    document.getElementById('member-error').classList.add('hidden');
    document.getElementById('member-modal').classList.remove('hidden');
}

function closeMemberModal() {
    document.getElementById('member-modal').classList.add('hidden');
}
window.closeMemberModal = closeMemberModal;

document.getElementById('m-photo').addEventListener('change', (e) => {
    const file = e.target.files[0];
    const preview = document.getElementById('m-photo-preview');
    if (!file) { preview.innerHTML = ''; return; }
    const r = new FileReader();
    r.onload = ev => preview.innerHTML = `<img src="${ev.target.result}" style="max-width:100px;border-radius:8px;margin-top:8px">`;
    r.readAsDataURL(file);
});

document.getElementById('member-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!isOwnProfile || !currentPerson) return;

    const photoFile = document.getElementById('m-photo').files[0];
    const body = {
        id: currentPerson.id,
        firstName: document.getElementById('m-firstName').value.trim(),
        lastName: document.getElementById('m-lastName').value.trim(),
        gender: document.getElementById('m-gender').value,
        birthDate: document.getElementById('m-birthDate').value || null,
        deathDate: document.getElementById('m-deathDate').value || null,
        birthPlace: document.getElementById('m-birthPlace').value.trim(),
        description: document.getElementById('m-description').value.trim(),
        // Le relazioni non si toccano da qui: si modificano solo dall'albero.
        motherId: currentPerson.motherId,
        fatherId: currentPerson.fatherId,
        spouseId: currentPerson.spouseId,
        mediaId: currentPerson.mediaId
    };

    try {
        if (photoFile) {
            const fd = new FormData();
            fd.append('file', photoFile);
            const r = await fetch('api/media', { method: 'POST', credentials: 'include', body: fd });
            if (!r.ok) throw new Error('Upload foto fallito');
            const { id: mediaId } = await r.json();
            body.mediaId = mediaId;
        }

        const saved = await api.put('/api/tree', body);
        currentPerson = saved;
        renderProfile(saved);
        closeMemberModal();
        toast('Profilo aggiornato');
    } catch (err) {
        const el = document.getElementById('member-error');
        el.textContent = 'Errore: ' + err.message;
        el.classList.remove('hidden');
    }
});

/* Personalità generata da Iris (backend) */
async function loadPersonality(memberId) {
    try {
        const r = await api.get(`/api/iris?personality=${memberId}`);
        document.getElementById('personality-text').textContent = r.personality;
        document.getElementById('personality-text').classList.remove('text-muted');
    } catch (e) {
        document.getElementById('personality-text').textContent = 'Iris non riesce a comporre il ritratto in questo momento.';
    }
}

function mediaKind(m) {
    const ct = m.mediaContentType || '';
    if (m.type === 'photo' || m.type === 'image' || ct.startsWith('image/')) return 'image';
    if (m.type === 'audio' || ct.startsWith('audio/')) return 'audio';
    if (m.type === 'video' || ct.startsWith('video/')) return 'video';
    return null;
}

function renderMediaBlock(m, maxH = 300) {
    if (!m.mediaId) return '';
    const kind = mediaKind(m);
    if (kind === 'image') return `<img src="api/media?id=${m.mediaId}" style="max-width:100%;max-height:${maxH}px;border-radius:8px;margin:10px 0;display:block">`;
    if (kind === 'audio') return `<audio controls src="api/media?id=${m.mediaId}" style="width:100%;margin:10px 0"></audio>`;
    if (kind === 'video') return `<video controls src="api/media?id=${m.mediaId}" style="max-width:100%;max-height:${maxH}px;border-radius:8px;margin:10px 0"></video>`;
    return '';
}

function renderTimeline(memories) {
    const el = document.getElementById('timeline');
    if (memories.length === 0) {
        el.innerHTML = '<p class="text-muted">Nessun ricordo salvato per questa persona. I contenuti che la riguardano compariranno qui.</p>';
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
            ${renderMediaBlock(m, 200)}
            ${m.content ? `<p class="mt-1">${escapeHtml(truncate(m.content, 140))}</p>` : ''}
        `;
        item.addEventListener('click', (e) => {
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
        ${renderMediaBlock(m, 360)}
        <p style="white-space:pre-wrap;line-height:1.7">${escapeHtml(m.content)}</p>
        ${m.description ? `<p class="text-muted mt-2">${escapeHtml(m.description)}</p>` : ''}
    `;
    document.getElementById('memory-modal').classList.remove('hidden');
}
function closeMemoryModal() { document.getElementById('memory-modal').classList.add('hidden'); }
window.closeMemoryModal = closeMemoryModal;

function truncate(s, n) { return s && s.length > n ? s.substring(0, n) + '…' : (s || ''); }
function escapeHtml(s) {
    if (s == null) return '';
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
        .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
