# Memory Bridge

Piattaforma per preservare e valorizzare la memoria familiare.
Corso di Interazione Uomo-Macchina — A.A. 2025/2026
**Katia Perretta** 

## Stack

- **Backend**: Java 21 + Jakarta Servlet API 6.1 (Tomcat 11)
- **Frontend**: HTML + CSS + JavaScript (nessun framework)
- **JSON**: Gson 2.11
- **"Database"**: simulato in memoria (singleton `DataStore`), popolato al deploy da `AppInitListener`

## Aprire il progetto in IntelliJ IDEA

1. `File → Open` → seleziona la cartella `MemoryBridge` (dove c'è il `pom.xml`)
2. IntelliJ riconosce il progetto Maven e scarica le dipendenze
3. `Run → Edit Configurations → + → Tomcat Server → Local`
4. Nella tab **Server**: seleziona il tuo Tomcat 11
5. Nella tab **Deployment**: `+ → Artifact → MemoryBridge:war exploded`
6. Application context: `/` (radice)
7. Premi **Run**: si apre `http://localhost:8080/`

Modifiche a HTML/CSS/JS → reload del browser è sufficiente.
Modifiche al codice Java → `Ctrl+F9` per ricompilare, poi ricarica.

## Credenziali demo

I dati vengono popolati in memoria a ogni avvio del server.

| Utente | Email | Password | Ruolo |
|--------|-------|----------|-------|
| Maria Rossi (78) | `maria@test.it` | `password` | Custode dei ricordi |
| Marco Rossi (50) | `marco@test.it` | `password` | Ponte tra generazioni |
| Sofia Rossi (17) | `sofia@test.it` | `password` | Erede della memoria |

Famiglia: `ROSSI2025`

## Struttura del progetto

```
src/main/
├── java/com/memorybridge/
│   ├── model/         → POJO (User, Memory, FamilyMember, Comment)
│   ├── data/          → DataStore singleton (il "DB")
│   ├── listener/      → AppInitListener (seed dati)
│   ├── servlet/       → un servlet per risorsa REST
│   └── util/          → JsonUtil (Gson con LocalDateTime)
└── webapp/
    ├── WEB-INF/       → web.xml
    ├── css/           → style.css (palette verde acqua)
    ├── js/            → api.js (wrapper fetch) + un file per pagina
    ├── *.html         → una pagina per task (chat, upload, tree, ...)
    └── index.html     → login
```

## Endpoint REST

Tutti gli endpoint richiedono sessione autenticata (cookie).
Il body è sempre JSON, la risposta è sempre JSON.

| Metodo | URL | Descrizione |
|--------|-----|-------------|
| POST | `/api/login` | `{email, password}` → utente |
| POST | `/api/register` | `{firstName, lastName, email, password, inviteCode?, familyCode?}` |
| GET | `/api/me` | Utente corrente |
| POST | `/api/me` | Logout (distrugge sessione) |
| GET | `/api/memories` | Feed della famiglia |
| GET | `/api/memories?personId=X` | Ricordi legati a un familiare |
| GET | `/api/memories?id=X` | Singolo ricordo |
| POST | `/api/memories` | Crea ricordo |
| GET | `/api/tree` | Tutto l'albero |
| GET | `/api/tree?id=X` | Singolo membro |
| POST | `/api/tree` | Nuovo membro |
| PUT | `/api/tree` | Modifica membro |
| GET | `/api/comments?memoryId=X` | Commenti del ricordo |
| POST | `/api/comments` | Nuovo commento `{memoryId, text}` |
| POST | `/api/invite` | Genera codice invito |
| GET | `/api/iris?step=N` | Prossime domande di Iris |

