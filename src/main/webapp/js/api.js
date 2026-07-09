/**
 * Wrapper delle chiamate al backend.
 * Include automaticamente i cookie di sessione grazie a credentials:'include'.
 * I path che iniziano con "/" vengono convertiti in relativi per adattarsi
 * a qualsiasi context path di Tomcat.
 */

// Pagine dove NON dobbiamo redirectare al login (per evitare loop)
const PUBLIC_PAGES = ['', 'index.html', 'register.html'];

const api = {
    _resolveUrl(url) {
        // URL assoluto? lascio invariato
        if (/^([a-z]+:)?\/\//i.test(url)) return url;
        // Inizia con "/"? rendo relativo
        if (url.startsWith('/')) return url.substring(1);
        return url;
    },

    async _request(method, url, data, isRetry) {
        const opts = {
            method,
            credentials: 'include',
            headers: {}
        };
        if (data !== undefined) {
            opts.headers['Content-Type'] = 'application/json';
            opts.body = JSON.stringify(data);
        }
        const r = await fetch(this._resolveUrl(url), opts);

        if (r.status === 401) {
            const currentPage = window.location.pathname.split('/').pop();
            if (!PUBLIC_PAGES.includes(currentPage)) {
                window.location.href = 'index.html';
            }
            throw new Error('Non autenticato');
        }

        const text = await r.text();

        // Auto-retry: se ricevo HTML e non ho gia' ritentato, aspetto 800ms e riprovo
        // (protegge da micro-redeploy di Tomcat/IntelliJ dopo logout)
        if (text && text.trim().startsWith('<') && !isRetry) {
            await new Promise(res => setTimeout(res, 800));
            return this._request(method, url, data, true);
        }

        if (text && text.trim().startsWith('<')) {
            throw new Error(`Il server non risponde correttamente. ` +
                `Riprova tra qualche secondo o ricarica la pagina.`);
        }
        const json = text ? JSON.parse(text) : null;
        if (!r.ok) {
            const msg = (json && json.error) ? json.error : `Errore ${r.status}`;
            throw new Error(msg);
        }
        return json;
    },

    get(url)          { return this._request('GET', url); },
    post(url, data)   { return this._request('POST', url, data || {}); },
    put(url, data)    { return this._request('PUT', url, data || {}); },
    del(url)          { return this._request('DELETE', url); }
};

// Toast helper: messaggio in basso
function toast(message, ms = 2500) {
    const el = document.createElement('div');
    el.className = 'toast';
    el.textContent = message;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), ms);
}

// Guard per pagine protette
async function requireAuth() {
    try {
        const me = await api.get('/api/me');
        window.currentUser = me;
        return me;
    } catch (e) {
        window.location.href = 'index.html';
        throw e;
    }
}

// Formatta una data ISO in italiano
function formatDate(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    return d.toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' });
}

function formatDateTime(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    return d.toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' })
         + ' · ' + d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
}

// Iniziali per avatar
function initials(name) {
    if (!name) return '?';
    return name.split(' ').filter(Boolean).map(p => p[0].toUpperCase()).slice(0, 2).join('');
}



