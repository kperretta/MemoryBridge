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

**Nota sulle funzionalità AI:**
L'applicazione include un sistema di fallback automatico in Modalità Demo. Se la variabile d'ambiente GROQ_API_KEY non è configurata o se il servizio non è raggiungibile, Iris risponderà con messaggi simulati per consentire il test completo dell'interfaccia e dei flussi UX.
Per **abilitare l'AI reale**: Configurare la variabile d'ambiente GROQ_API_KEY con la propria chiave Groq nelle configurazioni di avvio di IntelliJ (Run -> Edit Configurations -> Environment Variables).

## Credenziali demo

I dati vengono popolati in memoria a ogni avvio del server.

| Utente | Email | Password | 
|--------|-------|----------|
| Maria Rossi (78) | `maria@test.it` | `password` | 
| Marco Rossi (50) | `marco@test.it` | `password` | 
| Sofia Rossi (17) | `sofia@test.it` | `password` | 

Famiglia: `ROSSI2025`

## Struttura del progetto

```
src/main/
├── java/com/memorybridge/
│   ├── model/         → POJO (User, Memory, FamilyMember, Comment)
│   ├── data/          → DataStore singleton (il "Database")
│   ├── listener/      → AppInitListener (seed dati)
│   ├── servlet/       → un servlet per risorsa REST
│   └── util/          → JsonUtil (Gson con LocalDateTime)
└── webapp/
    ├── WEB-INF/       → web.xml
    ├── css/           → style.css 
    ├── js/            → api.js (wrapper fetch) + un file per pagina
    ├── *.html         → una pagina per task (chat, upload, tree, ...)
    └── index.html     → login
```
