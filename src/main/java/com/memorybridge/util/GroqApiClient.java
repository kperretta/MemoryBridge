package com.memorybridge.util;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * Client verso l'API di Groq (https://groq.com).
 *
 * La chiave viene letta unicamente dalla variabile d'ambiente GROQ_API_KEY.
 * Se la chiave non e' configurata, oppure se la chiamata di rete fallisce,
 * passa automaticamente a una "Modalita' Demo" (Mock response).
 * Questo garantisce che la Web App sia sempre testabile e che l'interfaccia
 * utente mantenga la sua usabilita' senza andare in errore.
 */

public class GroqApiClient {

    private static final String API_URL = "https://api.groq.com/openai/v1/chat/completions";
    private static final String API_KEY = System.getenv("GROQ_API_KEY");
    private static final String MODEL = "openai/gpt-oss-20b";
    private static final String VOICE_PLACEHOLDER = "[risposta vocale dell'utente, contenuto non trascritto]";

    private static final HttpClient CLIENT = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(10))
            .build();

    public static String nextIrisMessage(String systemPrompt, List<Map<String, String>> history) {
        return nextIrisMessage(systemPrompt, history, 300);
    }

    public static String nextIrisMessage(String systemPrompt, List<Map<String, String>> history, int maxTokens) {
        // 1. Se la chiave manca, usa direttamente il Fallback Empatico
        if (API_KEY == null || API_KEY.isBlank()) {
            return generateEmpatheticFallback(systemPrompt, history);
        }

        List<Map<String, String>> messages = new ArrayList<>();
        messages.add(Map.of("role", "system", "content", systemPrompt));
        for (Map<String, String> m : history) {
            String role = "user".equals(m.get("role")) ? "user" : "assistant";
            String text = m.get("text");
            if (text == null || text.isBlank()) {
                text = VOICE_PLACEHOLDER;
            }
            messages.add(Map.of("role", role, "content", text));
        }

        Map<String, Object> payload = Map.of(
                "model", MODEL,
                "messages", messages,
                "max_tokens", maxTokens,
                "temperature", 0.7
        );

        String body = JsonUtil.GSON.toJson(payload);

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(API_URL))
                .header("Authorization", "Bearer " + API_KEY)
                .header("content-type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(body))
                .timeout(Duration.ofSeconds(10))
                .build();

        try {
            HttpResponse<String> response = CLIENT.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() != 200) {
                System.err.println("[GroqApiClient] API Errore " + response.statusCode() + ". Uso il fallback.");
                return generateEmpatheticFallback(systemPrompt, history);
            }

            Map<String, Object> parsed = JsonUtil.GSON.fromJson(response.body(), Map.class);
            List<Map<String, Object>> choices = (List<Map<String, Object>>) parsed.get("choices");
            Map<String, Object> message = (Map<String, Object>) choices.get(0).get("message");
            String content = (String) message.get("content");

            if (content == null || content.isBlank()) {
                return generateEmpatheticFallback(systemPrompt, history);
            }
            return content;

        } catch (Exception e) {
            System.err.println("[GroqApiClient] Connessione fallita: " + e.getMessage() + ". Uso il fallback.");
            return generateEmpatheticFallback(systemPrompt, history);
        }
    }

    /**
     * Genera una risposta simulata contestuale.
     * Se rileva che la richiesta e' un'elaborazione del racconto, assembla le risposte.
     * Altrimenti, genera una domanda di fallback.
     */
    private static String generateEmpatheticFallback(String systemPrompt, List<Map<String, String>> history) {
        String promptLower = (systemPrompt != null) ? systemPrompt.toLowerCase() : "";

        // CASO A: E' una richiesta di ELABORAZIONE / RIFORMULAZIONE del racconto
        if (promptLower.contains("editor") || promptLower.contains("riformula") || promptLower.contains("racconto")) {
            return generateMockElaboration(history);
        }

        // CASO B: E' una normale DOMANDA di Iris durante la chat
        return generateMockQuestion(promptLower, history);
    }

    /**
     * Simula la riformulazione dell'IA prendendo i contributi dell'utente
     * e unendoli in un unico racconto.
     */
    private static String generateMockElaboration(List<Map<String, String>> history) {
        if (history == null || history.isEmpty()) {
            return "Questo è un testo di esempio per un ricordo di famiglia custodito con cura.";
        }

        List<String> userAnswers = new ArrayList<>();

        for (Map<String, String> m : history) {
            if ("user".equals(m.get("role"))) {
                String text = m.get("text");
                if (text != null && !text.isBlank()
                        && !isThemeLabel(text)
                        && !text.startsWith("Ora riformula")
                        && !text.equals(VOICE_PLACEHOLDER)) {

                    // Puliamo il testo rimuovendo la punteggiatura finale per gestire la formattazione
                    String clean = text.trim();
                    while (clean.endsWith(".") || clean.endsWith(",")) {
                        clean = clean.substring(0, clean.length() - 1).trim();
                    }

                    if (!clean.isEmpty()) {
                        userAnswers.add(clean);
                    }
                }
            }
        }

        // Se l'utente non ha scritto testo (es. ha usato solo risposte vocali o non ha risposto)
        if (userAnswers.isEmpty()) {
            return "Ho condiviso un momento speciale legato alle nostre tradizioni di famiglia. " +
                    "Questo ricordo racchiude emozioni e dettagli preziosi che desidero custodire nel tempo.";
        }

        // Assemblaggio lineare: ogni risposta dell'utente diventa una frase pulita con punto finale
        StringBuilder story = new StringBuilder();

        for (int i = 0; i < userAnswers.size(); i++) {
            String part = userAnswers.get(i);

            // Assicura maiuscola a inizio frase
            String formatted = Character.toUpperCase(part.charAt(0)) + part.substring(1);

            if (i > 0) {
                story.append(". ");
            }
            story.append(formatted);
        }

        story.append(". È un ricordo davvero importante che conserverò sempre.");
        return story.toString();
    }

    private static boolean isThemeLabel(String text) {
        String t = text.trim();
        return t.equalsIgnoreCase("Una persona di famiglia") ||
                t.equalsIgnoreCase("Un momento speciale") ||
                t.equalsIgnoreCase("Un luogo importante") ||
                t.equalsIgnoreCase("Una tradizione o ricetta") ||
                t.equalsIgnoreCase("Un oggetto con una storia") ||
                t.equalsIgnoreCase("Racconto libero");
    }

    private static String generateMockQuestion(String promptLower, List<Map<String, String>> history) {
        int realUserResponses = 0;
        if (history != null) {
            for (Map<String, String> m : history) {
                if ("user".equals(m.get("role"))) {
                    String text = m.get("text");
                    if (text != null && !text.isBlank() && !isThemeLabel(text)) {
                        realUserResponses++;
                    }
                }
            }
        }

        if (realUserResponses == 0) {
            if (promptLower.contains("oggetto")) return "Di che oggetto si tratta? Che ricordi o sensazioni ti evoca quando lo guardi?";
            if (promptLower.contains("persona")) return "Chi è la persona di cui vuoi raccontarmi? Qual è il primo ricordo che ti viene in mente di lei?";
            if (promptLower.contains("evento") || promptLower.contains("momento")) return "Che momento speciale hai scelto di ricordare? Dove ti trovavi e chi c'era con te?";
            if (promptLower.contains("luogo")) return "Qual è questo luogo così importante? Che profumi o dettagli visivi ti sono rimasti impressi?";
            if (promptLower.contains("tradizione") || promptLower.contains("ricetta") || promptLower.contains("tradition")) return "Raccontami di questa tradizione o ricetta! In quali occasioni o momenti speciali della famiglia prende vita?";
            return "Sono pronta ad ascoltarti: da dove ti piacerebbe iniziare il racconto di questo ricordo?";
        }

        if (realUserResponses == 1) return "Che bel dettaglio! C'è un'emozione o un ricordo particolare legato a questo aspetto?";
        if (realUserResponses <= 3) return "Capisco perfettamente. C'è qualcos'altro o qualcun altro che ha reso quel momento indimenticabile?";
        return "Grazie per questo splendido racconto. C'è un ultimo dettaglio che vorresti aggiungere prima di salvarlo?";
    }

}