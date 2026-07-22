/* Onboarding post-registrazione: collega l'account a un nodo dell'albero */

const RELATIONS = [
    { id: 'mother',  label: 'Madre' },
    { id: 'father',  label: 'Padre' },
    { id: 'spouse',  label: 'Coniuge' },
    { id: 'brother', label: 'Fratello' },
    { id: 'sister',  label: 'Sorella' },
    { id: 'son',     label: 'Figlio' },
    { id: 'daughter',label: 'Figlia' }
];



let allMembers = [];
let selectedUnlinkedId = null;
let relationTarget = null;
let pendingRelation = null;

(async function init() {
    await requireAuth();
    renderNavbar();
    allMembers = await api.get('/api/tree');
    renderUnlinkedGrid();
})();

function makePickerCard(m, onClick) {
    const card = document.createElement('div');
    card.className = 'picker-card';
    const photoHtml = m.mediaId
        ? `<div class="tree-node-photo" style="overflow:hidden;padding:0"><img src="api/media?id=${m.mediaId}" style="width:100%;height:100%;object-fit:cover"></div>`
        : `<div class="tree-node-photo">${initials(m.firstName + ' ' + m.lastName)}</div>`;
    card.innerHTML = `
        ${photoHtml}
        <div class="tree-node-name">${m.firstName} ${m.lastName}</div>
    `;
    card.addEventListener('click', onClick);
    return card;
}

/* ===== Percorso "sono già nell'albero" ===== */
function renderUnlinkedGrid() {
    const grid = document.getElementById('unlinked-grid');
    // Solo i nodi non ancora collegati a nessun account possono essere scelti
    const candidates = allMembers.filter(m => !m.userId);
    grid.innerHTML = '';
    if (candidates.length === 0) {
        grid.innerHTML = '<p class="text-muted">Non ci sono ancora membri senza un account collegato: puoi comunque aggiungerti come nuovo membro qui sotto.</p>';
        return;
    }
    candidates.forEach(m => {
        const card = makePickerCard(m, () => {
            document.querySelectorAll('#unlinked-grid .picker-card').forEach(c => c.classList.remove('selected'));
            card.classList.add('selected');
            selectedUnlinkedId = m.id;
            document.getElementById('confirm-self-btn').disabled = false;
        });
        grid.appendChild(card);
    });
}

document.getElementById('confirm-self-btn').addEventListener('click', async () => {
    if (!selectedUnlinkedId) return;
    try {
        await api.post('/api/link-self', { familyMemberId: selectedUnlinkedId });
        toast('Ti abbiamo collegato al tuo nodo nell\'albero');
        window.location.href = 'tree.html';
    } catch (e) {
        alert('Errore: ' + e.message);
    }
});

document.getElementById('skip-btn').addEventListener('click', () => {
    window.location.href = 'home.html';
});

/* ===== Percorso "aggiungimi come nuovo membro" ===== */
document.getElementById('create-new-btn').addEventListener('click', () => {
    if (allMembers.length === 0) {
        // Nessuno ancora nell'albero per questa famiglia: mi aggiungo senza relazione
        pendingRelation = null;
        relationTarget = null;
        openMemberModal(null);
        return;
    }
    openTargetModal();
});

function openTargetModal() {
    const grid = document.getElementById('target-grid');
    grid.innerHTML = '';
    allMembers.forEach(m => {
        grid.appendChild(makePickerCard(m, () => {
            relationTarget = m;
            closeTargetModal();
            openRelationModal(m);
        }));
    });
    document.getElementById('target-modal').classList.remove('hidden');
}
function closeTargetModal() { document.getElementById('target-modal').classList.add('hidden'); }
window.closeTargetModal = closeTargetModal;

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
            openMemberModal(r);
        };
        grid.appendChild(b);
    });
    document.getElementById('relation-modal').classList.remove('hidden');
}
function closeRelationModal() { document.getElementById('relation-modal').classList.add('hidden'); }
window.closeRelationModal = closeRelationModal;

function openMemberModal(relation) {
    document.getElementById('member-form').reset();
    const hint = document.getElementById('relation-hint');
    if (relation && relationTarget) {
        hint.textContent = `Ti stai aggiungendo come: ${relation.label} di ${relationTarget.firstName} ${relationTarget.lastName}. Il collegamento all'albero sarà automatico.`;
        if (['mother', 'sister', 'daughter'].includes(relation.id)) document.getElementById('m-gender').value = 'F';
        if (['father', 'brother', 'son'].includes(relation.id)) document.getElementById('m-gender').value = 'M';
    } else {
        hint.textContent = 'Sarai il primo membro del tuo nucleo familiare nell\'albero.';
    }
    document.getElementById('member-modal').classList.remove('hidden');
}
function closeMemberModal() {
    document.getElementById('member-modal').classList.add('hidden');
    pendingRelation = null;
}
window.closeMemberModal = closeMemberModal;

document.getElementById('member-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const body = {
        firstName: document.getElementById('m-firstName').value.trim(),
        lastName: document.getElementById('m-lastName').value.trim(),
        gender: document.getElementById('m-gender').value,
        birthDate: document.getElementById('m-birthDate').value || null,
        birthPlace: document.getElementById('m-birthPlace').value.trim()
    };

    try {
        if (pendingRelation) applyRelationToNewMember(body, pendingRelation);
        const saved = await api.post('/api/tree', body);
        if (pendingRelation) await applyRelationToTarget(saved, pendingRelation);

        // Collego il nodo appena creato al proprio account (server-side,
        // il userId non viene mai inviato dal client)
        await api.post('/api/link-self', { familyMemberId: saved.id });

        toast('Sei stato aggiunto all\'albero');
        window.location.href = 'tree.html';
    } catch (err) {
        const el = document.getElementById('member-error');
        el.textContent = 'Errore: ' + err.message;
        el.classList.remove('hidden');
    }
});

/** Stessa logica di tree.js: imposta i legami sul NUOVO membro in base alla relazione col target */
function applyRelationToNewMember(newBody, rel) {
    const target = allMembers.find(m => m.id === rel.targetId);
    if (!target) return;

    switch (rel.relation) {
        case 'son':
        case 'daughter':
            if (target.gender === 'F') newBody.motherId = target.id;
            else newBody.fatherId = target.id;
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
            newBody.motherId = target.motherId || null;
            newBody.fatherId = target.fatherId || null;
            break;
        case 'spouse':
            newBody.spouseId = target.id;
            break;
        // mother/father: il legame va sul TARGET, non sul nuovo (fatto dopo)
    }
}

/** Stessa logica di tree.js: aggiorna il nodo TARGET quando serve (madre, padre, coniuge) */
async function applyRelationToTarget(savedNew, rel) {
    const target = allMembers.find(m => m.id === rel.targetId);
    if (!target) return;

    let needsUpdate = false;
    const targetUpdate = { ...target };

    switch (rel.relation) {
        case 'mother': targetUpdate.motherId = savedNew.id; needsUpdate = true; break;
        case 'father': targetUpdate.fatherId = savedNew.id; needsUpdate = true; break;
        case 'spouse': targetUpdate.spouseId = savedNew.id; needsUpdate = true; break;
    }
    if (needsUpdate) {
        await api.put('/api/tree', targetUpdate);
    }
}