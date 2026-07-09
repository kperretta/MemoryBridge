/* T3 - Albero genealogico: menu 4 azioni, aggiunta per relazione, eliminazione */

let allMembers = [];
let selectedNode = null;
let pendingRelation = null;   // {relation, targetId} per il collegamento automatico

const RELATIONS = [
    { id: 'mother',  label: 'Madre' },
    { id: 'father',  label: 'Padre' },
    { id: 'spouse',  label: 'Coniuge' },
    { id: 'brother', label: 'Fratello' },
    { id: 'sister',  label: 'Sorella' },
    { id: 'son',     label: 'Figlio' },
    { id: 'daughter',label: 'Figlia' }
];

(async function init() {
    await requireAuth();
    renderNavbar('tree');
    await loadTree();
})();

async function loadTree(highlightId) {
    allMembers = await api.get('/api/tree');
    renderTree(allMembers, highlightId);
}

function renderTree(members, highlightId) {
    const container = document.getElementById('tree');
    container.innerHTML = '';
    if (members.length === 0) {
        container.innerHTML = '<p class="text-muted">Nessun membro. Aggiungi il primo!</p>';
        return;
    }
    const generations = groupByGeneration(members);
    generations.forEach((gen, idx) => {
        const genDiv = document.createElement('div');
        genDiv.className = 'generation';
        gen.forEach(m => genDiv.appendChild(renderNode(m, m.id === highlightId)));
        container.appendChild(genDiv);
        if (idx < generations.length - 1) {
            const conn = document.createElement('div');
            conn.className = 'connector';
            container.appendChild(conn);
        }
    });
}

function groupByGeneration(members) {
    const sorted = [...members].filter(m => m.birthDate)
        .sort((a, b) => a.birthDate.localeCompare(b.birthDate));
    if (sorted.length === 0) return [members];
    const startYear = parseInt(sorted[0].birthDate.substring(0, 4));
    const generations = [];
    members.forEach(m => {
        const year = m.birthDate ? parseInt(m.birthDate.substring(0, 4)) : startYear;
        const genIdx = Math.floor((year - startYear) / 25);
        if (!generations[genIdx]) generations[genIdx] = [];
        generations[genIdx].push(m);
    });
    return generations.filter(Boolean);
}

function renderNode(m, highlight) {
    const el = document.createElement('div');
    el.className = 'tree-node' + (highlight ? ' new-highlight' : '');
    const photoHtml = m.mediaId
        ? `<div class="tree-node-photo" style="overflow:hidden;padding:0"><img src="api/media?id=${m.mediaId}" style="width:100%;height:100%;object-fit:cover"></div>`
        : `<div class="tree-node-photo">${initials(m.firstName + ' ' + m.lastName)}</div>`;
    el.innerHTML = `
        ${photoHtml}
        <div class="tree-node-name">${m.firstName} ${m.lastName}</div>
        <div class="tree-node-dates">${formatYearRange(m)}</div>
    `;
    el.addEventListener('click', () => openNodeMenu(m));
    return el;
}

function formatYearRange(m) {
    const y1 = m.birthDate ? m.birthDate.substring(0, 4) : '?';
    const y2 = m.deathDate ? m.deathDate.substring(0, 4) : '';
    return y2 ? `${y1} – ${y2}` : `n. ${y1}`;
}

/* ============ MENU CONTESTUALE: 4 azioni ============ */
function openNodeMenu(m) {
    selectedNode = m;
    document.getElementById('node-menu-name').textContent = m.firstName + ' ' + m.lastName;
    document.getElementById('node-menu').classList.remove('hidden');
}
function closeNodeMenu() { document.getElementById('node-menu').classList.add('hidden'); }
window.closeNodeMenu = closeNodeMenu;

document.getElementById('open-timeline-btn').addEventListener('click', () => {
    if (selectedNode) window.location.href = `profile.html?id=${selectedNode.id}`;
});

document.getElementById('edit-btn').addEventListener('click', () => {
    closeNodeMenu();
    openEditModal(selectedNode);
});

document.getElementById('add-relative-btn').addEventListener('click', () => {
    closeNodeMenu();
    openRelationModal(selectedNode);
});

document.getElementById('delete-btn').addEventListener('click', async () => {
    if (!selectedNode) return;
    const name = selectedNode.firstName + ' ' + selectedNode.lastName;
    if (!confirm(`Vuoi davvero eliminare ${name} dall'albero?\n\nI ricordi associati resteranno salvati ma non saranno più collegati a questa persona.`)) return;
    try {
        await api.del(`/api/tree?id=${selectedNode.id}`);
        closeNodeMenu();
        toast(`${name} eliminato dall'albero`);
        await loadTree();
    } catch (e) {
        alert('Errore: ' + e.message);
    }
});

/* ============ PICKER RELAZIONE ============ */
function openRelationModal(target) {
    document.getElementById('relation-target-name').textContent = target.firstName;
    const grid = document.getElementById('relation-grid');
    grid.innerHTML = '';
    RELATIONS.forEach(r => {
        const b = document.createElement('button');
        b.className = 'relation-btn';
        b.textContent = r.label;
        b.onclick = () => {
            pendingRelation = { relation: r.id, targetId: target.id };
            closeRelationModal();
            openAddFlow(r);
        };
        grid.appendChild(b);
    });
    document.getElementById('relation-modal').classList.remove('hidden');
}
function closeRelationModal() { document.getElementById('relation-modal').classList.add('hidden'); }
window.closeRelationModal = closeRelationModal;

/* ============ FORM AGGIUNGI / MODIFICA ============ */
function openAddFlow(relation) {
    document.getElementById('modal-title').textContent = 'Aggiungi familiare';
    document.getElementById('member-form').reset();
    document.getElementById('member-id').value = '';
    document.getElementById('m-photo-preview').innerHTML = '';

    const hint = document.getElementById('relation-hint');
    if (relation && selectedNode) {
        hint.textContent = `Stai aggiungendo: ${relation.label} di ${selectedNode.firstName} ${selectedNode.lastName}. Il collegamento all'albero sarà automatico.`;
        // Pre-imposto il genere in base alla relazione
        if (['mother', 'sister', 'daughter'].includes(relation.id)) document.getElementById('m-gender').value = 'F';
        if (['father', 'brother', 'son'].includes(relation.id)) document.getElementById('m-gender').value = 'M';
    } else {
        hint.textContent = '';
        pendingRelation = null;
    }
    document.getElementById('member-modal').classList.remove('hidden');
}
window.openAddFlow = openAddFlow;

function openEditModal(m) {
    pendingRelation = null;
    document.getElementById('modal-title').textContent = 'Modifica familiare';
    document.getElementById('relation-hint').textContent = '';
    document.getElementById('member-id').value = m.id;
    document.getElementById('m-firstName').value = m.firstName || '';
    document.getElementById('m-lastName').value = m.lastName || '';
    document.getElementById('m-gender').value = m.gender || 'F';
    document.getElementById('m-birthDate').value = m.birthDate || '';
    document.getElementById('m-deathDate').value = m.deathDate || '';
    document.getElementById('m-birthPlace').value = m.birthPlace || '';
    document.getElementById('m-description').value = m.description || '';
    document.getElementById('m-photo-preview').innerHTML = m.mediaId
        ? `<img src="api/media?id=${m.mediaId}" style="max-width:100px;border-radius:8px;margin-top:8px">`
        : '';
    document.getElementById('member-modal').classList.remove('hidden');
}

function closeMemberModal() {
    document.getElementById('member-modal').classList.add('hidden');
    pendingRelation = null;
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
    const id = document.getElementById('member-id').value;
    const photoFile = document.getElementById('m-photo').files[0];

    const body = {
        firstName: document.getElementById('m-firstName').value.trim(),
        lastName: document.getElementById('m-lastName').value.trim(),
        gender: document.getElementById('m-gender').value,
        birthDate: document.getElementById('m-birthDate').value || null,
        deathDate: document.getElementById('m-deathDate').value || null,
        birthPlace: document.getElementById('m-birthPlace').value.trim(),
        description: document.getElementById('m-description').value.trim()
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

        let saved;
        if (id) {
            body.id = parseInt(id);
            const existing = allMembers.find(x => x.id === body.id);
            if (existing) {
                if (!photoFile && existing.mediaId) body.mediaId = existing.mediaId;
                body.motherId = existing.motherId;
                body.fatherId = existing.fatherId;
                body.spouseId = existing.spouseId;
            }
            saved = await api.put('/api/tree', body);
            toast('Familiare aggiornato');
        } else {
            // Collegamento automatico in base alla relazione scelta
            if (pendingRelation) applyRelationToNewMember(body, pendingRelation);
            saved = await api.post('/api/tree', body);

            // Alcune relazioni richiedono di aggiornare anche il nodo esistente
            if (pendingRelation) await applyRelationToTarget(saved, pendingRelation);
            toast('Familiare aggiunto e collegato all\'albero');
        }
        closeMemberModal();
        await loadTree(saved.id);
    } catch (err) {
        const el = document.getElementById('member-error');
        el.textContent = 'Errore: ' + err.message;
        el.classList.remove('hidden');
    }
});

/** Imposta i legami sul NUOVO membro in base alla relazione col target */
function applyRelationToNewMember(newBody, rel) {
    const target = allMembers.find(m => m.id === rel.targetId);
    if (!target) return;

    switch (rel.relation) {
        case 'son':
        case 'daughter':
            // Il nuovo è figlio/a del target
            if (target.gender === 'F') newBody.motherId = target.id;
            else newBody.fatherId = target.id;
            // Se il target ha un coniuge, e' l'altro genitore
            if (target.spouseId) {
                const spouse = allMembers.find(m => m.id === target.spouseId);
                if (spouse) {
                    if (spouse.gender === 'F') newBody.motherId = spouse.id;
                    else newBody.fatherId = spouse.id;
                }
            }
            break;
        case 'brother':
        case 'sister':
            // Stesso padre e stessa madre del target
            newBody.motherId = target.motherId || null;
            newBody.fatherId = target.fatherId || null;
            break;
        case 'spouse':
            newBody.spouseId = target.id;
            break;
        // mother/father: il legame va messo sul TARGET, non sul nuovo (fatto dopo)
    }
}

/** Aggiorna il nodo TARGET quando serve (madre, padre, coniuge) */
async function applyRelationToTarget(savedNew, rel) {
    const target = allMembers.find(m => m.id === rel.targetId);
    if (!target) return;

    let needsUpdate = false;
    const targetUpdate = { ...target };

    switch (rel.relation) {
        case 'mother':
            targetUpdate.motherId = savedNew.id;
            needsUpdate = true;
            break;
        case 'father':
            targetUpdate.fatherId = savedNew.id;
            needsUpdate = true;
            break;
        case 'spouse':
            targetUpdate.spouseId = savedNew.id;
            needsUpdate = true;
            break;
    }
    if (needsUpdate) {
        await api.put('/api/tree', targetUpdate);
    }
}
