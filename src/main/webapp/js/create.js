/* Flusso "Crea contenuto": tipo -> carica/registra -> Iris consiglia -> pubblica / modifica con Iris */

let contentType = null;       // 'audio' | 'video' | 'photo'
let uploadedMediaId = null;
let uploadedContentType = null;
let publishedMemoryId = null;
let familyMembers = [];

// Recorder / stream condiviso per audio/video/foto
let mediaRecorder = null;
let recordedChunks = [];
let activeStream = null;

// Consigli generici di riserva, usati solo se Iris (Groq) non risponde
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
    ['step-type', 'step-capture', 'step-iris-choice', 'step-iris-describe', 'step-iris-preview', 'step-done']
        .forEach(s => document.getElementById(s).classList.add('hidden'));
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

/* Carica i consigli di Iris (generati da Groq in base al tipo di contenuto e
   al titolo, se già scritto). Se Groq non risponde, ricade sui consigli
   generici predefiniti: qui va bene un fallback silenzioso, sono solo
   suggerimenti di interfaccia, non dati che vengono salvati. */
async function loadIrisSuggestions() {
    const container = document.getElementById('iris-suggestions');
    container.innerHTML = '<p class="text-muted">Iris sta pensando a qualche consiglio…</p>';
    try {
        const title = document.getElementById('c-title').value.trim();
        const result = await api.post('/api/iris', { action: 'suggest', contentType, title });
        if (!result.suggestions || !result.suggestions.length) throw new Error('Nessun suggerimento ricevuto');
        container.innerHTML = '<ul>' +
            result.suggestions.map(s => `<li>${formatSuggestion(s)}</li>`).join('') +
            '</ul>';
    } catch (e) {
        console.log('Consigli AI non disponibili, uso quelli generici:', e.message);
        container.innerHTML = '<ul>' + SUGGESTIONS[contentType].map(s => `<li>${s}</li>`).join('') + '</ul>';
    }
}

/* Converte **parola** in <strong>parola</strong>, come nei consigli generati da Iris */
function formatSuggestion(s) {
    return s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
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

async function publish(extraDescription) {
    const title = document.getElementById('c-title').value.trim();
    const personId = document.getElementById('c-person').value;
    const eventDate = document.getElementById('c-eventDate').value || null;
    const description = extraDescription !== undefined
        ? extraDescription
        : document.getElementById('c-description').value.trim();

    // Se lo step di anteprima Iris e' visibile, gli errori vanno mostrati li',
    // altrimenti (pubblicazione diretta da step-capture) nel contenitore normale.
    const errorTarget = document.getElementById('step-iris-preview').classList.contains('hidden')
        ? 'c-error'
        : 'describe-preview-error';

    document.getElementById('c-error').classList.add('hidden');
    document.getElementById('describe-preview-error').classList.add('hidden');

    if (!uploadedMediaId) { showErr('Carica o registra prima un contenuto.', errorTarget); return false; }
    if (!title) { showErr('Dai un titolo al tuo ricordo (torna allo step precedente).', errorTarget); return false; }
    if (!personId) { showErr('Scegli il protagonista del ricordo (torna allo step precedente).', errorTarget); return false; }

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
        showErr('Errore: ' + e.message, errorTarget);
        return false;
    }
}

function showErr(msg, targetId) {
    const id = targetId || 'c-error';
    const err = document.getElementById(id);
    err.textContent = msg;
    err.classList.remove('hidden');
    err.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

/* ============ MODIFICA CON IRIS ============ */
document.getElementById('edit-iris-btn').addEventListener('click', () => {
    if (!uploadedMediaId) { showErr('Carica o registra prima un contenuto.'); return; }
    showStep('step-iris-choice');
});
document.getElementById('iris-back-btn').addEventListener('click', () => showStep('step-capture'));

document.getElementById('iris-recreate-btn').addEventListener('click', () => {
    if (confirm('Verrai portato alla chat con Iris per creare un nuovo racconto da zero. Il contenuto caricato non verrà pubblicato. Continuare?')) {
        window.location.href = 'chat.html';
    }
});

const describeMessages = document.getElementById('describe-messages');
let describeStep = 0;
const describeHistory = []; // {role, text} — stessa forma usata da chat.js

document.getElementById('iris-describe-btn').addEventListener('click', async () => {
    showStep('step-iris-describe');
    describeMessages.innerHTML = '';
    describeStep = 0;
    describeHistory.length = 0;
    await askDescribeQuestion();
});

function irisSay(text) {
    const div = document.createElement('div');
    div.className = 'msg msg-iris';
    div.textContent = text;
    describeMessages.appendChild(div);
    describeMessages.scrollTop = describeMessages.scrollHeight;
}
function userSay(text) {
    const div = document.createElement('div');
    div.className = 'msg msg-user';
    div.textContent = text;
    describeMessages.appendChild(div);
    describeMessages.scrollTop = describeMessages.scrollHeight;
}

/* Chiede a Groq (via /api/iris, action=describeQuestion) la prossima
   domanda da fare, basandosi sul tipo di contenuto, titolo e cronologia. */
async function askDescribeQuestion() {
    const typingDiv = document.createElement('div');
    typingDiv.className = 'msg msg-iris typing';
    typingDiv.textContent = 'Iris sta scrivendo…';
    describeMessages.appendChild(typingDiv);
    describeMessages.scrollTop = describeMessages.scrollHeight;

    try {
        const title = document.getElementById('c-title').value.trim();
        const result = await api.post('/api/iris', {
            action: 'describeQuestion',
            contentType,
            title,
            history: describeHistory
        });
        typingDiv.remove();
        if (!result.question || !result.question.trim()) throw new Error('Domanda vuota');
        irisSay(result.question);
        describeHistory.push({ role: 'assistant', text: result.question });
    } catch (e) {
        typingDiv.remove();
        irisSay('Mi dispiace, non riesco a farti domande in questo momento. Puoi comunque scrivere liberamente e poi scrivere "fine".');
    }
}

document.getElementById('describe-send-btn').addEventListener('click', handleDescribeSend);
document.getElementById('describe-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); handleDescribeSend(); }
});

async function handleDescribeSend() {
    const input = document.getElementById('describe-input');
    const text = input.value.trim();
    if (!text) return;
    userSay(text);
    describeHistory.push({ role: 'user', text });
    input.value = '';

    describeStep++;
    const isDone = text.trim().toLowerCase() === 'fine' || describeStep >= 6;

    if (!isDone) {
        setTimeout(() => askDescribeQuestion(), 500);
        return;
    }

    setTimeout(async () => {
        irisSay('Ottimo! Sto componendo la descrizione…');
        try {
            const historyForApi = describeHistory.filter(
                m => !(m.role === 'user' && m.text.trim().toLowerCase() === 'fine')
            );
            const result = await api.post('/api/iris', { action: 'elaborate', history: historyForApi });
            if (!result.elaborated || !result.elaborated.trim()) {
                throw new Error('Risposta vuota da Iris');
            }
            document.getElementById('describe-preview-text').value = result.elaborated;
            showStep('step-iris-preview');
        } catch (e) {
            irisSay('Non sono riuscita a comporre la descrizione, riprova scrivendo di nuovo "fine".');
        }
    }, 800);
}

document.getElementById('describe-preview-back-btn').addEventListener('click', () => {
    showStep('step-iris-describe');
});

document.getElementById('describe-preview-publish-btn').addEventListener('click', async () => {
    const finalDescription = document.getElementById('describe-preview-text').value.trim();
    if (!finalDescription) return;
    document.getElementById('c-description').value = finalDescription;
    await publish(finalDescription);
});

/* ============ DONE ============ */
document.getElementById('show-content-btn').addEventListener('click', () => {
    window.location.href = publishedMemoryId
        ? `home.html?open=${publishedMemoryId}`
        : 'home.html';
});