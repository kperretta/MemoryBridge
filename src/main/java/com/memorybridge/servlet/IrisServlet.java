package com.memorybridge.servlet;

import com.memorybridge.data.DataStore;
import com.memorybridge.model.FamilyMember;
import com.memorybridge.model.Memory;
import com.memorybridge.util.JsonUtil;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.*;

import java.io.IOException;
import java.util.*;

/**
 * Iris strutturata per temi. Il flusso e':
 *
 *   step=0 (nessun tema)     -> messaggio di benvenuto + lista temi selezionabili
 *   step=1, theme=X          -> prima domanda del tema X
 *   step=2, theme=X          -> seconda domanda del tema X
 *   ...
 *   step=N (fine tema)       -> messaggio di chiusura
 *
 * Il frontend mostra i temi come pulsanti quick-reply.
 * NB: non e' un vero LLM. Le domande sono pre-scritte per tema; in una
 * versione produttiva si integrerebbe un modello linguistico che genera
 * domande contestuali basate sulla risposta dell'utente.
 */
@WebServlet("/api/iris")
public class IrisServlet extends HttpServlet {

    // Temi disponibili con label leggibile
    private static final Map<String, String> THEMES = new LinkedHashMap<>();
    static {
        THEMES.put("person",    "Una persona di famiglia");
        THEMES.put("event",     "Un momento speciale");
        THEMES.put("place",     "Un luogo importante");
        THEMES.put("tradition", "Una tradizione o ricetta");
        THEMES.put("object",    "Un oggetto con una storia");
    }

    // Domande specifiche per ciascun tema
    private static final Map<String, List<String>> QUESTIONS = new HashMap<>();
    static {
        QUESTIONS.put("person", List.of(
                "Iniziamo dalle basi: come si chiamava questa persona e che rapporto avevi con lei?",
                "C'era un modo di dire, un gesto o un'abitudine che la rendeva unica?",
                "Che aspetto aveva? Ricordi qualche dettaglio del suo modo di essere?",
                "Qual e' il ricordo piu' vivido che hai di lei, quello che ti torna in mente per primo?"
        ));

        QUESTIONS.put("event", List.of(
                "Ti ricordi in che periodo e' successo? Anche solo l'anno o la stagione va bene.",
                "Chi c'era con te in quel momento?",
                "Cosa hai provato? Che emozione ti e' rimasta addosso?",
                "C'e' un dettaglio particolare che ti e' rimasto impresso? Un suono, un profumo, una frase?"
        ));

        QUESTIONS.put("place", List.of(
                "Che luogo era e dove si trovava?",
                "Come ci si arrivava? Ricordi il viaggio, il percorso?",
                "Quali profumi, suoni o colori lo caratterizzavano?",
                "Con chi lo hai frequentato di piu' e perche' era importante per te?"
        ));

        QUESTIONS.put("tradition", List.of(
                "Come si chiamava questa tradizione, o ricetta? E chi te l'ha tramandata?",
                "In quali occasioni la celebravate o la preparavate?",
                "C'e' un ingrediente, un gesto o un dettaglio segreto che vuoi tramandare?",
                "Perche' questa tradizione conta per te? Che significato ha per la famiglia?"
        ));

        QUESTIONS.put("object", List.of(
                "Che oggetto e', e a chi apparteneva originariamente?",
                "Come e' arrivato nelle tue mani?",
                "Che valore ha per te oggi?",
                "C'e' una storia o un momento preciso legato a questo oggetto?"
        ));
    }

    private static final String CLOSING = "Grazie per aver condiviso questo ricordo. " +
            "Quando vuoi, premi 'Fine' per salvarlo e renderlo parte della memoria della tua famiglia.";

    @Override
    protected void doGet(HttpServletRequest req, HttpServletResponse resp) throws IOException {
        resp.setContentType("application/json");
        resp.setCharacterEncoding("UTF-8");

        HttpSession session = req.getSession(false);
        if (session == null || session.getAttribute("userId") == null) {
            resp.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
            resp.getWriter().write("{\"error\":\"Non autenticato\"}");
            return;
        }

        // --- Modalita' "personalita'": genera un profilo caratteriale del membro ---
        String personalityParam = req.getParameter("personality");
        if (personalityParam != null) {
            handlePersonality(Long.parseLong(personalityParam), resp);
            return;
        }

        int step;
        try { step = Integer.parseInt(Optional.ofNullable(req.getParameter("step")).orElse("0")); }
        catch (NumberFormatException e) { step = 0; }

        String theme = req.getParameter("theme");

        Map<String, Object> response = new LinkedHashMap<>();

        // --- STEP 0: benvenuto + scelta tema ---
        if (step == 0 || theme == null || !QUESTIONS.containsKey(theme)) {
            response.put("messages", List.of(
                    "Ciao, sono Iris! Sono qui per aiutarti a raccogliere un ricordo speciale.",
                    "Di cosa vorresti parlarmi oggi? Scegli pure dalle opzioni qui sotto."
            ));
            // themes -> lista di {id, label}
            List<Map<String, String>> themes = new ArrayList<>();
            THEMES.forEach((id, label) -> themes.add(Map.of("id", id, "label", label)));
            response.put("themes", themes);
            response.put("hasMore", true);
            response.put("nextStep", 1);
            resp.getWriter().write(JsonUtil.GSON.toJson(response));
            return;
        }

        // --- STEP N: domanda del tema ---
        List<String> questions = QUESTIONS.get(theme);
        int qIndex = step - 1;

        if (qIndex < questions.size()) {
            response.put("messages", List.of(questions.get(qIndex)));
            response.put("hasMore", qIndex < questions.size() - 1);
            response.put("nextStep", step + 1);
            response.put("theme", theme);
        } else {
            // Fine delle domande per il tema
            response.put("messages", List.of(CLOSING));
            response.put("hasMore", false);
            response.put("nextStep", step);
            response.put("theme", theme);
        }

        resp.getWriter().write(JsonUtil.GSON.toJson(response));
    }

    /**
     * Genera un profilo "personalita'" del membro basato sui dati disponibili:
     * epoca di nascita, luogo, descrizione, quantita' e temi dei ricordi collegati.
     * E' una generazione template-based (non LLM): in produzione Iris userebbe
     * un modello linguistico alimentato dai ricordi reali.
     */
    private void handlePersonality(Long memberId, HttpServletResponse resp) throws IOException {
        FamilyMember m = DataStore.get().findFamilyMember(memberId);
        if (m == null) {
            resp.setStatus(HttpServletResponse.SC_NOT_FOUND);
            resp.getWriter().write("{\"error\":\"Membro non trovato\"}");
            return;
        }

        List<Memory> memories = DataStore.get().memoriesByPerson(memberId);
        StringBuilder sb = new StringBuilder();

        // Epoca
        if (m.getBirthDate() != null && m.getBirthDate().length() >= 4) {
            int year = Integer.parseInt(m.getBirthDate().substring(0, 4));
            if (year < 1940) sb.append(m.getFirstName())
                    .append(" appartiene a una generazione che ha attraversato tempi difficili e straordinari. ");
            else if (year < 1965) sb.append(m.getFirstName())
                    .append(" e' cresciuto/a negli anni della ricostruzione e del boom economico. ");
            else if (year < 1990) sb.append(m.getFirstName())
                    .append(" appartiene alla generazione ponte tra il mondo analogico e quello digitale. ");
            else sb.append(m.getFirstName())
                    .append(" e' nativo/a digitale, cresciuto/a in un mondo connesso. ");
        }

        // Luogo
        if (m.getBirthPlace() != null && !m.getBirthPlace().isBlank()) {
            sb.append("Le sue radici affondano a ").append(m.getBirthPlace()).append(". ");
        }

        // Descrizione
        if (m.getDescription() != null && !m.getDescription().isBlank()) {
            sb.append(m.getDescription()).append(" ");
        }

        // Ricordi
        if (memories.isEmpty()) {
            sb.append("Non ci sono ancora ricordi collegati: ogni contributo della famiglia ")
              .append("aiutera' a ricostruire il suo ritratto.");
        } else if (memories.size() == 1) {
            sb.append("C'e' un ricordo custodito che parla di lui/lei: \"")
              .append(memories.get(0).getTitle()).append("\".");
        } else {
            sb.append("La famiglia custodisce ").append(memories.size())
              .append(" ricordi che lo/la riguardano, tra cui \"")
              .append(memories.get(0).getTitle()).append("\". ")
              .append("Ogni racconto aggiunge un tassello alla sua storia.");
        }

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("memberId", memberId);
        out.put("personality", sb.toString().trim());
        out.put("memoriesCount", memories.size());
        resp.getWriter().write(JsonUtil.GSON.toJson(out));
    }
}
