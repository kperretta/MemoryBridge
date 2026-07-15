package com.memorybridge.servlet;

import com.memorybridge.data.DataStore;
import com.memorybridge.model.FamilyMember;
import com.memorybridge.model.User;
import com.memorybridge.util.JsonUtil;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.*;

import java.io.IOException;
import java.util.Map;
import java.util.Random;

@WebServlet("/api/register")
public class RegisterServlet extends HttpServlet {

    private static final Random RANDOM = new Random();

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
        String newFamilyName = body.getOrDefault("newFamilyName", "");

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

        boolean isNewFamily = false;

        // Se è stato fornito un inviteCode, ricavo il familyCode dal DB
        if (!inviteCode.isBlank()) {
            String fromInvite = DataStore.get().familyCodeForInvite(inviteCode);
            if (fromInvite == null) {
                resp.setStatus(HttpServletResponse.SC_BAD_REQUEST);
                resp.getWriter().write("{\"error\":\"Codice invito non valido\"}");
                return;
            }
            familyCode = fromInvite;

            // Nessun invito e nessun codice famiglia esistente: l'utente vuole
            // creare un nuovo nucleo familiare da zero.
        } else if (familyCode.isBlank() && !newFamilyName.isBlank()) {
            familyCode = generateFamilyCode(newFamilyName);
            isNewFamily = true;

            // Codice famiglia esistente inserito a mano: verifico che esista
            // davvero, altrimenti l'utente finirebbe in un nucleo "fantasma".
        } else if (!familyCode.isBlank()) {
            if (!DataStore.get().familyCodeExists(familyCode)) {
                resp.setStatus(HttpServletResponse.SC_BAD_REQUEST);
                resp.getWriter().write("{\"error\":\"Codice famiglia non trovato\"}");
                return;
            }
        }

        if (familyCode.isBlank()) {
            resp.setStatus(HttpServletResponse.SC_BAD_REQUEST);
            resp.getWriter().write("{\"error\":\"Scegli un codice invito, un codice famiglia esistente, oppure crea un nuovo nucleo familiare\"}");
            return;
        }

        User u = new User(firstName, lastName, email, password, familyCode);
        DataStore.get().addUser(u);

        // Chi crea un nuovo nucleo familiare diventa automaticamente il
        // primo (e per ora unico) nodo del proprio albero genealogico.
        if (isNewFamily) {
            FamilyMember self = new FamilyMember();
            self.setFirstName(firstName);
            self.setLastName(lastName);
            self.setFamilyCode(familyCode);
            self.setUserId(u.getId());
            DataStore.get().addFamilyMember(self);
        }

        // Login automatico
        HttpSession session = req.getSession(true);
        session.setAttribute("userId", u.getId());
        session.setAttribute("familyCode", u.getFamilyCode());

        resp.getWriter().write(JsonUtil.GSON.toJson(Map.of(
                "user", u.toSafeCopy(),
                "isNewFamily", isNewFamily
        )));
    }

    /**
     * Genera un familyCode univoco a partire dal nome scelto dall'utente
     * per il nuovo nucleo (es. "Famiglia Rossi" -> "ROSSI4821"), garantendo
     * che non collida con codici già esistenti.
     */
    private String generateFamilyCode(String baseName) {
        String base = baseName.toUpperCase().replaceAll("[^A-Z0-9]", "");
        if (base.isBlank()) base = "FAM";
        if (base.length() > 12) base = base.substring(0, 12);

        String code;
        int attempts = 0;
        do {
            int suffix = 1000 + RANDOM.nextInt(9000);
            code = base + suffix;
            attempts++;
        } while (DataStore.get().familyCodeExists(code) && attempts < 20);

        return code;
    }
}