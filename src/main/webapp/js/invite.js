/* T6 - Invita un familiare: flusso "già nell'albero?" -> seleziona o (rispetto a chi + relazione) -> link */

const RELATIONS = [
    { id: 'mother',  label: 'Madre' },
    { id: 'father',  label: 'Padre' },
    { id: 'spouse',  label: 'Coniuge' },
    { id: 'brother', label: 'Fratello' },
    { id: 'sister',  label: 'Sorella' },
    { id: 'son',     label: 'Figlio' },
    { id: 'daughter',label: 'Figlia' }
];

let treeMembers = [];
let relationTarget = null;
let pendingRelation = null;

(async function init() {
    await requireAuth();
    renderNavbar('invite');
    treeMembers = await api.get('/api/tree');

    // Se arrivo dall'albero con ?code=&link= gia' generati, salto al passo finale
    const params = new URLSearchParams(window.location.search);
    if (params.get('code') && params.get('link')) {
        showLinkStep(params.get('code'), params.get('link'), null);
    }
})();

function invShowStep(id) {
    ['inv-step-question', 'inv-step-select', 'inv-step-form', 'inv-step-link']
        .forEach(s => document.getElementById(s).classList.add('hidden'));
    document.getElementById(id).classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
}
window.invShowStep = invShowStep;

/* STEP 1 -> scelta */
document.getElementById('inv-yes-btn').addEventListener('click', () => {
    renderMemberList();
    invShowStep('inv-step-select');
});

document.getElementById('inv-no-btn').addEventListener('click', () => {
    pendingRelation = null;
    relationTarget = null;
    if (treeMembers.length === 0) {
        // Nessuno ancora nell'albero: niente rispetto a cui collegarsi, vado dritto al form
        document.getElementById('inv-relation-hint').textContent = 'Sarà il primo membro dell\'albero.';
        invShowStep('inv-step-form');
    } else {
        openTargetModal();
    }
});

/* STEP 2a: lista membri selezionabili (invito a persona già nell'albero) */
function renderMemberList() {
    const list = document.getElementById('inv-member-list');
    list.innerHTML = '';
    treeMembers.forEach(m => {
        const chip = document.createElement('div');
        chip.className = 'relative-chip';
        const avatar = m.mediaId
            ? `<div class="chip-avatar"><img src="api/media?id=${m.mediaId}"></div>`
            : `<div class="chip-avatar">${initials(m.firstName + ' ' + m.lastName)}</div>`;
        chip.innerHTML = `
            ${avatar}
            <div>
                <div style="font-weight:600">${m.firstName} ${m.lastName}</div>
                <div class="chip-role">${m.birthDate ? 'n. ' + m.birthDate.substring(0, 4) : ''}</div>
            </div>
        `;
        chip.addEventListener('click', () => generateInviteFor(m));
        list.appendChild(chip);
    });
}

async function generateInviteFor(member) {
    try {
        // Collego l'invito al nodo specifico scelto, cosi' chi si registra
        // con questo codice potra' confermare direttamente la propria identita'.
        const r = await api.post('/api/invite', { familyMemberId: member.id });
        showLinkStep(r.inviteCode, r.inviteLink, member);
    } catch (e) {
        alert('Errore: ' + e.message);
    }
}

/* STEP 2b: "rispetto a chi" (stesso schema del picker relazione dell'albero) */
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

function openTargetModal() {
    const grid = document.getElementById('target-grid');
    grid.innerHTML = '';
    treeMembers.forEach(m => {
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
            document.getElementById('inv-member-form').reset();
            document.getElementById('inv-relation-hint').textContent =
                `Stai aggiungendo: ${r.label} di ${target.firstName} ${target.lastName}. Il collegamento all'albero sarà automatico.`;
            if (['mother', 'sister', 'daughter'].includes(r.id)) document.getElementById('inv-gender').value = 'F';
            if (['father', 'brother', 'son'].includes(r.id)) document.getElementById('inv-gender').value = 'M';
            invShowStep('inv-step-form');
        };
        grid.appendChild(b);
    });
    document.getElementById('relation-modal').classList.remove('hidden');
}
function closeRelationModal() { document.getElementById('relation-modal').classList.add('hidden'); }
window.closeRelationModal = closeRelationModal;

/* STEP 2b (continua): form nuovo familiare -> aggiungi all'albero (con relazione) -> genera link */
document.getElementById('inv-member-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const body = {
        firstName: document.getElementById('inv-firstName').value.trim(),
        lastName: document.getElementById('inv-lastName').value.trim(),
        gender: document.getElementById('inv-gender').value,
        birthDate: document.getElementById('inv-birthDate').value || null
    };
    try {
        if (pendingRelation) applyRelationToNewMember(body, pendingRelation);
        const saved = await api.post('/api/tree', body);
        if (pendingRelation) await applyRelationToTarget(saved, pendingRelation);

        toast(`${saved.firstName} aggiunto all'albero`);
        // L'invito resta collegato al nodo appena creato per lui/lei.
        const r = await api.post('/api/invite', { familyMemberId: saved.id });
        showLinkStep(r.inviteCode, r.inviteLink, saved);
    } catch (err) {
        const el = document.getElementById('inv-form-error');
        el.textContent = 'Errore: ' + err.message;
        el.classList.remove('hidden');
    }
});

/** Stessa logica di tree.js: imposta i legami sul NUOVO membro in base alla relazione col target */
function applyRelationToNewMember(newBody, rel) {
    const target = treeMembers.find(m => m.id === rel.targetId);
    if (!target) return;

    switch (rel.relation) {
        case 'son':
        case 'daughter':
            if (target.gender === 'F') newBody.motherId = target.id;
            else newBody.fatherId = target.id;
            if (target.spouseId) {
                const spouse = treeMembers.find(m => m.id === target.spouseId);
                if (spouse) {
                    if (spouse.gender === 'F') newBody.motherId = spouse.id;
                    else newBody.fatherId = spouse.id;
                }
            }
            break;
        case 'brother':
        case 'sister':
            if (target.motherId || target.fatherId) {
                newBody.motherId = target.motherId || null;
                newBody.fatherId = target.fatherId || null;
            } else {
                newBody._siblingOf = target.id;
            }
            break;
        case 'spouse':
            newBody.spouseId = target.id;
            break;
    }
}

/** Stessa logica di tree.js: aggiorna il nodo TARGET quando serve (madre, padre, coniuge) */
async function applyRelationToTarget(savedNew, rel) {
    const target = treeMembers.find(m => m.id === rel.targetId);
    if (!target) return;

    let needsUpdate = false;
    const targetUpdate = { ...target };

    switch (rel.relation) {
        case 'mother':
        case 'father': {
            const isMother = rel.relation === 'mother';
            const phantom = target.fatherId
                ? treeMembers.find(m => m.id === target.fatherId && m.phantom)
                : null;

            if (phantom) {
                if (isMother) {
                    await api.put('/api/tree', {
                        _phantomReplace: {
                            phantomId: phantom.id,
                            realParentId: savedNew.id,
                            field: 'mother'
                        }
                    });
                } else {
                    await api.put('/api/tree', {
                        _phantomReplace: {
                            phantomId: phantom.id,
                            realParentId: savedNew.id
                        }
                    });
                }
                needsUpdate = false;
            } else {
                targetUpdate[isMother ? 'motherId' : 'fatherId'] = savedNew.id;
                needsUpdate = true;
            }
            break;
        }
        case 'spouse':
            targetUpdate.spouseId = savedNew.id;
            needsUpdate = true;
            break;
    }
    if (needsUpdate) {
        await api.put('/api/tree', targetUpdate);
    }
}

/* STEP 3: mostra link + condivisione */
function showLinkStep(code, link, member) {
    document.getElementById('code-input').value = code;
    document.getElementById('link-input').value = link;

    document.getElementById('inv-link-subtitle').textContent = member
        ? `Invito per ${member.firstName} ${member.lastName}. Condividi il link: registrandosi con questo codice entrerà nella vostra famiglia.`
        : 'Condividi il link: chi si registra con questo codice entrerà nella vostra famiglia.';

    const msg = `Ciao${member ? ' ' + member.firstName : ''}! Unisciti alla nostra famiglia su Memory Bridge per raccogliere e conservare i nostri ricordi insieme: ${link}`;
    document.getElementById('wa-btn').href = `https://wa.me/?text=${encodeURIComponent(msg)}`;
    document.getElementById('tg-btn').href = `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent('Unisciti a Memory Bridge!')}`;
    document.getElementById('mail-btn').href = `mailto:?subject=${encodeURIComponent('Ti invito su Memory Bridge')}&body=${encodeURIComponent(msg)}`;

    invShowStep('inv-step-link');
}

function copyText(id) {
    const el = document.getElementById(id);
    el.select();
    document.execCommand('copy');
    toast('Copiato negli appunti');
}
window.copyText = copyText;