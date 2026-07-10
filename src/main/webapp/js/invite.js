/* T6 - Invita un familiare: flusso "già nell'albero?" -> seleziona o crea -> link */

let treeMembers = [];

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
    invShowStep('inv-step-form');
});

/* STEP 2a: lista membri selezionabili */
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
        const r = await api.post('/api/invite', {});
        showLinkStep(r.inviteCode, r.inviteLink, member);
    } catch (e) {
        alert('Errore: ' + e.message);
    }
}

/* STEP 2b: form nuovo familiare -> aggiungi all'albero -> genera link */
document.getElementById('inv-member-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const body = {
        firstName: document.getElementById('inv-firstName').value.trim(),
        lastName: document.getElementById('inv-lastName').value.trim(),
        gender: document.getElementById('inv-gender').value,
        birthDate: document.getElementById('inv-birthDate').value || null
    };
    try {
        const saved = await api.post('/api/tree', body);
        toast(`${saved.firstName} aggiunto all'albero`);
        const r = await api.post('/api/invite', {});
        showLinkStep(r.inviteCode, r.inviteLink, saved);
    } catch (err) {
        const el = document.getElementById('inv-form-error');
        el.textContent = 'Errore: ' + err.message;
        el.classList.remove('hidden');
    }
});

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
