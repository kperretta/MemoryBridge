package com.memorybridge.servlet;

import com.memorybridge.data.DataStore;
import com.memorybridge.model.FamilyMember;
import com.memorybridge.model.Memory;
import com.memorybridge.util.JsonUtil;
import com.memorybridge.util.GroqApiClient;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.*;

import java.io.IOException;
import java.util.*;

@WebServlet("/api/iris")
public class IrisServlet extends HttpServlet {

    private static final Map<String, String> THEMES = new LinkedHashMap<>();
    static {
        THEMES.put("person",    "Una persona di famiglia");
        THEMES.put("event",     "Un momento speciale");
        THEMES.put("place",     "Un luogo importante");
        THEMES.put("tradition", "Una tradizione o ricetta");
        THEMES.put("object",    "Un oggetto con una storia");
    }

    private static final int MAX_QUESTIONS_PER_THEME = 4;

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

        if (step == 0 || theme == null || !THEMES.containsKey(theme)) {
            response.put("messages", List.of(
                    "Ciao, sono Iris! Sono qui per aiutarti a raccogliere un ricordo speciale.",
                    "Di cosa vorresti parlarmi oggi? Scegli pure dalle opzioni qui sotto."
            ));
            List<Map<String, String>> themes = new ArrayList<>();
            THEMES.forEach((id, label) -> themes.add(Map.of("id", id, "label", label)));
            response.put("themes", themes);
            response.put("hasMore", true);
            response.put("nextStep", 1);
            resp.getWriter().write(JsonUtil.GSON.toJson(response));
            return;
        }

        int qIndex = step - 1;

        if (qIndex >= MAX_QUESTIONS_PER_THEME) {
            response.put("messages", List.of(CLOSING));
            response.put("hasMore", false);
            response.put("nextStep", step);
            response.put("theme", theme);
            resp.getWriter().write(JsonUtil.GSON.toJson(response));
            return;
        }

        try {
            String question = generateQuestion(theme, req);
            response.put("messages", List.of(question));
            response.put("hasMore", qIndex < MAX_QUESTIONS_PER_THEME - 1);
            response.put("nextStep", step + 1);
            response.put("theme", theme);
            resp.getWriter().write(JsonUtil.GSON.toJson(response));
        } catch (Exception e) {
            System.err.println("[IrisServlet] " + "Iris: chiamata a Groq fallita: " + e.getMessage());
            e.printStackTrace();
            resp.setStatus(HttpServletResponse.SC_SERVICE_UNAVAILABLE);
            resp.getWriter().write("{\"error\":\"Iris non e' raggiungibile in questo momento. Riprova tra poco.\"}");
        }
    }

    @Override
    protected void doPost(HttpServletRequest req, HttpServletResponse resp) throws IOException {
        resp.setContentType("application/json");
        resp.setCharacterEncoding("UTF-8");

        HttpSession session = req.getSession(false);
        if (session == null || session.getAttribute("userId") == null) {
            resp.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
            resp.getWriter().write("{\"error\":\"Non autenticato\"}");
            return;
        }

        Map<String, Object> body = JsonUtil.GSON.fromJson(req.getReader(), Map.class);
        String action = (String) body.get("action");

        if ("elaborate".equals(action)) {
            handleElaborate(body, resp);
            return;
        }

        resp.setStatus(HttpServletResponse.SC_BAD_REQUEST);
        resp.getWriter().write("{\"error\":\"Azione non riconosciuta\"}");
    }

    @SuppressWarnings("unchecked")
    private String generateQuestion(String theme, HttpServletRequest req) {
        String historyParam = req.getParameter("history");
        List<Map<String, String>> history = (historyParam == null || historyParam.isBlank())
                ? List.of()
                : JsonUtil.GSON.fromJson(historyParam, List.class);

        String systemPrompt = "Sei Iris, un'assistente calda ed empatica che aiuta le persone a " +
                "raccontare ricordi di famiglia. Il tema scelto e': " + THEMES.get(theme) + ". " +
                "Se non c'e' ancora nessuna risposta dell'utente, fai una domanda aperta e " +
                "coinvolgente per iniziare a raccontare su questo tema. Se invece l'utente ha gia' " +
                "risposto a una o piu' domande, fai UNA domanda di approfondimento breve che si " +
                "colleghi in modo naturale a quello che ha appena raccontato, invece di seguire una " +
                "scaletta fissa. Fai sempre e solo UNA domanda alla volta (massimo 2 frasi), sii " +
                "calorosa, empatica e concisa. Rispondi SOLO con la domanda, senza premesse ne' saluti.";

        return GroqApiClient.nextIrisMessage(systemPrompt, history);
    }

    @SuppressWarnings("unchecked")
    private void handleElaborate(Map<String, Object> body, HttpServletResponse resp) throws IOException {
        Object historyObj = body.get("history");
        if (!(historyObj instanceof List) || ((List<?>) historyObj).isEmpty()) {
            resp.setStatus(HttpServletResponse.SC_BAD_REQUEST);
            resp.getWriter().write("{\"error\":\"history mancante o vuota\"}");
            return;
        }
        List<Map<String, String>> history = (List<Map<String, String>>) historyObj;


        List<Map<String, String>> historyForElaboration = new ArrayList<>(history);
        historyForElaboration.add(Map.of(
                "role", "user",
                "text", "Ora riformula in un racconto scorrevole in prima persona SOLO quello che ho scritto " +
                        "sopra, senza aggiungere nulla che io non abbia detto. Se manca un dettaglio, lascialo " +
                        "fuori, non inventarlo."
        ));

        try {
            String systemPrompt = "Sei un editor che riformula in prima persona una conversazione fatta di domande " +
                    "e risposte, trasformandola in un testo scorrevole, come se la persona stesse raccontando il " +
                    "ricordo di getto a voce. REGOLE FERREE: " +
                    "1) Usa ESCLUSIVAMENTE le informazioni presenti nelle risposte dell'utente. " +
                    "2) NON aggiungere nomi, luoghi, date, dettagli sensoriali, emozioni o eventi che l'utente non ha " +
                    "menzionato esplicitamente. " +
                    "3) Se un dettaglio non c'e', semplicemente non scriverlo: non riempire i vuoti con invenzioni. " +
                    "4) Non includere le domande fatte da Iris, solo il racconto risultante. " +
                    "5) Il tuo compito e' RIFORMULARE, non ARRICCHIRE: cambia la forma (da domanda-risposta a racconto " +
                    "scorrevole), non il contenuto. " +
                    "Scrivi un unico testo coeso, in un tono caldo ma aderente a ciò che e' stato detto, con una " +
                    "lunghezza simile a quella delle risposte fornite complessivamente.";

            String elaborated = GroqApiClient.nextIrisMessage(systemPrompt, historyForElaboration, 1000);
            System.err.println("[IrisServlet] " + "Iris: racconto elaborato da Groq con successo.");

            Map<String, Object> out = new LinkedHashMap<>();
            out.put("elaborated", elaborated);
            resp.getWriter().write(JsonUtil.GSON.toJson(out));
        } catch (Exception e) {
            System.err.println("[IrisServlet] " + "Iris: elaborazione fallita: " + e.getMessage());
            e.printStackTrace();
            resp.setStatus(HttpServletResponse.SC_SERVICE_UNAVAILABLE);
            resp.getWriter().write("{\"error\":\"Non e' stato possibile elaborare il racconto. Riprova tra poco.\"}");
        }
    }

    private void handlePersonality(Long memberId, HttpServletResponse resp) throws IOException {
        FamilyMember m = DataStore.get().findFamilyMember(memberId);
        if (m == null) {
            resp.setStatus(HttpServletResponse.SC_NOT_FOUND);
            resp.getWriter().write("{\"error\":\"Membro non trovato\"}");
            return;
        }

        List<Memory> memories = DataStore.get().memoriesByPerson(memberId);
        StringBuilder sb = new StringBuilder();

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

        if (m.getBirthPlace() != null && !m.getBirthPlace().isBlank()) {
            sb.append("Le sue radici affondano a ").append(m.getBirthPlace()).append(". ");
        }

        if (m.getDescription() != null && !m.getDescription().isBlank()) {
            sb.append(m.getDescription()).append(" ");
        }

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