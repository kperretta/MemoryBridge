package com.memorybridge.servlet;

import com.memorybridge.data.DataStore;
import com.memorybridge.model.User;
import com.memorybridge.util.JsonUtil;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.*;
import jakarta.servlet.http.Cookie;

import java.io.IOException;

@WebServlet("/api/me")
public class MeServlet extends HttpServlet {

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

        Long userId = (Long) session.getAttribute("userId");
        User u = DataStore.get().findUser(userId);
        if (u == null) {
            session.invalidate();
            resp.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
            resp.getWriter().write("{\"error\":\"Utente non trovato\"}");
            return;
        }

        resp.getWriter().write(JsonUtil.GSON.toJson(u.toSafeCopy()));
    }

    @Override
    protected void doPost(HttpServletRequest req, HttpServletResponse resp) throws IOException {
        // logout: distrugge la sessione E cancella il cookie
        HttpSession session = req.getSession(false);
        if (session != null) session.invalidate();

        // Cancella esplicitamente il cookie JSESSIONID lato browser
        Cookie killCookie = new Cookie("JSESSIONID", "");
        killCookie.setPath(req.getContextPath().isEmpty() ? "/" : req.getContextPath());
        killCookie.setMaxAge(0);
        killCookie.setHttpOnly(true);
        resp.addCookie(killCookie);

        resp.setStatus(HttpServletResponse.SC_NO_CONTENT);
    }
}
