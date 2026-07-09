package com.memorybridge.servlet;

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
 * POST /api/tree           → aggiungi nuovo membro (body JSON)
 * PUT  /api/tree           → modifica membro esistente (body JSON con id)
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

        FamilyMember incoming = JsonUtil.GSON.fromJson(req.getReader(), FamilyMember.class);
        incoming.setFamilyCode(familyCode);
        FamilyMember saved = DataStore.get().addFamilyMember(incoming);
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

        FamilyMember incoming = JsonUtil.GSON.fromJson(req.getReader(), FamilyMember.class);
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
