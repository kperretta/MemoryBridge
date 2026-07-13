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
    window.addEventListener('resize', () => drawConnectors());
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
    container.style.position = 'relative';
    const generations = computeGenerations(members);
    generations.forEach(gen => {
        const genDiv = document.createElement('div');
        genDiv.className = 'generation';
        const ordered = orderGeneration(gen);
        const placed = new Set();
        ordered.forEach(m => {
            if (placed.has(m.id)) return;
            const spouse = m.spouseId ? ordered.find(x => x.id === m.spouseId) : null;
            if (spouse && !placed.has(spouse.id)) {
                const coupleDiv = document.createElement('div');
                coupleDiv.className = 'couple';
                coupleDiv.appendChild(renderNode(m, m.id === highlightId));
                coupleDiv.appendChild(renderNode(spouse, spouse.id === highlightId));
                genDiv.appendChild(coupleDiv);
                placed.add(m.id);
                placed.add(spouse.id);
            } else {
                genDiv.appendChild(renderNode(m, m.id === highlightId));
                placed.add(m.id);
            }
        });
        container.appendChild(genDiv);
    });
    // Disegno i collegamenti dopo che il DOM è stato inserito e misurabile
    requestAnimationFrame(drawConnectors);
}

/**
 * Calcola la generazione (livello) di ogni membro seguendo il grafo di
 * parentela (madre/padre => livello-1, figlio => livello+1, coniuge => stesso
 * livello), invece di basarsi sulla data di nascita. Gestisce più "rami"
 * familiari scollegati tra loro.
 */
function computeGenerations(members) {
    const byId = new Map(members.map(m => [m.id, m]));
    const level = new Map();

    function neighborsOf(m) {
        const n = [];
        if (m.motherId && byId.has(m.motherId)) n.push({ id: m.motherId, delta: -1 });
        if (m.fatherId && byId.has(m.fatherId)) n.push({ id: m.fatherId, delta: -1 });
        if (m.spouseId && byId.has(m.spouseId)) n.push({ id: m.spouseId, delta: 0 });
        members.forEach(child => {
            if (child.motherId === m.id || child.fatherId === m.id) {
                n.push({ id: child.id, delta: 1 });
            }
        });
        return n;
    }

    members.forEach(start => {
        if (level.has(start.id)) return;
        level.set(start.id, 0);
        const queue = [start.id];
        while (queue.length) {
            const curId = queue.shift();
            const cur = byId.get(curId);
            neighborsOf(cur).forEach(({ id, delta }) => {
                if (!level.has(id)) {
                    level.set(id, level.get(curId) + delta);
                    queue.push(id);
                }
            });
        }
    });

    const min = Math.min(...level.values());
    const generations = [];
    members.forEach(m => {
        const idx = level.get(m.id) - min;
        if (!generations[idx]) generations[idx] = [];
        generations[idx].push(m);
    });
    return generations.filter(Boolean);
}

/**
 * Ordina i membri di una generazione in modo che fratelli (stessi genitori)
 * e coniugi restino visivamente adiacenti.
 */
function orderGeneration(gen) {
    const arr = [...gen];
    arr.sort((a, b) => {
        const ka = (a.motherId || 0) + '-' + (a.fatherId || 0);
        const kb = (b.motherId || 0) + '-' + (b.fatherId || 0);
        if (ka !== kb) return ka.localeCompare(kb);
        return (a.birthDate || '').localeCompare(b.birthDate || '');
    });
    const result = [];
    const placed = new Set();
    arr.forEach(m => {
        if (placed.has(m.id)) return;
        result.push(m);
        placed.add(m.id);
        if (m.spouseId && !placed.has(m.spouseId)) {
            const spouse = arr.find(x => x.id === m.spouseId);
            if (spouse) {
                result.push(spouse);
                placed.add(spouse.id);
            }
        }
    });
    return result;
}

function renderNode(m, highlight) {
    const el = document.createElement('div');
    el.className = 'tree-node' + (highlight ? ' new-highlight' : '');
    el.dataset.id = m.id;
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

/**
 * Disegna le linee di parentela reali (genitore-figlio e coniuge-coniuge)
 * sovrapponendo un SVG al contenitore, posizionato in base alle coordinate
 * effettive dei nodi già renderizzati.
 */
function drawConnectors() {
    const container = document.getElementById('tree');
    if (!container) return;
    const old = container.querySelector('svg.tree-links');
    if (old) old.remove();
    if (!allMembers.length) return;

    const contRect = container.getBoundingClientRect();
    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('class', 'tree-links');
    svg.style.position = 'absolute';
    svg.style.top = '0';
    svg.style.left = '0';
    svg.style.width = container.scrollWidth + 'px';
    svg.style.height = container.scrollHeight + 'px';
    svg.style.pointerEvents = 'none';

    function rectOf(id) {
        const el = container.querySelector(`[data-id="${id}"]`);
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return {
            top: r.top - contRect.top + container.scrollTop,
            bottom: r.bottom - contRect.top + container.scrollTop,
            left: r.left - contRect.left + container.scrollLeft,
            right: r.right - contRect.left + container.scrollLeft,
            centerX: (r.left - contRect.left + container.scrollLeft) + r.width / 2
        };
    }

    // Linee coniugali: un tratto orizzontale tra i due partner
    allMembers.forEach(m => {
        if (m.spouseId && m.id < m.spouseId) {
            const a = rectOf(m.id), b = rectOf(m.spouseId);
            if (a && b) {
                const y = (a.top + a.bottom) / 2;
                const line = document.createElementNS(svgNS, 'line');
                const [x1, x2] = a.right < b.left ? [a.right, b.left] : [b.right, a.left];
                line.setAttribute('x1', x1);
                line.setAttribute('y1', y);
                line.setAttribute('x2', x2);
                line.setAttribute('y2', y);
                line.setAttribute('stroke', 'var(--primary)');
                line.setAttribute('stroke-width', '3');
                svg.appendChild(line);
            }
        }
    });

    function addLine(x1, y1, x2, y2) {
        const line = document.createElementNS(svgNS, 'line');
        line.setAttribute('x1', x1);
        line.setAttribute('y1', y1);
        line.setAttribute('x2', x2);
        line.setAttribute('y2', y2);
        line.setAttribute('stroke', 'var(--primary-light)');
        line.setAttribute('stroke-width', '2');
        line.setAttribute('stroke-linecap', 'round');
        svg.appendChild(line);
    }

    // Linee genitore-figlio: un unico "bus" orizzontale per ogni gruppo di
    // fratelli (stessa coppia di genitori), largo solo quanto i suoi figli,
    // così famiglie diverse nella stessa riga non si sovrappongono più.
    const familyGroups = new Map(); // "motherId-fatherId" -> [children]
    allMembers.forEach(child => {
        if (!child.motherId && !child.fatherId) return;
        const key = (child.motherId || 0) + '-' + (child.fatherId || 0);
        if (!familyGroups.has(key)) familyGroups.set(key, []);
        familyGroups.get(key).push(child);
    });

    familyGroups.forEach(children => {
        const childRects = children.map(c => rectOf(c.id)).filter(Boolean);
        if (childRects.length === 0) return;

        const sample = children[0];
        const parentIds = [sample.motherId, sample.fatherId].filter(Boolean);
        const parentRects = parentIds.map(rectOf).filter(Boolean);
        if (parentRects.length === 0) return;

        const parentX = parentRects.reduce((s, p) => s + p.centerX, 0) / parentRects.length;
        const parentY = Math.max(...parentRects.map(p => p.bottom));
        const childTop = Math.min(...childRects.map(c => c.top));
        const busY = parentY + Math.max(10, (childTop - parentY) / 2);

        const childXs = childRects.map(c => c.centerX);
        const minX = Math.min(parentX, ...childXs);
        const maxX = Math.max(parentX, ...childXs);

        // tronco dal punto medio dei genitori fino al bus
        addLine(parentX, parentY, parentX, busY);
        // bus orizzontale, largo solo quanto serve per raggiungere i figli
        addLine(minX, busY, maxX, busY);
        // discesa dal bus a ciascun figlio
        childRects.forEach(c => addLine(c.centerX, busY, c.centerX, c.top));
    });

    container.appendChild(svg);
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