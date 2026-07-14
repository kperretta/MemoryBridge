/* T1 - Chat con Iris strutturata per temi + registrazione audio reale */

const conversation = [];
let currentStep = 0;
let currentTheme = null;
let familyMembers = [];

// Stato registrazione audio
let mediaRecorder = null;
let recordedChunks = [];
let recordingMimeType = 'audio/webm';
let recordedAudioIds = [];

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

/* Mostra i pulsanti temi come "quick reply" */
function appendThemeButtons(themes) {
    const wrap = document.createElement('div');
    wrap.className = 'theme-buttons';
    themes.forEach(t => {
        const b = document.createElement('button');
        b.className = 'btn btn-secondary theme-btn';
        b.textContent = t.label;
        b.onclick = () => selectTheme(t.id, t.label, wrap);
        wrap.appendChild(b);
    });
    messagesEl.appendChild(wrap);
    messagesEl.scrollTop = messagesEl.scrollHeight;
}

async function selectTheme(themeId, label, wrapEl) {
    currentTheme = themeId;
    // Simulo che l'utente abbia "risposto" con la scelta del tema
    appendMessage('user', label);
    // Disabilito i bottoni tema
    if (wrapEl) wrapEl.remove();
    // Chiedo la prima domanda del tema
    await irisNextTurn();
}

function showTyping() {
    const div = document.createElement('div');
    div.className = 'msg msg-iris typing';
    div.textContent = 'Iris sta scrivendo…';
    div.id = 'typing-indicator';
    messagesEl.appendChild(div);
    messagesEl.scrollTop = messagesEl.scrollHeight;
}
function hideTyping() { document.getElementById('typing-indicator')?.remove(); }

async function irisNextTurn() {
    showTyping();
    try {
        const historyParam = encodeURIComponent(JSON.stringify(conversation));
        const base = currentTheme
            ? `/api/iris?step=${currentStep}&theme=${currentTheme}`
            : `/api/iris?step=${currentStep}`;
        const url = `${base}&history=${historyParam}`;
        const r = await api.get(url);
        setTimeout(() => {
            hideTyping();
            r.messages.forEach((msg, i) => {
                setTimeout(() => appendMessage('iris', msg), i * 700);
            });
            if (r.themes && r.themes.length > 0) {
                setTimeout(() => appendThemeButtons(r.themes), r.messages.length * 700 + 200);
            }
            currentStep = r.nextStep;
        }, 800);
    } catch (e) {
        hideTyping();
        console.error(e);
        appendIrisError('Mi dispiace, non riesco a risponderti in questo momento.', () => irisNextTurn());
    }
}

/* Mostra un messaggio di errore di Iris con un pulsante "Riprova" */
function appendIrisError(text, onRetry) {
    const div = document.createElement('div');
    div.className = 'msg msg-iris';
    div.textContent = text;
    const retryBtn = document.createElement('button');
    retryBtn.className = 'btn btn-secondary';
    retryBtn.textContent = 'Riprova';
    retryBtn.style.marginTop = '8px';
    retryBtn.style.display = 'block';
    retryBtn.onclick = () => { div.remove(); onRetry(); };
    div.appendChild(retryBtn);
    messagesEl.appendChild(div);
    messagesEl.scrollTop = messagesEl.scrollHeight;
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

/* ============== AUDIO ============== */
micBtn.addEventListener('click', toggleRecording);

async function toggleRecording() {
    if (mediaRecorder && mediaRecorder.state === 'recording') stopRecording();
    else await startRecording();
}

async function startRecording() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        alert('Il tuo browser non supporta la registrazione audio.');
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
        alert('Permesso microfono negato o non disponibile.');
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
            </svg> Registra audio`;
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
        const r = await fetch('api/media', { method: 'POST', credentials: 'include', body: formData });
        if (!r.ok) throw new Error('Upload fallito');
        const { id } = await r.json();
        recordedAudioIds.push(id);
        appendMessage('user', null, id, 'audio');
        setTimeout(irisNextTurn, 500);
    } catch (err) {
        alert('Errore upload audio: ' + err.message);
    }
}

/* ============== FINE ============== */
document.getElementById('end-btn').addEventListener('click', async () => {
    const userMessages = conversation
        .filter(m => m.role === 'user')
        .map(m => (m.mediaId && !m.text) ? '[messaggio audio]' : m.text)
        .filter(Boolean).join('\n\n');

    if (!userMessages && recordedAudioIds.length === 0) {
        alert('Non hai ancora raccontato nulla!');
        return;
    }

    document.getElementById('preview-content').textContent = userMessages
        ? 'Iris sta elaborando il tuo racconto…'
        : '(solo audio)';
    document.getElementById('preview-modal').classList.remove('hidden');

    let finalText = '(solo audio)';
    if (userMessages) {
        try {
            const result = await api.post('/api/iris', { action: 'elaborate', history: conversation });
            if (!result.elaborated || !result.elaborated.trim()) {
                throw new Error('Risposta vuota da Iris');
            }
            finalText = result.elaborated;
        } catch (e) {
            closePreview();
            alert('Non è stato possibile elaborare il racconto in questo momento. Riprova tra poco premendo di nuovo "Fine".');
            return;
        }
    }
    document.getElementById('preview-content').textContent = finalText;

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
            description: currentTheme ? `Racconto con Iris (tema: ${currentTheme})` : 'Racconto con Iris'
        });
        closePreview();
        showPostSaveChoice();
    } catch (e) {
        alert('Errore: ' + e.message);
    }
});

/* Dopo il salvataggio: Iris chiede cosa fare, con due grandi pulsanti */
function showPostSaveChoice() {
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    backdrop.innerHTML = `
        <div class="modal text-center" style="max-width:420px">
            <div style="font-size:56px;margin:8px 0"></div>
            <h2>Ricordo salvato!</h2>
            <p class="text-muted mb-2">Ora fa parte della storia della tua famiglia.<br>Cosa vuoi fare adesso?</p>
            <div style="display:flex;flex-direction:column;gap:12px;margin-top:20px">
                <button class="big-btn primary full" id="another-memory-btn">Racconta un altro ricordo</button>
                <button class="big-btn secondary full" id="go-home-btn">Torna alla Home</button>
            </div>
        </div>
    `;
    document.body.appendChild(backdrop);
    document.getElementById('another-memory-btn').onclick = () => window.location.reload();
    document.getElementById('go-home-btn').onclick = () => window.location.href = 'home.html';
}
