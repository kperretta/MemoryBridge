package com.memorybridge.servlet;

import com.memorybridge.data.DataStore;
import com.memorybridge.model.Memory;
import com.memorybridge.model.User;
import com.memorybridge.util.JsonUtil;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.*;

import java.io.IOException;
import java.time.LocalDateTime;
import java.util.*;

/**
 * GET  /api/memories             → tutti i ricordi della famiglia dell'utente loggato (feed)
 * GET  /api/memories?personId=X  → ricordi associati a un membro dell'albero
 * GET  /api/memories?id=X        → singolo ricordo
 * POST /api/memories             → crea un nuovo ricordo (body JSON)
 */
@WebServlet("/api/memories")
public class MemoryServlet extends HttpServlet {

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
        String familyCode = (String) session.getAttribute("familyCode");

        String idParam = req.getParameter("id");
        String personParam = req.getParameter("personId");

        if (idParam != null) {
            Memory m = DataStore.get().findMemory(Long.parseLong(idParam));
            if (m == null) {
                resp.setStatus(HttpServletResponse.SC_NOT_FOUND);
                resp.getWriter().write("{\"error\":\"Ricordo non trovato\"}");
                return;
            }
            resp.getWriter().write(JsonUtil.GSON.toJson(enrich(m)));
            return;
        }

        List<Memory> list;
        if (personParam != null) {
            list = DataStore.get().memoriesByPerson(Long.parseLong(personParam));
        } else {
            list = DataStore.get().memoriesByFamily(familyCode);
        }

        List<Map<String, Object>> enriched = list.stream().map(this::enrich).toList();
        resp.getWriter().write(JsonUtil.GSON.toJson(enriched));
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

        Long userId = (Long) session.getAttribute("userId");
        String familyCode = (String) session.getAttribute("familyCode");

        Memory incoming = JsonUtil.GSON.fromJson(req.getReader(), Memory.class);
        incoming.setAuthorId(userId);
        incoming.setFamilyCode(familyCode);
        incoming.setCreatedAt(LocalDateTime.now());

        Memory saved = DataStore.get().addMemory(incoming);
        resp.getWriter().write(JsonUtil.GSON.toJson(enrich(saved)));
    }

    /** Aggiunge al ricordo il nome dell'autore e della persona taggata (per comodità del frontend). */
    private Map<String, Object> enrich(Memory m) {
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("id", m.getId());
        map.put("authorId", m.getAuthorId());
        map.put("taggedPersonId", m.getTaggedPersonId());
        map.put("type", m.getType());
        map.put("title", m.getTitle());
        map.put("content", m.getContent());
        map.put("description", m.getDescription());
        map.put("eventDate", m.getEventDate());
        map.put("createdAt", m.getCreatedAt() != null ? m.getCreatedAt().toString() : null);

        User author = DataStore.get().findUser(m.getAuthorId());
        map.put("authorName", author != null ? author.getFullName() : "Utente sconosciuto");

        if (m.getTaggedPersonId() != null) {
            var tagged = DataStore.get().findFamilyMember(m.getTaggedPersonId());
            map.put("taggedPersonName", tagged != null ? tagged.getFullName() : null);
        }
        return map;
    }
}
