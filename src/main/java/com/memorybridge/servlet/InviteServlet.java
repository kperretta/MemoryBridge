package com.memorybridge.servlet;

import com.memorybridge.data.DataStore;
import com.memorybridge.util.JsonUtil;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.*;

import java.io.IOException;
import java.util.Map;

/**
 * POST /api/invite → genera un codice invito per la famiglia dell'utente loggato.
 * Risposta JSON: { inviteCode, inviteLink }
 */
@WebServlet("/api/invite")
public class InviteServlet extends HttpServlet {

    @Override
    protected void doPost(HttpServletRequest req, HttpServletResponse resp) throws IOException {
        resp.setContentType("application/json");
        resp.setCharacterEncoding("UTF-8");

        HttpSession session = req.getSession(false);
        if (session == null || session.getAttribute("familyCode") == null) {
            resp.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
            resp.getWriter().write("{\"error\":\"Non autenticato\"}");
            return;
        }
        String familyCode = (String) session.getAttribute("familyCode");

        String code = DataStore.get().createInviteCode(familyCode);

        // Costruisco il link cliccabile per l'invito
        String base = req.getScheme() + "://" + req.getServerName()
                + ":" + req.getServerPort() + req.getContextPath();
        String link = base + "/register.html?invite=" + code;

        Map<String, String> body = Map.of(
                "inviteCode", code,
                "inviteLink", link
        );
        resp.getWriter().write(JsonUtil.GSON.toJson(body));
    }
}
