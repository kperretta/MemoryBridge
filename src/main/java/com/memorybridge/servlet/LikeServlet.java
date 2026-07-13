package com.memorybridge.servlet;

import com.memorybridge.data.DataStore;
import com.memorybridge.util.JsonUtil;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.*;

import java.io.IOException;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * POST /api/likes   (body JSON: {"memoryId": N})
 *   -> mette o toglie (toggle) il like dell'utente loggato su un ricordo.
 *   -> risponde con {"liked": true|false, "count": N}
 *
 * Un utente può mettere like a un ricordo una sola volta: se lo richiama
 * di nuovo, il like viene rimosso (comportamento standard "cuore" dei social).
 */
@WebServlet("/api/likes")
public class LikeServlet extends HttpServlet {

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
        Long userId = (Long) session.getAttribute("userId");

        Map<?, ?> body;
        try {
            body = JsonUtil.GSON.fromJson(req.getReader(), Map.class);
        } catch (Exception e) {
            resp.setStatus(HttpServletResponse.SC_BAD_REQUEST);
            resp.getWriter().write("{\"error\":\"Body non valido\"}");
            return;
        }

        if (body == null || body.get("memoryId") == null) {
            resp.setStatus(HttpServletResponse.SC_BAD_REQUEST);
            resp.getWriter().write("{\"error\":\"memoryId mancante\"}");
            return;
        }

        Long memoryId;
        try {
            memoryId = ((Number) body.get("memoryId")).longValue();
        } catch (ClassCastException e) {
            resp.setStatus(HttpServletResponse.SC_BAD_REQUEST);
            resp.getWriter().write("{\"error\":\"memoryId non valido\"}");
            return;
        }

        if (DataStore.get().findMemory(memoryId) == null) {
            resp.setStatus(HttpServletResponse.SC_NOT_FOUND);
            resp.getWriter().write("{\"error\":\"Ricordo non trovato\"}");
            return;
        }

        boolean liked = DataStore.get().toggleLike(memoryId, userId);
        long count = DataStore.get().likeCount(memoryId);

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("liked", liked);
        out.put("count", count);
        resp.getWriter().write(JsonUtil.GSON.toJson(out));
    }
}