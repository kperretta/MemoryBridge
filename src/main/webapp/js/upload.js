/* T2 - Aggiungi contenuti (foto, audio, video, racconto) e associali a una persona */

(async function init() {
    await requireAuth();
    renderNavbar('upload');

    // Popola dropdown persone
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
    } else {
        preview.innerHTML = `<p class="text-muted">${file.name} (${(file.size / 1024).toFixed(0)} KB)</p>`;
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

    if (!personId) {
        showError('Scegli una persona a cui associare il contenuto.');
        return;
    }

    // Nel prototipo salviamo solo il nome del file (senza upload reale).
    // Per la simulazione il "content" può essere il nome del file oppure il testo del racconto.
    let finalContent = content;
    if (type !== 'text' && file) {
        finalContent = `[${file.name}]`;
    }
    if (type === 'text' && !finalContent) {
        showError('Inserisci il testo del racconto.');
        return;
    }

    try {
        await api.post('/api/memories', {
            title,
            content: finalContent,
            description,
            type,
            taggedPersonId: parseInt(personId),
            eventDate: eventDate || null
        });
        toast('Contenuto salvato con successo!');
        setTimeout(() => window.location.href = 'home.html', 1500);
    } catch (err) {
        showError('Errore: ' + err.message);
    }
});

function showError(msg) {
    const el = document.getElementById('error');
    el.textContent = msg;
    el.classList.remove('hidden');
}
