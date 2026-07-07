/* T1 - Chat con Iris per registrare un ricordo.
   Supporta scrittura testuale e registrazione audio reale (MediaRecorder API). */

const conversation = [];   // {role, text, mediaId}
let currentStep = 0;
let familyMembers = [];

// Stato registrazione audio
let mediaRecorder = null;
let recordedChunks = [];
let recordingMimeType = 'audio/webm';
let recordedAudioIds = [];        // tutti gli audio della conversazione

const messagesEl = document.getElementById('messages');
const userInput = document.getElementById('user-input');
const micBtn = document.getElementById('mic-btn');

(async function init() {
    await requireAuth();
    renderNavbar('chat');
    familyMembers = await api.get('/api/tree');
    populatePersonSelect();
    await irisNextTurn();
})();

function populatePersonSelect() {
    const sel = document.getElementById('preview-person');
    sel.innerHTML = '<option value="">— Scegli una persona —</option>';
    familyMembers.forEach(m => {
        sel.innerHTML += `<option value="${m.id}">${m.firstName} ${m.lastName}</option>`;
    });
}

function appendMessage(role, text, mediaId, mediaType) {
    const div = document.createElement('div');
    div.className = `msg msg-${role}`;
    if (mediaId) {
        if (mediaType && mediaType.startsWith('audio')) {
            div.innerHTML = `<audio controls src="api/media?id=${mediaId}"></audio>`;
        } else if (mediaType && mediaType.startsWith('image')) {
            div.innerHTML = `<img src="api/media?id=${mediaId}" style="max-width:200px;border-radius:8px;display:block">`;
        } else {
            div.textContent = text || '[allegato]';
        }
        if (text) {
            const cap = document.createElement('div');
            cap.textContent = text;
            cap.style.marginTop = '6px';
            cap.style.fontSize = '13px';
            div.appendChild(cap);
        }
    } else {
        div.textContent = text;
    }
    messagesEl.appendChild(div);
    messagesEl.scrollTop = messagesEl.scrollHeight;
    conversation.push({ role, text: text || '', mediaId });
}

function showTyping() {
    const div = document.createElement('div');
    div.className = 'msg msg-iris typing';
    div.textContent = 'Iris sta scrivendo…';
    div.id = 'typing-indicator';
    messagesEl.appendChild(div);
    messagesEl.scrollTop = messagesEl.scrollHeight;
}
function hideTyping() {
    document.getElementById('typing-indicator')?.remove();
}

async function irisNextTurn() {
    showTyping();
    try {
        const r = await api.get(`/api/iris?step=${currentStep}`);
        setTimeout(() => {
            hideTyping();
            r.messages.forEach((msg, i) => {
                setTimeout(() => appendMessage('iris', msg), i * 700);
            });
            currentStep = r.nextStep;
        }, 800);
    } catch (e) {
        hideTyping();
        console.error(e);
    }
}

/* ============== TESTO ============== */
document.getElementById('send-btn').addEventListener('click', sendUserMessage);
userInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); sendUserMessage(); }
});
function sendUserMessage() {
    const text = userInput.value.trim();
    if (!text) return;
    appendMessage('user', text);
    userInput.value = '';
    setTimeout(irisNextTurn, 500);
}

/* ============== AUDIO REALE ============== */
micBtn.addEventListener('click', toggleRecording);

async function toggleRecording() {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
        stopRecording();
    } else {
        await startRecording();
    }
}

async function startRecording() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        alert('Il tuo browser non supporta la registrazione audio. Usa Chrome, Firefox o Safari aggiornati.');
        return;
    }
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'];
        recordingMimeType = candidates.find(t => MediaRecorder.isTypeSupported(t)) || 'audio/webm';

        mediaRecorder = new MediaRecorder(stream, { mimeType: recordingMimeType });
        recordedChunks = [];
        mediaRecorder.ondataavailable = (e) => { if (e.data && e.data.size > 0) recordedChunks.push(e.data); };
        mediaRecorder.onstop = async () => {
            stream.getTracks().forEach(t => t.stop());
            await handleRecordedAudio();
        };
        mediaRecorder.start();
        updateMicButton(true);
    } catch (err) {
        console.error(err);
        alert('Permesso microfono negato o non disponibile. Verifica le impostazioni del browser.');
    }
}

function stopRecording() {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') mediaRecorder.stop();
    updateMicButton(false);
}

function updateMicButton(recording) {
    if (recording) {
        micBtn.innerHTML = `<span class="recording-dot"></span> Ferma registrazione`;
        micBtn.style.background = 'var(--danger)';
        micBtn.style.color = 'white';
    } else {
        micBtn.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                <line x1="12" y1="19" x2="12" y2="23"/>
                <line x1="8" y1="23" x2="16" y2="23"/>
            </svg>
            Registra audio`;
        micBtn.style.background = '';
        micBtn.style.color = '';
    }
}

async function handleRecordedAudio() {
    if (recordedChunks.length === 0) return;
    const blob = new Blob(recordedChunks, { type: recordingMimeType });
    recordedChunks = [];

    const formData = new FormData();
    const ext = recordingMimeType.includes('mp4') ? 'm4a'
              : recordingMimeType.includes('ogg') ? 'ogg' : 'webm';
    formData.append('file', blob, `recording.${ext}`);

    try {
        const r = await fetch('api/media', {
            method: 'POST',
            credentials: 'include',
            body: formData
        });
        if (!r.ok) throw new Error('Upload fallito');
        const { id } = await r.json();
        recordedAudioIds.push(id);
        appendMessage('user', null, id, 'audio');
        setTimeout(irisNextTurn, 500);
    } catch (err) {
        alert('Errore upload audio: ' + err.message);
    }
}

/* ============== FINE / ANTEPRIMA / SALVA ============== */
document.getElementById('end-btn').addEventListener('click', () => {
    const userMessages = conversation
        .filter(m => m.role === 'user')
        .map(m => (m.mediaId && !m.text) ? '[messaggio audio]' : m.text)
        .filter(Boolean).join('\n\n');

    if (!userMessages && recordedAudioIds.length === 0) {
        alert('Non hai ancora raccontato nulla!');
        return;
    }
    document.getElementById('preview-content').textContent = userMessages || '(solo audio)';

    const old = document.getElementById('preview-audio');
    if (old) old.remove();
    if (recordedAudioIds.length > 0) {
        const lastId = recordedAudioIds[recordedAudioIds.length - 1];
        const audio = document.createElement('audio');
        audio.id = 'preview-audio';
        audio.controls = true;
        audio.src = `api/media?id=${lastId}`;
        audio.style.marginTop = '8px';
        audio.style.width = '100%';
        document.getElementById('preview-content').after(audio);
    }
    document.getElementById('preview-modal').classList.remove('hidden');
});

function closePreview() { document.getElementById('preview-modal').classList.add('hidden'); }
window.closePreview = closePreview;

document.getElementById('save-btn').addEventListener('click', async () => {
    const title = document.getElementById('preview-title').value.trim() || 'Un ricordo';
    const content = document.getElementById('preview-content').textContent;
    const personId = document.getElementById('preview-person').value;

    if (!personId) { alert('Scegli chi è il protagonista del ricordo.'); return; }

    const hasAudio = recordedAudioIds.length > 0;
    const type = hasAudio ? 'audio' : 'text';
    const mediaId = hasAudio ? recordedAudioIds[recordedAudioIds.length - 1] : null;

    try {
        await api.post('/api/memories', {
            title, content, type, mediaId,
            taggedPersonId: parseInt(personId),
            description: 'Racconto registrato con Iris'
        });
        closePreview();
        toast('Il tuo ricordo è stato salvato! Ora fa parte della storia della tua famiglia');
        setTimeout(() => window.location.href = 'home.html', 2000);
    } catch (e) {
        alert('Errore: ' + e.message);
    }
});
