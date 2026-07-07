/* T3 - Albero genealogico con menu contestuale, aggiunta e modifica membri */

let allMembers = [];
let selectedNode = null;
let newMemberDefaults = {};   // per pre-compilare il form (es. padre da nodo cliccato)

(async function init() {
    await requireAuth();
    renderNavbar('tree');
    await loadTree();
})();

async function loadTree(highlightId) {
    allMembers = await api.get('/api/tree');
    renderTree(allMembers, highlightId);
    populateParentSelects();
}

/** Raggruppa i membri per "generazione" in base all'anno di nascita */
function renderTree(members, highlightId) {
    const container = document.getElementById('tree');
    container.innerHTML = '';

    if (members.length === 0) {
        container.innerHTML = '<p class="text-muted">Nessun membro. Aggiungi il primo!</p>';
        return;
    }

    // Ordino per anno di nascita e raggruppo per decadi di 20 anni per "generazione"
    const generations = groupByGeneration(members);

    generations.forEach((gen, idx) => {
        const genDiv = document.createElement('div');
        genDiv.className = 'generation';
        gen.forEach(m => genDiv.appendChild(renderNode(m, m.id === highlightId)));
        container.appendChild(genDiv);

        // connettore tra generazioni
        if (idx < generations.length - 1) {
            const conn = document.createElement('div');
            conn.className = 'connector';
            container.appendChild(conn);
        }
    });
}

function groupByGeneration(members) {
    // Semplice: raggruppo per intervalli di 25 anni a partire dal più vecchio
    const sorted = [...members]
        .filter(m => m.birthDate)
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
    el.innerHTML = `
        <div class="tree-node-photo">${initials(m.firstName + ' ' + m.lastName)}</div>
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

/* ========== MENU CONTESTUALE NODO ========== */
function openNodeMenu(m) {
    selectedNode = m;
    document.getElementById('node-menu-name').textContent = m.firstName + ' ' + m.lastName;
    document.getElementById('node-menu').classList.remove('hidden');
}
function closeNodeMenu() {
    document.getElementById('node-menu').classList.add('hidden');
}

document.getElementById('view-profile-btn').addEventListener('click', () => {
    if (selectedNode) window.location.href = `profile.html?id=${selectedNode.id}`;
});
document.getElementById('edit-btn').addEventListener('click', () => {
    closeNodeMenu();
    openEditModal(selectedNode);
});
document.getElementById('add-child-btn').addEventListener('click', () => {
    closeNodeMenu();
    // Pre-compila padre o madre in base al genere del nodo selezionato
    newMemberDefaults = {};
    if (selectedNode.gender === 'M') newMemberDefaults.fatherId = selectedNode.id;
    else if (selectedNode.gender === 'F') newMemberDefaults.motherId = selectedNode.id;
    openAddModal();
});
// Invito familiare (T6): mostra codice e link
document.getElementById('invite-btn').addEventListener('click', async () => {
    closeNodeMenu();
    try {
        const r = await api.post('/api/invite', {});
        const msg = `Codice invito: ${r.inviteCode}\n\nLink:\n${r.inviteLink}`;
        // Copia link negli appunti
        try { await navigator.clipboard.writeText(r.inviteLink); } catch {}
        window.location.href = `invite.html?code=${r.inviteCode}&link=${encodeURIComponent(r.inviteLink)}`;
    } catch (e) {
        alert('Errore: ' + e.message);
    }
});

/* ========== FORM AGGIUNGI/MODIFICA ========== */
function openAddModal() {
    document.getElementById('modal-title').textContent = 'Aggiungi familiare';
    document.getElementById('member-form').reset();
    document.getElementById('member-id').value = '';
    // Pre-compila padre/madre se veniamo da "Aggiungi figlio/a"
    if (newMemberDefaults.fatherId) document.getElementById('m-father').value = newMemberDefaults.fatherId;
    if (newMemberDefaults.motherId) document.getElementById('m-mother').value = newMemberDefaults.motherId;
    document.getElementById('member-modal').classList.remove('hidden');
}

function openEditModal(m) {
    document.getElementById('modal-title').textContent = 'Modifica familiare';
    document.getElementById('member-id').value = m.id;
    document.getElementById('m-firstName').value = m.firstName || '';
    document.getElementById('m-lastName').value = m.lastName || '';
    document.getElementById('m-gender').value = m.gender || 'F';
    document.getElementById('m-birthDate').value = m.birthDate || '';
    document.getElementById('m-deathDate').value = m.deathDate || '';
    document.getElementById('m-birthPlace').value = m.birthPlace || '';
    document.getElementById('m-father').value = m.fatherId || '';
    document.getElementById('m-mother').value = m.motherId || '';
    document.getElementById('m-description').value = m.description || '';
    document.getElementById('member-modal').classList.remove('hidden');
}

function closeMemberModal() {
    document.getElementById('member-modal').classList.add('hidden');
    newMemberDefaults = {};
}

function populateParentSelects() {
    const fatherSel = document.getElementById('m-father');
    const motherSel = document.getElementById('m-mother');
    fatherSel.innerHTML = '<option value="">— Nessuno —</option>';
    motherSel.innerHTML = '<option value="">— Nessuna —</option>';
    allMembers.forEach(m => {
        const label = `${m.firstName} ${m.lastName}`;
        if (m.gender === 'M' || !m.gender) fatherSel.innerHTML += `<option value="${m.id}">${label}</option>`;
        if (m.gender === 'F' || !m.gender) motherSel.innerHTML += `<option value="${m.id}">${label}</option>`;
    });
}

document.getElementById('member-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('member-id').value;
    const body = {
        firstName: document.getElementById('m-firstName').value.trim(),
        lastName: document.getElementById('m-lastName').value.trim(),
        gender: document.getElementById('m-gender').value,
        birthDate: document.getElementById('m-birthDate').value || null,
        deathDate: document.getElementById('m-deathDate').value || null,
        birthPlace: document.getElementById('m-birthPlace').value.trim(),
        fatherId: document.getElementById('m-father').value ? parseInt(document.getElementById('m-father').value) : null,
        motherId: document.getElementById('m-mother').value ? parseInt(document.getElementById('m-mother').value) : null,
        description: document.getElementById('m-description').value.trim()
    };

    try {
        let saved;
        if (id) {
            body.id = parseInt(id);
            saved = await api.put('/api/tree', body);
            toast('Familiare aggiornato');
        } else {
            saved = await api.post('/api/tree', body);
            toast('Familiare aggiunto');
        }
        closeMemberModal();
        // Miglioramento #6: highlight temporaneo sul nodo nuovo/aggiornato
        await loadTree(saved.id);
    } catch (err) {
        const el = document.getElementById('member-error');
        el.textContent = 'Errore: ' + err.message;
        el.classList.remove('hidden');
    }
});
