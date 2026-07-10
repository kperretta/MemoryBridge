package com.memorybridge.servlet;

import com.memorybridge.data.DataStore;
import com.memorybridge.model.User;
import com.memorybridge.util.JsonUtil;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.*;

import java.io.IOException;
import java.util.Map;

@WebServlet("/api/register")
public class RegisterServlet extends HttpServlet {

    @Override
    protected void doPost(HttpServletRequest req, HttpServletResponse resp) throws IOException {
        resp.setContentType("application/json");
        resp.setCharacterEncoding("UTF-8");

        Map<String, String> body = JsonUtil.GSON.fromJson(req.getReader(), Map.class);
        String firstName = body.get("firstName");
        String lastName = body.get("lastName");
        String email = body.get("email");
        String password = body.get("password");
        String familyCode = body.getOrDefault("familyCode", "");
        String inviteCode = body.getOrDefault("inviteCode", "");

        // Validazioni base
        if (firstName == null || lastName == null || email == null || password == null
                || firstName.isBlank() || email.isBlank() || password.isBlank()) {
            resp.setStatus(HttpServletResponse.SC_BAD_REQUEST);
            resp.getWriter().write("{\"error\":\"Compila tutti i campi obbligatori\"}");
            return;
        }

        if (DataStore.get().findUserByEmail(email) != null) {
            resp.setStatus(HttpServletResponse.SC_CONFLICT);
            resp.getWriter().write("{\"error\":\"Email già registrata\"}");
            return;
        }

        // Se è stato fornito un inviteCode, ricavo il familyCode dal DB
        if (!inviteCode.isBlank()) {
            String fromInvite = DataStore.get().familyCodeForInvite(inviteCode);
            if (fromInvite == null) {
                resp.setStatus(HttpServletResponse.SC_BAD_REQUEST);
                resp.getWriter().write("{\"error\":\"Codice invito non valido\"}");
                return;
            }
            familyCode = fromInvite;
        }

        if (familyCode.isBlank()) {
            resp.setStatus(HttpServletResponse.SC_BAD_REQUEST);
            resp.getWriter().write("{\"error\":\"Serve un codice famiglia o un codice invito\"}");
            return;
        }

        User u = new User(firstName, lastName, email, password, familyCode);
        DataStore.get().addUser(u);

        // Login automatico
        HttpSession session = req.getSession(true);
        session.setAttribute("userId", u.getId());
        session.setAttribute("familyCode", u.getFamilyCode());

        resp.getWriter().write(JsonUtil.GSON.toJson(u.toSafeCopy()));
    }
}
