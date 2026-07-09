package com.memorybridge.servlet;

import com.memorybridge.util.JsonUtil;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.*;

import java.io.IOException;
import java.util.List;
import java.util.Map;

/**
 * "Finta IA" per la chat con Iris (T1). Il frontend chiama:
 *   GET /api/iris?step=N   → restituisce la domanda N-esima
 *
 * In un sistema reale useremmo LLM, qui abbiamo un elenco di domande
 * mirate a stimolare il racconto di ricordi familiari.
 */
@WebServlet("/api/iris")
public class IrisServlet extends HttpServlet {

    private static final List<String> WELCOME = List.of(
            "Ciao, sono Iris! Sono qui per aiutarti a raccogliere un ricordo speciale.",
            "Quando sei pronto, dimmi pure di chi o di cosa vorresti parlare oggi."
    );

    private static final List<String> QUESTIONS = List.of(
            "Che bel racconto. Ti ricordi in che periodo è successo?",
            "C'è un dettaglio particolare che ti è rimasto impresso? Un profumo, un colore, una frase?",
            "Chi era presente in quel momento?",
            "Come ti sei sentito? Che emozione hai provato?",
            "Cosa vorresti che i tuoi familiari sapessero di questa storia?",
            "C'è qualcos'altro che vorresti aggiungere prima di chiudere?"
    );

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

        String stepParam = req.getParameter("step");
        int step = (stepParam == null) ? 0 : Integer.parseInt(stepParam);

        Map<String, Object> response;
        if (step == 0) {
            // primo turno: due messaggi di benvenuto (miglioramento #5 Assignment 3)
            response = Map.of(
                    "messages", WELCOME,
                    "hasMore", true,
                    "nextStep", 1
            );
        } else if (step - 1 < QUESTIONS.size()) {
            response = Map.of(
                    "messages", List.of(QUESTIONS.get(step - 1)),
                    "hasMore", step < QUESTIONS.size(),
                    "nextStep", step + 1
            );
        } else {
            response = Map.of(
                    "messages", List.of("Grazie per aver condiviso questo ricordo. Quando vuoi, premi 'Fine' per salvarlo."),
                    "hasMore", false,
                    "nextStep", step
            );
        }

        resp.getWriter().write(JsonUtil.GSON.toJson(response));
    }
}
