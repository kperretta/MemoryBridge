package controller;

import jakarta.servlet.ServletException;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.HttpServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;

import model.UtenteRegistrato;

import java.io.IOException;
import java.sql.SQLException;

@WebServlet("/LoginServlet")
public class LoginServlet extends HttpServlet {

    @Override
    protected void doGet(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {
        request.getRequestDispatcher("/jsp/Login.jsp").forward(request, response);
    }

    @Override
    protected void doPost(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {

        String email = request.getParameter("email");
        String password = request.getParameter("password");

        // validazione input
        if (email == null || email.isBlank() || password == null || password.isBlank()) {
            request.setAttribute("errore", "Email e password sono obbligatorie.");
            request.getRequestDispatcher("/jsp/Login.jsp").forward(request, response);
            return;
        }

        try {

            UtenteRegistrato utente = login(email, password);

            if (utente != null) {
                // login riuscito, creo sessione
                HttpSession session = request.getSession();
                session.setAttribute("utente", utente);
                response.sendRedirect(request.getContextPath() + "/CatalogoServlet");
            } else {
                // credenziali errate
                request.setAttribute("errore", "Email o password non valide.");
                request.getRequestDispatcher("/jsp/Login.jsp").forward(request, response);
            }

        } catch (SQLException e) {
            // problema lato DB
            e.printStackTrace();
            request.setAttribute("errore", "Attualmente il servizio non è disponibile. Riprova più tardi.");
            request.getRequestDispatcher("/jsp/Login.jsp").forward(request, response);

        } catch (Exception e) {
            // qualsiasi altro errore
            e.printStackTrace();
            request.setAttribute("errore", "Si è verificato un problema. Riprova più tardi.");
            request.getRequestDispatcher("/jsp/Login.jsp").forward(request, response);
        }
    }
}
