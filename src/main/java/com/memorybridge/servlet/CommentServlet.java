package com.memorybridge.servlet;

import com.memorybridge.data.DataStore;
import com.memorybridge.model.Comment;
import com.memorybridge.model.User;
import com.memorybridge.util.JsonUtil;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.*;

import java.io.IOException;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * GET  /api/comments?memoryId=X  → commenti su un ricordo
 * POST /api/comments             → aggiunge commento (body: memoryId, text)
 */
@WebServlet("/api/comments")
public class CommentServlet extends HttpServlet {

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

        String memoryIdParam = req.getParameter("memoryId");
        if (memoryIdParam == null) {
            resp.setStatus(HttpServletResponse.SC_BAD_REQUEST);
            resp.getWriter().write("{\"error\":\"Parametro memoryId mancante\"}");
            return;
        }

        List<Comment> list = DataStore.get().commentsByMemory(Long.parseLong(memoryIdParam));
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

        Comment incoming = JsonUtil.GSON.fromJson(req.getReader(), Comment.class);
        if (incoming.getMemoryId() == null || incoming.getText() == null || incoming.getText().isBlank()) {
            resp.setStatus(HttpServletResponse.SC_BAD_REQUEST);
            resp.getWriter().write("{\"error\":\"memoryId e text obbligatori\"}");
            return;
        }
        incoming.setAuthorId(userId);
        incoming.setCreatedAt(LocalDateTime.now());

        Comment saved = DataStore.get().addComment(incoming);
        resp.getWriter().write(JsonUtil.GSON.toJson(enrich(saved)));
    }

    private Map<String, Object> enrich(Comment c) {
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("id", c.getId());
        map.put("memoryId", c.getMemoryId());
        map.put("authorId", c.getAuthorId());
        map.put("text", c.getText());
        map.put("createdAt", c.getCreatedAt() != null ? c.getCreatedAt().toString() : null);

        User author = DataStore.get().findUser(c.getAuthorId());
        map.put("authorName", author != null ? author.getFullName() : "Utente sconosciuto");
        // Id della foto profilo di chi commenta, usato dal frontend per l'avatar.
        map.put("authorAvatarMediaId", resolveAvatarMediaId(author));
        return map;
    }

    /**
     * Determina l'id della foto da usare come avatar per un utente:
     * 1) se l'utente ha una foto profilo propria (User.mediaId), usa quella;
     * 2) altrimenti, se e' collegato a un nodo dell'albero che ha una foto
     *    (FamilyMember.mediaId), riusa quella;
     * 3) altrimenti null (il frontend mostrera' le iniziali).
     */
    private Long resolveAvatarMediaId(User author) {
        if (author == null) return null;
        if (author.getMediaId() != null) return author.getMediaId();
        if (author.getFamilyMemberId() != null) {
            var fm = DataStore.get().findFamilyMember(author.getFamilyMemberId());
            if (fm != null) return fm.getMediaId();
        }
        return null;
    }
}