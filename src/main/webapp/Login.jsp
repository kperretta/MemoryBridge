<%@ page import="java.util.List" %>
<%@ page contentType="text/html;charset=UTF-8" language="java" %>


<!DOCTYPE html>
<html lang="it">
<head>
    <link rel="icon" type="image/svg+xml" href="${pageContext.request.contextPath}/images/ciak.svg">
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Login | Ciak!</title>
    <style>
        *, *::before, *::after { box-sizing: border-box; }
        body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            background-color: #0b0e11;
            color: #e4e6eb;
            margin: 0;
            padding: 20px 40px;
        }

        .title-group h1 {
            margin: 0;
            font-size: 2.5rem;
            text-transform: uppercase;
            letter-spacing: 2px;
            background: linear-gradient(90deg, #f093fb 0%, #f5576c 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }

        .login-container {
            max-width: 480px;
            margin: 0 auto;
            background-color: #151a23;
            border: 1px solid #2a3241;
            border-radius: 20px;
            padding: 40px;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
        }

        .logo {
            display: flex;
            justify-content: center;
            align-items: center;
            margin-bottom: 25px;
        }

        .logo img { max-width: 100%; height: auto; }

        .error-box {
            background-color: rgba(245, 87, 108, 0.15);
            border: 1px solid #f5576c;
            color: #f5576c;
            padding: 15px 20px;
            border-radius: 12px;
            margin-bottom: 25px;
            font-weight: 600;
        }

        .error-box ul { margin: 0; padding-left: 20px; }

        .login-container h2 {
            text-align: center;
            margin-bottom: 30px;
            font-size: 1.8rem;
            color: #fff;
        }

        .form-group { margin-bottom: 20px; }
        .form-group label {
            display: block;
            margin-bottom: 8px;
            font-weight: 600;
            color: #8b92a8;
        }

        .form-input {
            width: 100%;
            background-color: #0b0e11;
            border: 1px solid #2a3241;
            border-radius: 50px;
            padding: 12px 20px;
            color: white;
            font-size: 1rem;
            outline: none;
            transition: all 0.3s ease;
        }

        .form-input::placeholder {
            color: #5a6b8c;
            font-style: italic;
        }

        .form-input:focus {
            border-color: #f093fb;
            box-shadow: 0 0 20px rgba(240, 147, 251, 0.2);
            transform: scale(1.02);
        }

        .toggle-password {
            position: absolute;
            right: 18px;
            top: 50%;
            transform: translateY(-50%);
            cursor: pointer;
            font-size: 1.1rem;
            color: #8b92a8;
            user-select: none;
            transition: color 0.3s ease;
        }
        .toggle-password:hover { color: #f093fb; }

        .btn-submit {
            width: 100%;
            background-color: transparent;
            border: 1px solid #f093fb;
            color: #f093fb;
            padding: 14px;
            border-radius: 50px;
            cursor: pointer;
            font-weight: 700;
            font-size: 1rem;
            transition: all 0.3s;
            text-transform: uppercase;
            letter-spacing: 1px;
        }

        .btn-submit:hover {
            background: linear-gradient(90deg, #f093fb 0%, #f5576c 100%);
            border-color: transparent;
            color: white;
            box-shadow: 0 0 15px rgba(240, 147, 251, 0.4);
        }

        .register-link {
            text-align: center;
            margin-top: 25px;
            color: #8b92a8;
        }

        .register-link a {
            color: #f093fb;
            text-decoration: none;
            font-weight: 600;
        }

        .register-link a:hover { text-decoration: underline; }

        @media (max-width: 768px) { body { padding: 20px; } }
    </style>
</head>
<body>
<jsp:include page="/jsp/Header.jsp" />
<div class="login-container">

    <div class="logo">
        <img src="${pageContext.request.contextPath}/images/ciak.svg" alt="Logo Ciak!" width="300" height="300">
    </div>

    <h2>Accedi al tuo account</h2>

    <%-- Errore --%>
    <%
        String errore = (String) request.getAttribute("errore");
        if (errore != null) {
    %>
    <div class="error-box">
        <%= errore %>
    </div>
    <%
        }
    %>

    <%-- Messaggio di successo dopo la registrazione --%>
    <%
        Boolean successo = (Boolean) request.getAttribute("successo");
        if (successo != null && successo) {
    %>
    <div class="error-box" style="background-color: rgba(0, 200, 83, 0.15); border-color: #00c853; color: #00c853;">
        Registrazione completata! Accedi per continuare.
    </div>
    <%
        }
    %>

    <form action="<%=request.getContextPath()%>/LoginServlet" method="POST">
        <div class="form-group">
            <label for="email">Email</label>
            <input type="text"
                   id="email"
                   name="email"
                   value="<%= request.getAttribute("email") != null ? request.getAttribute("email") : "" %>"
                   class="form-input"
                   placeholder="Inserisci E-mail"
                   required>
        </div>

        <div class="form-group password-group" style="position: relative;">
            <label for="password">Password</label>
            <input type="password"
                   id="password"
                   name="password"
                   class="form-input"
                   placeholder="••••••••"
                   required>
            <label style="display: block; margin-top: 5px; font-weight: normal; color: #8b92a8;">
                <input type="checkbox" id="showPassword" onclick="togglePassword('password', this)"> Mostra password
            </label>
        </div>

        <button type="submit" class="btn-submit">Accedi</button>
    </form>

    <div class="register-link">
        Non hai un account? <a href="<%=request.getContextPath()%>/RegistrazioneServlet">Registrati</a>
    </div>
</div>

<script>
    function togglePassword(inputId, checkbox) {
        const input = document.getElementById(inputId);
        input.type = checkbox.checked ? "text" : "password";
    }
</script>

</body>
</html>

