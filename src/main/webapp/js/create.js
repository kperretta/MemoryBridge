/* Flusso "Crea contenuto": tipo -> carica/registra -> suggerimenti -> pubblica */

let contentType = null;       // 'audio' | 'video' | 'photo'
let uploadedMediaId = null;
let uploadedContentType = null;
let publishedMemoryId = null;
let familyMembers = [];

// Recorder / stream condiviso per audio/video/foto
let mediaRecorder = null;
let recordedChunks = [];
let activeStream = null;

// Consigli predefiniti per tipo di contenuto
const SUGGESTIONS = {
    audio: [
        'Racconta <strong>quando</strong> è avvenuto ciò di cui parli (anche solo l\'anno)',
        'Nomina le <strong>persone</strong> coinvolte nel racconto',
        'Descrivi il <strong>luogo</strong> dove si svolge la storia',
        'Aggiungi le <strong>emozioni</strong> che ricordi di quel momento'
    ],
    video: [
        'Indica <strong>dove</strong> è stato girato il video',
        'Specifica la <strong>data</strong> o l\'occasione (compleanno, festa…)',
        'Nomina le <strong>persone</strong> che compaiono',
        'Spiega il <strong>contesto</strong>: cosa stava succedendo?'
    ],
    photo: [
        'Indica <strong>chi</strong> sono le persone nella foto',
        'Specifica <strong>dove</strong> e <strong>quando</strong> è stata scattata',
        'Racconta l\'<strong>occasione</strong>: perché eravate lì?',
        'Aggiungi un <strong>aneddoto</strong> legato a quel momento'
    ]
};

(async function init() {
    await requireAuth();
    renderNavbar('create');

    // Impedisce di selezionare date future nel picker
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('c-eventDate').max = today;

    familyMembers = await api.get('/api/tree');
    const sel = document.getElementById('c-person');
    sel.innerHTML = '<option value="">— Scegli una persona —</option>';
    familyMembers.forEach(m => {
        sel.innerHTML += `<option value="${m.id}">${m.firstName} ${m.lastName}</option>`;
    });
})();

/* ============ STEP 1: scelta tipo ============ */
document.querySelectorAll('.type-card').forEach(card => {
    card.addEventListener('click', () => {
        contentType = card.dataset.type;
        document.querySelectorAll('.type-card').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        setTimeout(() => showCaptureStep(), 200);
    });
});

function showStep(id) {
    ['step-type', 'step-capture', 'step-done']
        .forEach(s => {
            const el = document.getElementById(s);
            if (el) el.classList.add('hidden');
        });
    document.getElementById(id).classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* ============ STEP 2: barra caricamento/registrazione ============ */
function showCaptureStep() {
    const titles = { audio: 'Il tuo audio', video: 'Il tuo video', photo: 'La tua immagine' };
    document.getElementById('capture-title').textContent = titles[contentType];

    const bar = document.getElementById('capture-bar');
    bar.innerHTML = '';

    if (contentType === 'audio') {
        bar.appendChild(makeBtn('Registra audio', 'primary', toggleAudioRecording, 'record-btn'));
        bar.appendChild(makeFileInput('audio/*', 'Carica un file audio'));
    } else if (contentType === 'video') {
        bar.appendChild(makeBtn('Registra video', 'primary', toggleVideoRecording, 'record-btn'));
        bar.appendChild(makeFileInput('video/*', 'Carica un video'));
    } else {
        bar.appendChild(makeBtn('Scatta una foto', 'primary', startPhotoCapture, 'photo-capture-btn'));
        bar.appendChild(makeFileInput('image/*', 'Carica una foto'));
    }

    loadIrisSuggestions();

    showStep('step-capture');
}

/* Carica sempre i suggerimenti generici predefiniti */
function loadIrisSuggestions() {
    const container = document.getElementById('iris-suggestions');
    if (!container || !SUGGESTIONS[contentType]) return;

    container.innerHTML = '<ul>' +
        SUGGESTIONS[contentType].map(s => `<li>${s}</li>`).join('') +
        '</ul>';
}

function makeBtn(label, style, onClick, id) {
    const b = document.createElement('button');
    b.className = `big-btn ${style}`;
    b.style.flex = '1';
    b.textContent = label;
    if (id) b.id = id;
    b.onclick = onClick;
    return b;
}

function makeFileInput(accept, label) {
    const wrap = document.createElement('label');
    wrap.className = 'big-btn outline';
    wrap.style.flex = '1';
    wrap.style.cursor = 'pointer';
    wrap.textContent = label;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.style.display = 'none';
    input.addEventListener('change', () => {
        if (input.files[0]) uploadFile(input.files[0]);
    });
    wrap.appendChild(input);
    return wrap;
}

/* ---- Registrazione AUDIO ---- */
async function toggleAudioRecording() {
    if (mediaRecorder && mediaRecorder.state === 'recording') { stopRecorder(); return; }
    try {
        activeStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        startRecorder(activeStream, 'audio');
    } catch (e) {
        alert('Permesso microfono negato o non disponibile.');
    }
}

/* ---- Registrazione VIDEO (con anteprima live) ---- */
async function toggleVideoRecording() {
    if (mediaRecorder && mediaRecorder.state === 'recording') { stopRecorder(); return; }
    try {
        activeStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        const preview = document.getElementById('capture-preview');
        preview.innerHTML = '';
        const liveVideo = document.createElement('video');
        liveVideo.id = 'live-preview';
        liveVideo.autoplay = true;
        liveVideo.muted = true;
        liveVideo.playsInline = true;
        liveVideo.srcObject = activeStream;
        liveVideo.style.maxWidth = '100%';
        liveVideo.style.borderRadius = '12px';
        preview.appendChild(liveVideo);
        startRecorder(activeStream, 'video');
    } catch (e) {
        alert('Permesso videocamera negato o non disponibile.');
    }
}

function startRecorder(stream, kind) {
    const mimeCandidates = kind === 'audio'
        ? ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4']
        : ['video/webm;codecs=vp9,opus', 'video/webm', 'video/mp4'];
    const mime = mimeCandidates.find(t => MediaRecorder.isTypeSupported(t)) || '';

    mediaRecorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
    recordedChunks = [];
    mediaRecorder.ondataavailable = e => { if (e.data && e.data.size > 0) recordedChunks.push(e.data); };
    mediaRecorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        document.getElementById('live-preview')?.remove();
        const blob = new Blob(recordedChunks, { type: mediaRecorder.mimeType || (kind === 'audio' ? 'audio/webm' : 'video/webm') });
        const ext = (mediaRecorder.mimeType || '').includes('mp4') ? (kind === 'audio' ? 'm4a' : 'mp4') : 'webm';
        await uploadFile(new File([blob], `registrazione.${ext}`, { type: blob.type }));
        resetRecordBtn();
    };
    mediaRecorder.start();
    const btn = document.getElementById('record-btn');
    if (btn) {
        btn.innerHTML = '<span class="recording-dot"></span> Ferma registrazione';
        btn.classList.remove('primary');
        btn.classList.add('danger');
    }
}

function stopRecorder() {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') mediaRecorder.stop();
}

function resetRecordBtn() {
    const btn = document.getElementById('record-btn');
    if (!btn) return;
    btn.classList.remove('danger');
    btn.classList.add('primary');
    btn.textContent = contentType === 'audio' ? 'Registra audio' : 'Registra video';
}

/* ---- Scatto FOTO reale (anteprima webcam + cattura frame) ---- */
async function startPhotoCapture() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        alert('Il tuo browser non supporta l\'accesso alla fotocamera. Usa "Carica una foto".');
        return;
    }
    try {
        try {
            activeStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        } catch {
            activeStream = await navigator.mediaDevices.getUserMedia({ video: true });
        }
    } catch (e) {
        alert('Permesso fotocamera negato o non disponibile.');
        return;
    }

    const preview = document.getElementById('capture-preview');
    preview.innerHTML = '';
    const liveVideo = document.createElement('video');
    liveVideo.id = 'live-preview';
    liveVideo.autoplay = true;
    liveVideo.muted = true;
    liveVideo.playsInline = true;
    liveVideo.srcObject = activeStream;
    liveVideo.style.maxWidth = '100%';
    liveVideo.style.borderRadius = '12px';
    preview.appendChild(liveVideo);

    const bar = document.getElementById('capture-bar');
    bar.innerHTML = '';
    bar.appendChild(makeBtn('Scatta ora', 'primary', capturePhotoFrame));
    bar.appendChild(makeBtn('Annulla', 'outline', cancelPhotoCapture));
}

function capturePhotoFrame() {
    const video = document.getElementById('live-preview');
    if (!video || !video.videoWidth) return;

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);

    canvas.toBlob(async (blob) => {
        stopActiveStream();
        await uploadFile(new File([blob], 'foto.jpg', { type: 'image/jpeg' }));
        resetPhotoBar();
    }, 'image/jpeg', 0.92);
}

function cancelPhotoCapture() {
    stopActiveStream();
    document.getElementById('capture-preview').innerHTML = '';
    resetPhotoBar();
}

function stopActiveStream() {
    if (activeStream) {
        activeStream.getTracks().forEach(t => t.stop());
        activeStream = null;
    }
    document.getElementById('live-preview')?.remove();
}

function resetPhotoBar() {
    const bar = document.getElementById('capture-bar');
    bar.innerHTML = '';
    bar.appendChild(makeBtn('Scatta una foto', 'primary', startPhotoCapture, 'photo-capture-btn'));
    bar.appendChild(makeFileInput('image/*', 'Carica una foto'));
}

/* ---- Upload al server ---- */
async function uploadFile(file) {
    const preview = document.getElementById('capture-preview');
    preview.innerHTML = '<p class="text-muted">Caricamento in corso…</p>';
    try {
        const fd = new FormData();
        fd.append('file', file);
        const r = await fetch('api/media', { method: 'POST', credentials: 'include', body: fd });
        if (!r.ok) throw new Error('Upload fallito');
        const data = await r.json();
        uploadedMediaId = data.id;
        uploadedContentType = data.contentType || file.type;

        if (uploadedContentType.startsWith('image/')) {
            preview.innerHTML = `<img src="api/media?id=${uploadedMediaId}">`;
        } else if (uploadedContentType.startsWith('audio/')) {
            preview.innerHTML = `<audio controls src="api/media?id=${uploadedMediaId}"></audio>`;
        } else if (uploadedContentType.startsWith('video/')) {
            preview.innerHTML = `<video controls src="api/media?id=${uploadedMediaId}"></video>`;
        }
        toast('File caricato!');
    } catch (e) {
        preview.innerHTML = '';
        alert('Errore: ' + e.message);
    }
}

/* ============ PUBBLICA ============ */
document.getElementById('publish-btn').addEventListener('click', () => publish());

async function publish() {
    const title = document.getElementById('c-title').value.trim();
    const personId = document.getElementById('c-person').value;
    const eventDate = document.getElementById('c-eventDate').value || null;
    const description = document.getElementById('c-description').value.trim();

    document.getElementById('c-error').classList.add('hidden');

    if (!uploadedMediaId) { showErr('Carica o registra prima un contenuto.'); return false; }
    if (!title) { showErr('Dai un titolo al tuo ricordo.'); return false; }
    if (!personId) { showErr('Scegli il protagonista del ricordo.'); return false; }

// Un ricordo è per definizione nel passato: rifiuto date future
    if (eventDate) {
        const today = new Date().toISOString().split('T')[0];
        if (eventDate > today) {
            showErr('La data del ricordo non può essere nel futuro.');
            return false;
        }
    }

    try {
        const saved = await api.post('/api/memories', {
            title,
            content: description || title,
            description,
            type: contentType,
            mediaId: uploadedMediaId,
            taggedPersonId: parseInt(personId),
            eventDate
        });
        publishedMemoryId = saved.id;
        showStep('step-done');
        return true;
    } catch (e) {
        showErr('Errore: ' + e.message);
        return false;
    }
}

function showErr(msg) {
    const err = document.getElementById('c-error');
    err.textContent = msg;
    err.classList.remove('hidden');
    err.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

/* ============ DONE ============ */
const showContentBtn = document.getElementById('show-content-btn');
if (showContentBtn) {
    showContentBtn.addEventListener('click', () => {
        window.location.href = publishedMemoryId
            ? `home.html?open=${publishedMemoryId}`
            : 'home.html';
    });
}