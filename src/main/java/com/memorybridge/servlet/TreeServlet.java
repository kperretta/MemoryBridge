package com.memorybridge.servlet;

import com.google.gson.JsonObject;
import com.memorybridge.data.DataStore;
import com.memorybridge.model.FamilyMember;
import com.memorybridge.util.JsonUtil;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.*;

import java.io.IOException;
import java.util.List;

/**
 * GET  /api/tree           → tutti i nodi dell'albero della famiglia dell'utente
 * GET  /api/tree?id=X      → singolo membro
 * POST /api/tree           → aggiungi nuovo membro (body JSON). Se il body contiene
 *                            "_siblingOf": <id>, e il membro referenziato non ha
 *                            ancora genitori registrati, viene creato/riusato un
 *                            genitore fantasma comune per collegare i due fratelli.
 * PUT  /api/tree           → modifica membro esistente (body JSON con id), oppure,
 *                            se il body contiene "_phantomReplace", sostituisce/integra
 *                            un genitore fantasma con uno reale su tutti i fratelli
 *                            che lo condividono.
 */
@WebServlet("/api/tree")
public class TreeServlet extends HttpServlet {

    @Override
    protected void doGet(HttpServletRequest req, HttpServletResponse resp) throws IOException {
        resp.setContentType("application/json");
        resp.setCharacterEncoding("UTF-8");

        HttpSession session = req.getSession(false);
        if (session == null || session.getAttribute("familyCode") == null) {
            resp.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
            resp.getWriter().write("{\"error\":\"Non autenticato\"}");
            return;
        }
        String familyCode = (String) session.getAttribute("familyCode");

        String idParam = req.getParameter("id");
        if (idParam != null) {
            FamilyMember m = DataStore.get().findFamilyMember(Long.parseLong(idParam));
            if (m == null || !familyCode.equals(m.getFamilyCode())) {
                resp.setStatus(HttpServletResponse.SC_NOT_FOUND);
                resp.getWriter().write("{\"error\":\"Membro non trovato\"}");
                return;
            }
            resp.getWriter().write(JsonUtil.GSON.toJson(m));
            return;
        }

        // Restituisco anche i nodi fantasma
        List<FamilyMember> tree = DataStore.get().familyTree(familyCode);
        resp.getWriter().write(JsonUtil.GSON.toJson(tree));
    }

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

        JsonObject bodyJson = JsonUtil.GSON.fromJson(req.getReader(), JsonObject.class);
        FamilyMember incoming = JsonUtil.GSON.fromJson(bodyJson, FamilyMember.class);
        incoming.setFamilyCode(familyCode);

        FamilyMember saved = DataStore.get().addFamilyMember(incoming);

        // Caso "fratello/sorella orfano": il client segnala con _siblingOf
        // l'id del fratello target quando questo non ha ancora
        // motherId/fatherId. Creo (o riuso) un genitore fantasma comune e
        // collego entrambi ad esso.
        if (bodyJson.has("_siblingOf") && !bodyJson.get("_siblingOf").isJsonNull()) {
            Long siblingOfId = bodyJson.get("_siblingOf").getAsLong();
            FamilyMember sibling = DataStore.get().findFamilyMember(siblingOfId);
            if (sibling != null && familyCode.equals(sibling.getFamilyCode())) {
                FamilyMember phantom = DataStore.get().getOrCreatePhantomParent(familyCode, siblingOfId);

                saved.setFatherId(phantom.getId());
                DataStore.get().updateFamilyMember(saved);

                sibling.setFatherId(phantom.getId());
                DataStore.get().updateFamilyMember(sibling);
            }
        }

        resp.getWriter().write(JsonUtil.GSON.toJson(saved));
    }

    @Override
    protected void doDelete(HttpServletRequest req, HttpServletResponse resp) throws IOException {
        resp.setContentType("application/json");
        resp.setCharacterEncoding("UTF-8");

        HttpSession session = req.getSession(false);
        if (session == null || session.getAttribute("familyCode") == null) {
            resp.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
            resp.getWriter().write("{\"error\":\"Non autenticato\"}");
            return;
        }
        String familyCode = (String) session.getAttribute("familyCode");

        String idParam = req.getParameter("id");
        if (idParam == null) {
            resp.setStatus(HttpServletResponse.SC_BAD_REQUEST);
            resp.getWriter().write("{\"error\":\"ID mancante\"}");
            return;
        }
        Long id = Long.parseLong(idParam);
        FamilyMember existing = DataStore.get().findFamilyMember(id);
        if (existing == null || !familyCode.equals(existing.getFamilyCode())) {
            resp.setStatus(HttpServletResponse.SC_NOT_FOUND);
            resp.getWriter().write("{\"error\":\"Membro non trovato\"}");
            return;
        }
        DataStore.get().deleteFamilyMember(id);
        resp.getWriter().write("{\"deleted\":true}");
    }

    @Override
    protected void doPut(HttpServletRequest req, HttpServletResponse resp) throws IOException {
        resp.setContentType("application/json");
        resp.setCharacterEncoding("UTF-8");

        HttpSession session = req.getSession(false);
        if (session == null || session.getAttribute("familyCode") == null) {
            resp.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
            resp.getWriter().write("{\"error\":\"Non autenticato\"}");
            return;
        }
        String familyCode = (String) session.getAttribute("familyCode");

        JsonObject bodyJson = JsonUtil.GSON.fromJson(req.getReader(), JsonObject.class);

        // Azione speciale: sostituzione/integrazione di un genitore fantasma
        // con uno reale, propagata a tutti i fratelli che lo condividono.
        if (bodyJson.has("_phantomReplace")) {
            JsonObject pr = bodyJson.getAsJsonObject("_phantomReplace");
            Long phantomId = pr.get("phantomId").getAsLong();
            Long realParentId = pr.get("realParentId").getAsLong();
            String field = (pr.has("field") && !pr.get("field").isJsonNull())
                    ? pr.get("field").getAsString() : null;

            FamilyMember phantom = DataStore.get().findFamilyMember(phantomId);
            if (phantom == null || !phantom.isPhantom() || !familyCode.equals(phantom.getFamilyCode())) {
                resp.setStatus(HttpServletResponse.SC_NOT_FOUND);
                resp.getWriter().write("{\"error\":\"Nodo fantasma non trovato\"}");
                return;
            }

            if ("mother".equals(field)) {
                // Il padre resta ignoto (fantasma non eliminato): aggiungo
                // solo la madre reale a tutti i fratelli che condividono il fantasma.
                DataStore.get().propagateNewParentToPhantomSiblings(phantomId, "mother", realParentId);
            } else {
                // Il fantasma viene sostituito integralmente (es. è arrivato il padre).
                DataStore.get().replacePhantomParent(phantomId, realParentId);
            }

            resp.getWriter().write(JsonUtil.GSON.toJson(DataStore.get().familyTree(familyCode)));
            return;
        }

        // Flusso normale di aggiornamento
        FamilyMember incoming = JsonUtil.GSON.fromJson(bodyJson, FamilyMember.class);
        if (incoming.getId() == null) {
            resp.setStatus(HttpServletResponse.SC_BAD_REQUEST);
            resp.getWriter().write("{\"error\":\"ID mancante\"}");
            return;
        }
        FamilyMember existing = DataStore.get().findFamilyMember(incoming.getId());
        if (existing == null || !familyCode.equals(existing.getFamilyCode())) {
            resp.setStatus(HttpServletResponse.SC_NOT_FOUND);
            resp.getWriter().write("{\"error\":\"Membro non trovato\"}");
            return;
        }
        incoming.setFamilyCode(familyCode);
        DataStore.get().updateFamilyMember(incoming);
        resp.getWriter().write(JsonUtil.GSON.toJson(incoming));
    }
}