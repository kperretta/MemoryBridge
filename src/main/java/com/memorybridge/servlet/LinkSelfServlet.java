package com.memorybridge.servlet;

import com.memorybridge.data.DataStore;
import com.memorybridge.model.FamilyMember;
import com.memorybridge.model.User;
import com.memorybridge.util.JsonUtil;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.*;

import java.io.IOException;
import java.util.Map;

/**
 * Collega il FamilyMember indicato all'utente attualmente loggato.
 * Usato in due casi:
 *  1) l'utente si riconosce in un nodo dell'albero già esistente e non
 *     ancora collegato a nessun account;
 *  2) l'utente ha appena creato un nuovo nodo per rappresentare sé stesso.
 * Il userId non viene mai accettato dal client: viene sempre preso dalla
 * sessione, per evitare che qualcuno si colleghi al nodo di qualcun altro.
 */
@WebServlet("/api/link-self")
public class LinkSelfServlet extends HttpServlet {

    @Override
    protected void doPost(HttpServletRequest req, HttpServletResponse resp) throws IOException {
        resp.setContentType("application/json");
        resp.setCharacterEncoding("UTF-8");

        // ---------- Sessione ----------
        HttpSession session = req.getSession(false);
        if (session == null || session.getAttribute("userId") == null) {
            resp.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
            resp.getWriter().write("{\"error\":\"Devi effettuare l'accesso\"}");
            return;
        }
        Long userId = (Long) session.getAttribute("userId");
        String familyCode = (String) session.getAttribute("familyCode");

        // ---------- Body ----------
        Map<String, Object> body;
        try {
            body = JsonUtil.GSON.fromJson(req.getReader(), Map.class);
            if (body == null) throw new RuntimeException("empty");
        } catch (Exception e) {
            resp.setStatus(HttpServletResponse.SC_BAD_REQUEST);
            resp.getWriter().write("{\"error\":\"Richiesta non valida\"}");
            return;
        }

        Object rawId = body.get("familyMemberId");
        if (!(rawId instanceof Number)) {
            resp.setStatus(HttpServletResponse.SC_BAD_REQUEST);
            resp.getWriter().write("{\"error\":\"familyMemberId mancante o non valido\"}");
            return;
        }
        Long familyMemberId = ((Number) rawId).longValue();

        // ---------- User dalla sessione ----------
        User user = DataStore.get().findUser(userId);
        if (user == null) {
            // Sessione valida ma utente sparito dal DB in-memory (es. dopo un riavvio)
            resp.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
            resp.getWriter().write("{\"error\":\"Sessione non più valida, effettua di nuovo l'accesso\"}");
            return;
        }

        // Se l'utente ha già un nodo collegato, non permettergli di cambiarlo
        // qui: renderebbe orfano il vecchio nodo. Va gestito con un endpoint
        // apposito (es. /api/unlink-self) se in futuro vorrai supportarlo.
        if (user.getFamilyMemberId() != null) {
            resp.setStatus(HttpServletResponse.SC_CONFLICT);
            resp.getWriter().write("{\"error\":\"Sei già collegato a un nodo dell'albero\"}");
            return;
        }

        // ---------- FamilyMember ----------
        FamilyMember member = DataStore.get().findFamilyMember(familyMemberId);
        if (member == null || !familyCode.equals(member.getFamilyCode())) {
            resp.setStatus(HttpServletResponse.SC_NOT_FOUND);
            resp.getWriter().write("{\"error\":\"Membro non trovato in questa famiglia\"}");
            return;
        }
        if (member.getUserId() != null) {
            resp.setStatus(HttpServletResponse.SC_CONFLICT);
            resp.getWriter().write("{\"error\":\"Questo nodo è già collegato a un altro account\"}");
            return;
        }

        // ---------- Collega nei due sensi ----------
        member.setUserId(userId);
        DataStore.get().updateFamilyMember(member);

        user.setFamilyMemberId(member.getId());
        // (l'oggetto User è la stessa istanza presente in DataStore, quindi
        // la modifica è già persistita nella mappa in-memory)

        // ---------- Risposta ----------
        // Restituisco sia il member che l'user aggiornato: il frontend userà
        // l'user per rinfrescare window.currentUser e riverniciare la navbar.
        resp.getWriter().write(JsonUtil.GSON.toJson(Map.of(
                "member", member,
                "user", user.toSafeCopy()
        )));
    }
}