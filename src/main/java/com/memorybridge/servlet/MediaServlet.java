package com.memorybridge.servlet;

import com.memorybridge.data.DataStore;
import com.memorybridge.model.MediaFile;
import jakarta.servlet.ServletException;
import jakarta.servlet.annotation.MultipartConfig;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.*;

import java.io.IOException;

/**
 * Gestisce upload e download dei file media (foto, audio, video).
 *
 *   POST /api/media   (multipart/form-data con campo "file")
 *                     -> salva il file in memoria, ritorna {"id": N}
 *
 *   GET  /api/media?id=N
 *                     -> restituisce direttamente i byte del file con
 *                        il content-type corretto (usabile in <img>, <audio>, <video>)
 *
 * NOTA: i file sono tenuti in RAM (nel DataStore). Non c'e' persistenza
 * su disco: al riavvio di Tomcat scompaiono con tutti gli altri dati.
 */
@WebServlet("/api/media")
@MultipartConfig(
        fileSizeThreshold = 1024 * 1024,           // 1MB threshold in memory
        maxFileSize      = 20L * 1024 * 1024,      // 20MB max per file (audio lunghi ok)
        maxRequestSize   = 25L * 1024 * 1024
)
public class MediaServlet extends HttpServlet {

    @Override
    protected void doGet(HttpServletRequest req, HttpServletResponse resp) throws IOException {
        String idParam = req.getParameter("id");
        if (idParam == null) {
            resp.setStatus(HttpServletResponse.SC_BAD_REQUEST);
            return;
        }

        MediaFile file;
        try {
            file = DataStore.get().findMedia(Long.parseLong(idParam));
        } catch (NumberFormatException e) {
            resp.setStatus(HttpServletResponse.SC_BAD_REQUEST);
            return;
        }

        if (file == null || file.getData() == null) {
            resp.setStatus(HttpServletResponse.SC_NOT_FOUND);
            return;
        }

        resp.setContentType(file.getContentType() != null ? file.getContentType() : "application/octet-stream");
        resp.setContentLength(file.getData().length);
        // Cache aggressivo perche' i file sono immutabili una volta creati
        resp.setHeader("Cache-Control", "public, max-age=31536000, immutable");
        resp.getOutputStream().write(file.getData());
    }

    @Override
    protected void doPost(HttpServletRequest req, HttpServletResponse resp)
            throws IOException, ServletException {

        resp.setContentType("application/json");
        resp.setCharacterEncoding("UTF-8");

        HttpSession session = req.getSession(false);
        if (session == null || session.getAttribute("userId") == null) {
            resp.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
            resp.getWriter().write("{\"error\":\"Non autenticato\"}");
            return;
        }

        Part filePart = req.getPart("file");
        if (filePart == null || filePart.getSize() == 0) {
            resp.setStatus(HttpServletResponse.SC_BAD_REQUEST);
            resp.getWriter().write("{\"error\":\"File mancante\"}");
            return;
        }

        byte[] data = filePart.getInputStream().readAllBytes();
        String contentType = filePart.getContentType();
        if (contentType == null || contentType.isBlank()) contentType = "application/octet-stream";

        MediaFile saved = DataStore.get().addMedia(data, contentType, filePart.getSubmittedFileName());

        // Rispondo con id e info di base
        resp.getWriter().write("{\"id\":" + saved.getId()
                + ",\"contentType\":\"" + saved.getContentType() + "\""
                + ",\"sizeBytes\":" + saved.getSizeBytes() + "}");
    }
}
