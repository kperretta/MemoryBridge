package com.memorybridge.servlet;

import com.memorybridge.data.DataStore;
import com.memorybridge.model.FamilyMember;
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

        HttpSession session = req.getSession(false);
        if (session == null || session.getAttribute("userId") == null) {
            resp.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
            resp.getWriter().write("{\"error\":\"Devi effettuare l'accesso\"}");
            return;
        }
        Long userId = (Long) session.getAttribute("userId");
        String familyCode = (String) session.getAttribute("familyCode");

        Map<String, Object> body = JsonUtil.GSON.fromJson(req.getReader(), Map.class);
        Object rawId = body.get("familyMemberId");
        if (rawId == null) {
            resp.setStatus(HttpServletResponse.SC_BAD_REQUEST);
            resp.getWriter().write("{\"error\":\"familyMemberId mancante\"}");
            return;
        }
        Long familyMemberId = ((Number) rawId).longValue();

        FamilyMember member = DataStore.get().findFamilyMember(familyMemberId);
        if (member == null || !member.getFamilyCode().equals(familyCode)) {
            resp.setStatus(HttpServletResponse.SC_NOT_FOUND);
            resp.getWriter().write("{\"error\":\"Membro non trovato in questa famiglia\"}");
            return;
        }
        if (member.getUserId() != null) {
            resp.setStatus(HttpServletResponse.SC_CONFLICT);
            resp.getWriter().write("{\"error\":\"Questo nodo è già collegato a un altro account\"}");
            return;
        }

        member.setUserId(userId);
        DataStore.get().updateFamilyMember(member);

        resp.getWriter().write(JsonUtil.GSON.toJson(member));
    }
}