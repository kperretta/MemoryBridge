package com.memorybridge.servlet;

import com.google.gson.JsonSyntaxException;
import com.memorybridge.data.DataStore;
import com.memorybridge.model.FamilyMember;
import com.memorybridge.model.User;
import com.memorybridge.util.JsonUtil;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.*;

import java.io.IOException;
import java.util.Map;
import java.util.Random;
import java.util.regex.Pattern;

@WebServlet("/api/register")
public class RegisterServlet extends HttpServlet {

    private static final Random RANDOM = new Random();

    // Regex di validazione (allineati al frontend)
    private static final Pattern NAME_REGEX   = Pattern.compile("^\\p{L}[\\p{L} '\\-]*\\p{L}$");
    private static final Pattern EMAIL_REGEX  = Pattern.compile("^[^\\s@]+@[^\\s@]+\\.[^\\s@]{2,}$");
    private static final Pattern CODE_REGEX   = Pattern.compile("^[A-Z0-9]{4,20}$");
    private static final Pattern INVITE_REGEX = Pattern.compile("^[A-Z0-9]{4,16}$");

    // Limiti
    private static final int NAME_MIN = 2,  NAME_MAX = 50;
    private static final int EMAIL_MAX = 254;
    private static final int PWD_MIN = 8,   PWD_MAX = 128;
    private static final int FAMILY_NAME_MIN = 2, FAMILY_NAME_MAX = 40;

    @Override
    protected void doPost(HttpServletRequest req, HttpServletResponse resp) throws IOException {
        resp.setContentType("application/json");
        resp.setCharacterEncoding("UTF-8");

        // ---------- Parsing sicuro del body ----------
        Map<String, Object> body;
        try {
            body = JsonUtil.GSON.fromJson(req.getReader(), Map.class);
            if (body == null) throw new JsonSyntaxException("Empty body");
        } catch (JsonSyntaxException e) {
            writeError(resp, HttpServletResponse.SC_BAD_REQUEST, "Richiesta non valida");
            return;
        }

        // ---------- Estrazione + normalizzazione ----------
        String firstName     = str(body.get("firstName")).trim();
        String lastName      = str(body.get("lastName")).trim();
        String email         = str(body.get("email")).trim().toLowerCase();
        String password      = str(body.get("password"));           // NON fare trim: rispetta la password
        String choice        = str(body.get("choice")).trim().toLowerCase();
        String inviteCode    = str(body.get("inviteCode")).trim().toUpperCase();
        String familyCode    = str(body.get("familyCode")).trim().toUpperCase();
        String newFamilyName = str(body.get("newFamilyName")).trim();

        // ---------- Validazione nome ----------
        if (firstName.length() < NAME_MIN || firstName.length() > NAME_MAX
                || !NAME_REGEX.matcher(firstName).matches()) {
            writeError(resp, HttpServletResponse.SC_BAD_REQUEST, "Nome non valido");
            return;
        }
        if (lastName.length() < NAME_MIN || lastName.length() > NAME_MAX
                || !NAME_REGEX.matcher(lastName).matches()) {
            writeError(resp, HttpServletResponse.SC_BAD_REQUEST, "Cognome non valido");
            return;
        }

        // ---------- Validazione email ----------
        if (email.isEmpty() || email.length() > EMAIL_MAX || !EMAIL_REGEX.matcher(email).matches()) {
            writeError(resp, HttpServletResponse.SC_BAD_REQUEST, "Email non valida");
            return;
        }

        // ---------- Validazione password ----------
        if (password.length() < PWD_MIN || password.length() > PWD_MAX
                || !password.matches(".*[A-Za-z].*") || !password.matches(".*\\d.*")) {
            writeError(resp, HttpServletResponse.SC_BAD_REQUEST,
                    "La password deve avere almeno 8 caratteri, con lettere e numeri e si consiglia un simbolo speciale");
            return;
        }

        // ---------- Email già registrata ----------
        if (DataStore.get().findUserByEmail(email) != null) {
            writeError(resp, HttpServletResponse.SC_CONFLICT, "Email già registrata");
            return;
        }

        // ---------- Validazione + risoluzione scelta nucleo familiare ----------
        boolean isNewFamily = false;
        String resolvedFamilyCode;

        switch (choice) {
            case "invite": {
                if (!INVITE_REGEX.matcher(inviteCode).matches()) {
                    writeError(resp, HttpServletResponse.SC_BAD_REQUEST, "Codice invito non valido");
                    return;
                }
                String fromInvite = DataStore.get().familyCodeForInvite(inviteCode);
                if (fromInvite == null) {
                    writeError(resp, HttpServletResponse.SC_BAD_REQUEST, "Codice invito non valido o già utilizzato");
                    return;
                }
                resolvedFamilyCode = fromInvite;
                break;
            }
            case "existing": {
                if (!CODE_REGEX.matcher(familyCode).matches()) {
                    writeError(resp, HttpServletResponse.SC_BAD_REQUEST, "Codice famiglia non valido");
                    return;
                }
                if (!DataStore.get().familyCodeExists(familyCode)) {
                    writeError(resp, HttpServletResponse.SC_BAD_REQUEST, "Codice famiglia non trovato");
                    return;
                }
                resolvedFamilyCode = familyCode;
                break;
            }
            case "new": {
                if (newFamilyName.length() < FAMILY_NAME_MIN
                        || newFamilyName.length() > FAMILY_NAME_MAX) {
                    writeError(resp, HttpServletResponse.SC_BAD_REQUEST,
                            "Nome del nucleo familiare non valido (2-40 caratteri)");
                    return;
                }
                resolvedFamilyCode = generateFamilyCode(newFamilyName);
                isNewFamily = true;
                break;
            }
            default:
                writeError(resp, HttpServletResponse.SC_BAD_REQUEST,
                        "Scegli un codice invito, un codice famiglia esistente, oppure crea un nuovo nucleo");
                return;
        }

        // ---------- Creazione utente ----------
        // NOTA: il costruttore di User dovrebbe fare l'hashing (BCrypt) della password.
        // Se non lo fa, aggiungerlo lì e MAI salvare la password in chiaro.
        User u = new User(firstName, lastName, email, password, resolvedFamilyCode);
        DataStore.get().addUser(u);

        if (isNewFamily) {
            FamilyMember self = new FamilyMember();
            self.setFirstName(firstName);
            self.setLastName(lastName);
            self.setFamilyCode(resolvedFamilyCode);
            self.setUserId(u.getId());
            DataStore.get().addFamilyMember(self);

            // Collega il FamilyMember appena creato all'User, così toSafeCopy()
            // restituisce familyMemberId e la navbar può linkare il profilo.
            u.setFamilyMemberId(self.getId());
        }

        // ---------- Login automatico ----------
        HttpSession session = req.getSession(true);
        session.setAttribute("userId", u.getId());
        session.setAttribute("familyCode", u.getFamilyCode());

        resp.getWriter().write(JsonUtil.GSON.toJson(Map.of(
                "user", u.toSafeCopy(),
                "isNewFamily", isNewFamily
        )));
    }

    // ---------- Helpers ----------

    /** Estrazione null-safe di una stringa da un Map<String, Object>. */
    private static String str(Object o) {
        return o == null ? "" : o.toString();
    }

    /** Scrive una risposta di errore JSON con lo status HTTP indicato. */
    private static void writeError(HttpServletResponse resp, int status, String message) throws IOException {
        resp.setStatus(status);
        // Escaping minimale delle virgolette per evitare JSON malformato
        String safe = message.replace("\\", "\\\\").replace("\"", "\\\"");
        resp.getWriter().write("{\"error\":\"" + safe + "\"}");
    }

    /**
     * Genera un familyCode univoco a partire dal nome scelto dall'utente
     * (es. "Famiglia Rossi" -> "ROSSI4821").
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