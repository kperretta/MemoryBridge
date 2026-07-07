/* T1 - Chat con Iris per registrare un ricordo */

const conversation = [];   // {role, text}
let currentStep = 0;
let familyMembers = [];

const messagesEl = document.getElementById('messages');
const userInput = document.getElementById('user-input');

(async function init() {
    await requireAuth();
    renderNavbar('chat');

    // Precarico i membri della famiglia per il menu "protagonista"
    familyMembers = await api.get('/api/tree');
    populatePersonSelect();

    // Chiedo a Iris il primo turno
    await irisNextTurn();
})();

function populatePersonSelect() {
    const sel = document.getElementById('preview-person');
    sel.innerHTML = '<option value="">— Scegli una persona —</option>';
    familyMembers.forEach(m => {
        sel.innerHTML += `<option value="${m.id}">${m.firstName} ${m.lastName}</option>`;
    });
}

function appendMessage(role, text) {
    const div = document.createElement('div');
    div.className = `msg msg-${role}`;
    div.textContent = text;
    messagesEl.appendChild(div);
    messagesEl.scrollTop = messagesEl.scrollHeight;
    conversation.push({ role, text });
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
        // Piccolo delay per dare "sensazione di scrittura"
        setTimeout(() => {
            hideTyping();
            // Miglioramento #5: spezzo il messaggio di benvenuto in messaggi separati
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

// Bottone microfono: qui simuliamo la registrazione mostrando un messaggio.
// (In produzione useremmo Web Speech API; per il prototipo è sufficiente.)
document.getElementById('mic-btn').addEventListener('click', () => {
    if (!confirm('Registrazione audio simulata: proceder ad aggiungere una trascrizione fittizia?')) return;
    const fakeTranscript = '[Audio trascritto] Un ricordo raccontato a voce, che poi trascriviamo.';
    userInput.value = fakeTranscript;
    userInput.focus();
});

// FINE conversazione → anteprima
document.getElementById('end-btn').addEventListener('click', () => {
    const userMessages = conversation
        .filter(m => m.role === 'user')
        .map(m => m.text)
        .join('\n\n');

    if (!userMessages) {
        alert('Non hai ancora raccontato nulla!');
        return;
    }
    document.getElementById('preview-content').textContent = userMessages;
    document.getElementById('preview-modal').classList.remove('hidden');
});

function closePreview() {
    document.getElementById('preview-modal').classList.add('hidden');
}

// SALVA il ricordo
document.getElementById('save-btn').addEventListener('click', async () => {
    const title = document.getElementById('preview-title').value.trim() || 'Un ricordo';
    const content = document.getElementById('preview-content').textContent;
    const personId = document.getElementById('preview-person').value;

    if (!personId) {
        alert('Scegli chi è il protagonista del ricordo.');
        return;
    }

    try {
        await api.post('/api/memories', {
            title,
            content,
            type: 'text',
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
