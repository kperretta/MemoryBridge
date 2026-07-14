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
 * Client verso l'API di Groq (https://groq.com), che offre inferenza gratuita
 * su modelli open-source con un tier gratuito generoso (nessuna carta di
 * credito richiesta per iniziare).
 *
 * VANTAGGIO rispetto a Ollama: nessuna installazione locale, nessun Docker.
 * Basta avere internet: la chiamata va al cloud di Groq.
 *
 * ATTENZIONE SICUREZZA: la chiave qui sotto e' hardcoded per semplicita' di
 * consegna del progetto universitario (nessun setup richiesto dal
 * valutatore). Questo va bene SOLO se:
 *   1) il repository e' privato (non pubblico su GitHub)
 *   2) e' una chiave del tier gratuito (nessun rischio economico)
 *   3) dopo la consegna la chiave viene rigenerata su console.groq.com,
 *      invalidando quella committata
 * In un progetto reale la chiave andrebbe SEMPRE letta da variabile
 * d'ambiente, mai committata. Qui supportiamo entrambe le cose: se la
 * variabile d'ambiente GROQ_API_KEY e' impostata, ha la precedenza;
 * altrimenti si usa il valore di fallback qui sotto.
 */
public class GroqApiClient {

    private static final String API_URL = "https://api.groq.com/openai/v1/chat/completions";

    // Fallback hardcoded SOLO per comodita' di consegna (vedi commento sopra).
    // Sostituisci con la tua chiave presa da https://console.groq.com/keys

    private static final String FALLBACK_API_KEY = "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";

    private static final String API_KEY =
            (System.getenv("GROQ_API_KEY") != null && !System.getenv("GROQ_API_KEY").isBlank())
                    ? System.getenv("GROQ_API_KEY")
                    : FALLBACK_API_KEY;

    // Verifica i modelli disponibili aggiornati su https://console.groq.com/docs/models
    // (il tier gratuito e la lista modelli possono cambiare nel tempo)
    private static final String MODEL = "llama-3.1-8b-instant";

    private static final HttpClient CLIENT = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(10))
            .build();

    /**
     * Genera il prossimo messaggio di Iris (o il racconto elaborato) data la
     * cronologia della conversazione. Overload con maxTokens di default (300),
     * adatto a domande brevi.
     */
    public static String nextIrisMessage(String systemPrompt, List<Map<String, String>> history) {
        return nextIrisMessage(systemPrompt, history, 300);
    }



    /**
     * Come sopra, ma con un limite di token personalizzabile — utile per
     * compiti che richiedono output più lunghi (es. l'elaborazione di un
     * intero racconto), dove 300 token potrebbero troncare la risposta.
     */
    public static String nextIrisMessage(String systemPrompt, List<Map<String, String>> history, int maxTokens) {
        if (API_KEY == null || API_KEY.isBlank() || API_KEY.startsWith("INSERISCI_QUI")) {
            throw new IllegalStateException(
                    "Chiave Groq non configurata: imposta GROQ_API_KEY o valorizza FALLBACK_API_KEY.");
        }


        // Formato OpenAI-compatibile: messages = [{role, content}, ...]
        List<Map<String, String>> messages = new ArrayList<>();
        messages.add(Map.of("role", "system", "content", systemPrompt));
        for (Map<String, String> m : history) {
            String role = "user".equals(m.get("role")) ? "user" : "assistant";
            String text = m.get("text");
            if (text == null || text.isBlank()) {
                text = "[messaggio audio, nessuna trascrizione testuale disponibile]";
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
                .timeout(Duration.ofSeconds(30))
                .build();

        try {
            HttpResponse<String> response = CLIENT.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() != 200) {
                throw new RuntimeException("Errore Groq (" + response.statusCode() + "): " + response.body());
            }
            // Risposta OpenAI-compatibile: {"choices":[{"message":{"role":"assistant","content":"..."}}]}
            Map<String, Object> parsed = JsonUtil.GSON.fromJson(response.body(), Map.class);
            List<Map<String, Object>> choices = (List<Map<String, Object>>) parsed.get("choices");
            Map<String, Object> message = (Map<String, Object>) choices.get(0).get("message");
            String content = (String) message.get("content");
            if (content == null || content.isBlank()) {
                throw new RuntimeException("Groq ha risposto con un testo vuoto. Risposta completa: " + response.body());
            }
            return content;
        } catch (Exception e) {
            throw new RuntimeException("Chiamata a Groq fallita: " + e.getMessage(), e);
        }

    }


}