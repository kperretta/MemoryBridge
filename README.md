# Memory Bridge

Piattaforma per preservare e valorizzare la memoria familiare.
Corso di Interazione Uomo-Macchina — A.A. 2025/2026

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

## Miglioramenti dall'Assignment 3 già implementati

- **#2**: etichetta testuale "Registra audio" accanto al microfono in chat
- **#5**: messaggio di benvenuto di Iris spezzato in due messaggi separati
- **#6**: highlight temporaneo del nodo appena creato nell'albero (animazione CSS `highlightNew`)
- **#7**: bottoni di condivisione rapida (WhatsApp, Email, Telegram) nella pagina invito
- **#10**: hover con `transform` sulle card del feed per comunicare interattività

Da rifinire ancora:
- **#1**: sposta l'invito nell'albero (già iniziato: menu contestuale su nodo)
- **#3**: integrare selezione familiare inline nel form invito
- **#4**: cursor pointer sui nodi (già presente)
