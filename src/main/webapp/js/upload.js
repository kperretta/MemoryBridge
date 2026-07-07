/* T2 - Aggiungi contenuti (foto, audio, video, racconto) con upload reale al server */

(async function init() {
    await requireAuth();
    renderNavbar('upload');

    const tree = await api.get('/api/tree');
    const sel = document.getElementById('person');
    sel.innerHTML = '<option value="">— Scegli una persona —</option>';
    tree.forEach(m => {
        sel.innerHTML += `<option value="${m.id}">${m.firstName} ${m.lastName}</option>`;
    });
})();

// Preview del file selezionato
document.getElementById('file').addEventListener('change', (e) => {
    const file = e.target.files[0];
    const preview = document.getElementById('file-preview');
    preview.innerHTML = '';
    if (!file) return;

    if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = ev => {
            preview.innerHTML = `<img src="${ev.target.result}" style="max-width:200px;border-radius:8px;margin-top:8px">`;
        };
        reader.readAsDataURL(file);
    } else if (file.type.startsWith('audio/')) {
        preview.innerHTML = `<p class="text-muted">🎵 ${file.name} (${(file.size / 1024).toFixed(0)} KB)</p>`;
    } else if (file.type.startsWith('video/')) {
        preview.innerHTML = `<p class="text-muted">🎬 ${file.name} (${(file.size / 1024 / 1024).toFixed(1)} MB)</p>`;
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

    if (!personId) { showError('Scegli una persona a cui associare il contenuto.'); return; }
    if (type === 'text' && !content) { showError('Inserisci il testo del racconto.'); return; }
    if (type !== 'text' && !file) { showError('Seleziona un file da caricare.'); return; }

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
            content: content || (file ? file.name : ''),
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
