package com.memorybridge.servlet;

import com.memorybridge.data.DataStore;
import com.memorybridge.model.User;
import com.memorybridge.util.JsonUtil;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.*;

import java.io.IOException;
import java.util.Map;

@WebServlet("/api/login")
public class LoginServlet extends HttpServlet {

    @Override
    protected void doPost(HttpServletRequest req, HttpServletResponse resp) throws IOException {
        resp.setContentType("application/json");
        resp.setCharacterEncoding("UTF-8");

        // Legge il body: {email, password}
        Map<String, String> body = JsonUtil.GSON.fromJson(req.getReader(), Map.class);
        String email = body.get("email");
        String password = body.get("password");

        User u = DataStore.get().findUserByEmail(email);
        if (u == null || !u.getPassword().equals(password)) {
            resp.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
            resp.getWriter().write("{\"error\":\"Credenziali non valide\"}");
            return;
        }

        // Salvo l'id in sessione
        HttpSession session = req.getSession(true);
        session.setAttribute("userId", u.getId());
        session.setAttribute("familyCode", u.getFamilyCode());

        // Non ritorno la password
        u.setPassword(null);
        resp.getWriter().write(JsonUtil.GSON.toJson(u));
    }
}
