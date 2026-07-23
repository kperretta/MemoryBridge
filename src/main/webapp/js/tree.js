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

/**
 * Renderizza l'albero includendo visivamente anche i nodi fantasma
 */
function renderTree(members, highlightId) {
    const container = document.getElementById('tree');
    container.innerHTML = '';
    if (members.length === 0) {
        container.innerHTML = '<p class="text-muted">Nessun membro. Aggiungi il primo!</p>';
        return;
    }
    container.style.position = 'relative';
    const generations = computeOrderedGenerations(members);
    generations.forEach(gen => {
        const genDiv = document.createElement('div');
        genDiv.className = 'generation';
        const placed = new Set();
        gen.forEach(m => {
            if (placed.has(m.id)) return;
            const spouse = m.spouseId ? gen.find(x => x.id === m.spouseId) : null;
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

function computeOrderedGenerations(members) {
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
    const genArrays = generations.filter(Boolean);

    const position = new Map();

    function pairSpousesArbitrarily(gen) {
        const arr = [...gen].sort((a, b) => (a.birthDate || '').localeCompare(b.birthDate || ''));
        const result = [];
        const placed = new Set();
        arr.forEach(m => {
            if (placed.has(m.id)) return;
            result.push(m);
            placed.add(m.id);
            if (m.spouseId && !placed.has(m.spouseId)) {
                const spouse = arr.find(x => x.id === m.spouseId);
                if (spouse) { result.push(spouse); placed.add(spouse.id); }
            }
        });
        return result;
    }

    genArrays.forEach((gen, genIdx) => {
        const base = genIdx === 0 ? pairSpousesArbitrarily(gen) : gen;
        const provisional = new Map();

        let pending = [...base];
        let changed = true;
        while (changed && pending.length) {
            changed = false;
            pending = pending.filter(m => {
                const parentPositions = [m.motherId, m.fatherId]
                    .filter(Boolean)
                    .map(id => position.get(id))
                    .filter(p => p !== undefined);
                if (parentPositions.length) {
                    provisional.set(m.id, parentPositions.reduce((a, b) => a + b, 0) / parentPositions.length);
                    changed = true;
                    return false;
                }
                if (m.spouseId && provisional.has(m.spouseId)) {
                    provisional.set(m.id, provisional.get(m.spouseId) + 0.5);
                    changed = true;
                    return false;
                }
                return true;
            });
        }

        pending.forEach(m => {
            const idx = base.indexOf(m);
            provisional.set(m.id, idx * 10);
        });

        const ordered = [...gen].sort((a, b) => {
            const pa = provisional.get(a.id);
            const pb = provisional.get(b.id);
            if (pa !== pb) return pa - pb;
            return (a.birthDate || '').localeCompare(b.birthDate || '');
        });

        ordered.forEach((m, i) => position.set(m.id, provisional.get(m.id) + i * 0.0001));

        genArrays[genIdx] = ordered;
    });

    return genArrays;
}

function renderNode(m, highlight) {
    const el = document.createElement('div');
    el.dataset.id = m.id;

    // Se è un genitore fantasma, restituisce la card tratteggiata
    if (m.phantom) {
        el.className = 'tree-node phantom-node';
        el.innerHTML = `
            <div class="tree-node-photo" style="border: 2px dashed #a0a0a0; background: transparent; display:flex; align-items:center; justify-content:center;">
                <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-dasharray="2 2">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                    <circle cx="12" cy="7" r="4"></circle>
                </svg>
            </div>
            <div class="tree-node-name">Genitore ignoto</div>
            <div class="tree-node-dates" style="font-size: 0.75rem; opacity: 0.8;">(Non registrato)</div>
        `;

        el.addEventListener('click', () => {
            openEditModal({ id: m.id, firstName: '', lastName: '', gender: 'M' });
        });

        return el;
    }

    // Nodo standard
    el.className = 'tree-node' + (highlight ? ' new-highlight' : '');
    const photoHtml = m.mediaId
        ? `<div class="tree-node-photo" style="overflow:hidden;padding:0"><img src="api/media?id=${m.mediaId}" style="width:100%;height:100%;object-fit:cover"></div>`
        : `<div class="tree-node-photo">${initials(m.firstName + ' ' + m.lastName)}</div>`;

    el.innerHTML = `
        <div class="node-actions">
            <button class="node-action" data-action="add" data-tip="Aggiungi familiare" aria-label="Aggiungi familiare">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
                    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
            </button>
            <button class="node-action" data-action="edit" data-tip="Modifica" aria-label="Modifica">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
                </svg>
            </button>
            <button class="node-action danger" data-action="delete" data-tip="Elimina" aria-label="Elimina">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                </svg>
            </button>
        </div>
        ${photoHtml}
        <div class="tree-node-name">${m.firstName} ${m.lastName}</div>
        <div class="tree-node-dates">${formatYearRange(m)}</div>
    `;

    el.addEventListener('click', (e) => {
        if (e.target.closest('.node-action')) return;
        window.location.href = `profile.html?id=${m.id}`;
    });

    el.querySelectorAll('.node-action').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const action = btn.dataset.action;
            selectedNode = m;
            if (action === 'add') openRelationModal(m);
            else if (action === 'edit') openEditModal(m);
            else if (action === 'delete') handleDelete(m);
        });
    });

    return el;
}

async function handleDelete(m) {
    const name = m.firstName + ' ' + m.lastName;
    if (!confirm(`Vuoi davvero eliminare ${name} dall'albero?\n\nI ricordi associati resteranno salvati ma non saranno più collegati a questa persona.`)) return;
    try {
        await api.del(`/api/tree?id=${m.id}`);
        toast(`${name} eliminato dall'albero`);
        await loadTree();
    } catch (e) {
        alert('Errore: ' + e.message);
    }
}

function formatYearRange(m) {
    const y1 = m.birthDate ? m.birthDate.substring(0, 4) : '?';
    const y2 = m.deathDate ? m.deathDate.substring(0, 4) : '';
    return y2 ? `${y1} – ${y2}` : `n. ${y1}`;
}

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

    const familyGroups = new Map();
    allMembers.forEach(child => {
        if (!child.motherId && !child.fatherId) return;
        const key = (child.motherId || 0) + '-' + (child.fatherId || 0);
        if (!familyGroups.has(key)) familyGroups.set(key, []);
        familyGroups.get(key).push(child);
    });

    const familyList = [];

    familyGroups.forEach((children, key) => {
        const childRects = children.map(c => rectOf(c.id)).filter(Boolean);
        if (childRects.length === 0) return;

        const sample = children[0];
        const parentIds = [sample.motherId, sample.fatherId].filter(Boolean);
        const parentRects = parentIds.map(rectOf).filter(Boolean);

        const childXs = childRects.map(c => c.centerX);
        const childTop = Math.min(...childRects.map(c => c.top));

        let parentX, parentY;
        if (parentRects.length > 0) {
            parentX = parentRects.reduce((s, p) => s + p.centerX, 0) / parentRects.length;
            parentY = Math.max(...parentRects.map(p => p.bottom));
        } else {
            parentX = childXs.reduce((a, b) => a + b, 0) / childXs.length;
            parentY = childTop - 40;
        }

        familyList.push({
            key,
            childRects,
            parentX,
            parentY,
            childTop,
            minX: Math.min(parentX, ...childXs),
            maxX: Math.max(parentX, ...childXs)
        });
    });

    const gapGroups = new Map();
    familyList.forEach(f => {
        const gapKey = Math.round(f.parentY / 4) * 4;
        if (!gapGroups.has(gapKey)) gapGroups.set(gapKey, []);
        gapGroups.get(gapKey).push(f);
    });

    const TIERS = 3;
    gapGroups.forEach(group => {
        group.sort((a, b) => a.minX - b.minX);
        group.forEach((f, i) => {
            const tier = i % TIERS;
            const range = f.childTop - f.parentY;
            f.busY = f.parentY + range * ((tier + 1) / (TIERS + 1));
        });
    });

    familyList.forEach(f => {
        addLine(f.parentX, f.parentY, f.parentX, f.busY);
        addLine(f.minX, f.busY, f.maxX, f.busY);
        f.childRects.forEach(c => addLine(c.centerX, f.busY, c.centerX, c.top));
    });

    container.appendChild(svg);
}

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
            if (pendingRelation) applyRelationToNewMember(body, pendingRelation);
            saved = await api.post('/api/tree', body);
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

async function applyRelationToTarget(savedNew, rel) {
    const target = allMembers.find(m => m.id === rel.targetId);
    if (!target) return;

    let needsUpdate = false;
    const targetUpdate = { ...target };

    switch (rel.relation) {
        case 'mother':
        case 'father': {
            const isMother = rel.relation === 'mother';
            const phantom = target.fatherId
                ? allMembers.find(m => m.id === target.fatherId && m.phantom)
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