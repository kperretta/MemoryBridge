package com.memorybridge.servlet;

import com.memorybridge.data.DataStore;
import com.memorybridge.model.Memory;
import com.memorybridge.model.User;
import com.memorybridge.util.JsonUtil;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.*;

import java.io.IOException;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeParseException;
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
        Long viewerId = (Long) session.getAttribute("userId");

        String idParam = req.getParameter("id");
        String personParam = req.getParameter("personId");

        if (idParam != null) {
            Memory m;
            try {
                m = DataStore.get().findMemory(Long.parseLong(idParam));
            } catch (NumberFormatException e) {
                resp.setStatus(HttpServletResponse.SC_BAD_REQUEST);
                resp.getWriter().write("{\"error\":\"Id non valido\"}");
                return;
            }
            if (m == null) {
                resp.setStatus(HttpServletResponse.SC_NOT_FOUND);
                resp.getWriter().write("{\"error\":\"Ricordo non trovato\"}");
                return;
            }
            resp.getWriter().write(JsonUtil.GSON.toJson(enrich(m, viewerId)));
            return;
        }

        List<Memory> list;
        if (personParam != null) {
            try {
                list = DataStore.get().memoriesByPerson(Long.parseLong(personParam));
            } catch (NumberFormatException e) {
                resp.setStatus(HttpServletResponse.SC_BAD_REQUEST);
                resp.getWriter().write("{\"error\":\"personId non valido\"}");
                return;
            }
        } else {
            list = DataStore.get().memoriesByFamily(familyCode);
        }

        List<Map<String, Object>> enriched = list.stream().map(m -> enrich(m, viewerId)).toList();
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

        Memory incoming;
        try {
            incoming = JsonUtil.GSON.fromJson(req.getReader(), Memory.class);
            if (incoming == null) throw new RuntimeException("empty body");
        } catch (Exception e) {
            resp.setStatus(HttpServletResponse.SC_BAD_REQUEST);
            resp.getWriter().write("{\"error\":\"Richiesta non valida\"}");
            return;
        }

        // ---------- Validazioni base ----------
        if (incoming.getTitle() == null || incoming.getTitle().isBlank()) {
            resp.setStatus(HttpServletResponse.SC_BAD_REQUEST);
            resp.getWriter().write("{\"error\":\"Il titolo è obbligatorio\"}");
            return;
        }
        if (incoming.getMediaId() == null) {
            resp.setStatus(HttpServletResponse.SC_BAD_REQUEST);
            resp.getWriter().write("{\"error\":\"Devi allegare un contenuto (audio, video o foto)\"}");
            return;
        }
        if (DataStore.get().findMedia(incoming.getMediaId()) == null) {
            resp.setStatus(HttpServletResponse.SC_BAD_REQUEST);
            resp.getWriter().write("{\"error\":\"Contenuto multimediale non trovato\"}");
            return;
        }
        if (incoming.getTaggedPersonId() == null) {
            resp.setStatus(HttpServletResponse.SC_BAD_REQUEST);
            resp.getWriter().write("{\"error\":\"Scegli il protagonista del ricordo\"}");
            return;
        }
        // Il protagonista deve appartenere alla stessa famiglia dell'utente
        var tagged = DataStore.get().findFamilyMember(incoming.getTaggedPersonId());
        if (tagged == null || !familyCode.equals(tagged.getFamilyCode())) {
            resp.setStatus(HttpServletResponse.SC_BAD_REQUEST);
            resp.getWriter().write("{\"error\":\"Protagonista non valido per questa famiglia\"}");
            return;
        }

        // ---------- Data del ricordo: non può essere nel futuro ----------
        // Un ricordo è per definizione nel passato; il controllo lato client
        // si può bypassare, quindi lo replichiamo qui.
        if (incoming.getEventDate() != null && !incoming.getEventDate().isBlank()) {
            try {
                LocalDate parsed = LocalDate.parse(incoming.getEventDate());
                if (parsed.isAfter(LocalDate.now())) {
                    resp.setStatus(HttpServletResponse.SC_BAD_REQUEST);
                    resp.getWriter().write("{\"error\":\"La data del ricordo non può essere nel futuro\"}");
                    return;
                }
            } catch (DateTimeParseException e) {
                resp.setStatus(HttpServletResponse.SC_BAD_REQUEST);
                resp.getWriter().write("{\"error\":\"Data del ricordo non valida\"}");
                return;
            }
        }

        // ---------- Campi impostati dal server ----------
        // Non ci fidiamo mai di authorId/familyCode/createdAt inviati dal client.
        incoming.setAuthorId(userId);
        incoming.setFamilyCode(familyCode);
        incoming.setCreatedAt(LocalDateTime.now());

        Memory saved = DataStore.get().addMemory(incoming);
        resp.getWriter().write(JsonUtil.GSON.toJson(enrich(saved, userId)));
    }

    /** Aggiunge al ricordo il nome (e la foto) dell'autore, della persona taggata,
     *  e lo stato dei like — per comodità del frontend. */
    private Map<String, Object> enrich(Memory m, Long viewerId) {
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
        map.put("mediaId", m.getMediaId());

        // Include anche il content-type del media (se presente) cosi' il frontend
        // decide come renderizzare anche se il campo type e' stato salvato male.
        if (m.getMediaId() != null) {
            var media = DataStore.get().findMedia(m.getMediaId());
            if (media != null) map.put("mediaContentType", media.getContentType());
        }

        User author = DataStore.get().findUser(m.getAuthorId());
        map.put("authorName", author != null ? author.getFullName() : "Utente sconosciuto");
        // Id della foto profilo dell'autore, usato dal frontend per l'avatar nell'header
        // del post. Se null, il frontend mostra le iniziali come fallback.
        map.put("authorAvatarMediaId", resolveAvatarMediaId(author));

        if (m.getTaggedPersonId() != null) {
            var tagged = DataStore.get().findFamilyMember(m.getTaggedPersonId());
            map.put("taggedPersonName", tagged != null ? tagged.getFullName() : null);
        }

        // Like: conteggio totale + se l'utente che sta guardando ha già messo like.
        map.put("likeCount", DataStore.get().likeCount(m.getId()));
        map.put("likedByMe", viewerId != null && DataStore.get().hasLiked(m.getId(), viewerId));

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