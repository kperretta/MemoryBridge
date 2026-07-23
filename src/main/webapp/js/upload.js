/* T2 - Aggiungi contenuti (foto, audio, video, racconto) con upload reale al server */

const MAX_SIZE = 20 * 1024 * 1024; // 20 MB

(async function init() {
    await requireAuth();
    renderNavbar('create');

    const tree = await api.get('/api/tree');
    const sel = document.getElementById('person');
    sel.innerHTML = '<option value="">— Scegli una persona —</option>';
    tree.forEach(m => {
        sel.innerHTML += `<option value="${m.id}">${m.firstName} ${m.lastName}</option>`;
    });

    // Data massima = oggi (niente eventi nel futuro)
    document.getElementById('eventDate').max = new Date().toISOString().split('T')[0];

    // Mostra/nascondi i campi in base al tipo iniziale
    updateFieldsForType();
})();

// Aggiorna la visibilità dei campi in base al tipo scelto
function updateFieldsForType() {
    const type = document.getElementById('type').value;
    const fileGroup = document.getElementById('file-group');
    const contentGroup = document.getElementById('content').closest('.form-group');

    if (type === 'text') {
        fileGroup.classList.add('hidden');
        contentGroup.classList.remove('hidden');
        document.getElementById('file').value = '';
        document.getElementById('file-preview').innerHTML = '';
    } else {
        fileGroup.classList.remove('hidden');
        contentGroup.classList.add('hidden');
        document.getElementById('content').value = '';
        // Aggiorna anche l'accept del file input
        const accept = { photo: 'image/*', audio: 'audio/*', video: 'video/*' }[type] || '';
        document.getElementById('file').accept = accept;
    }
}

document.getElementById('type').addEventListener('change', updateFieldsForType);

// Preview del file selezionato + auto-detect del tipo
document.getElementById('file').addEventListener('change', (e) => {
    const file = e.target.files[0];
    const preview = document.getElementById('file-preview');
    preview.innerHTML = '';
    if (!file) return;

    // Controllo dimensione file
    if (file.size > MAX_SIZE) {
        preview.innerHTML = `<p class="error-message">File troppo grande: ${(file.size / 1024 / 1024).toFixed(1)} MB (max 20 MB)</p>`;
        e.target.value = '';
        return;
    }

    // AUTO-DETECT: imposta il campo "type" in base al MIME del file caricato,
    // cosi' non e' l'utente a doverlo scegliere manualmente.
    const typeSelect = document.getElementById('type');
    if (file.type.startsWith('image/')) typeSelect.value = 'photo';
    else if (file.type.startsWith('audio/')) typeSelect.value = 'audio';
    else if (file.type.startsWith('video/')) typeSelect.value = 'video';

    if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = ev => {
            preview.innerHTML = `<img src="${ev.target.result}" style="max-width:200px;border-radius:8px;margin-top:8px">`;
        };
        reader.readAsDataURL(file);
    } else if (file.type.startsWith('audio/')) {
        preview.innerHTML = `<p class="text-muted">${file.name} (${(file.size / 1024).toFixed(0)} KB)</p>`;
    } else if (file.type.startsWith('video/')) {
        preview.innerHTML = `<p class="text-muted">${file.name} (${(file.size / 1024 / 1024).toFixed(1)} MB)</p>`;
    } else {
        preview.innerHTML = `<p class="text-muted">${file.name}</p>`;
    }
});

document.getElementById('upload-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const type = document.getElementById('type').value;
    const title = document.getElementById('title').value.trim();
    const description = document.getElementById('description').value.trim();
    const content = document.getElementById('content').value.trim();
    const personId = document.getElementById('person').value;
    const eventDate = document.getElementById('eventDate').value;
    const file = document.getElementById('file').files[0];

    if (!title) { showError('Inserisci un titolo.'); return; }
    if (!personId) { showError('Scegli una persona a cui associare il contenuto.'); return; }
    if (type === 'text' && !content) { showError('Inserisci il testo del racconto.'); return; }
    if (type !== 'text' && !file) { showError('Seleziona un file da caricare.'); return; }
    if (file && file.size > MAX_SIZE) { showError('File troppo grande (max 20 MB).'); return; }

    // Controllo data non futura
    if (eventDate) {
        const today = new Date().toISOString().split('T')[0];
        if (eventDate > today) {
            showError('La data dell\'evento non può essere nel futuro.');
            return;
        }
    }

    const submitBtn = e.target.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Caricamento…';

    try {
        // 1. Se c'e' un file, upload multipart -> ricevo mediaId
        let mediaId = null;
        if (file) {
            const formData = new FormData();
            formData.append('file', file);
            const r = await fetch('api/media', {
                method: 'POST',
                credentials: 'include',
                body: formData
            });
            if (!r.ok) throw new Error('Upload file fallito');
            const { id } = await r.json();
            mediaId = id;
        }

        // 2. Creo il ricordo con il mediaId (se presente)
        await api.post('/api/memories', {
            title,
            content: content || null,
            description,
            type,
            mediaId,
            taggedPersonId: parseInt(personId),
            eventDate: eventDate || null
        });

        toast('Contenuto salvato con successo!');
        setTimeout(() => window.location.href = 'home.html', 1500);
    } catch (err) {
        showError('Errore: ' + err.message);
        submitBtn.disabled = false;
        submitBtn.textContent = 'Salva';
    }
});

function showError(msg) {
    const el = document.getElementById('error');
    el.textContent = msg;
    el.classList.remove('hidden');
}