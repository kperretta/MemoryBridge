package com.memorybridge.model;

/**
 * Rappresenta un file media (immagine, audio, video) salvato in memoria.
 * I byte del file sono tenuti direttamente in RAM come nel resto del DB simulato.
 * NOTA: il campo data non deve mai essere serializzato in JSON (troppo grande);
 * il frontend accede al file via /api/media?id=X che restituisce direttamente i byte.
 */
public class MediaFile {
    private Long id;
    private transient byte[] data;   // transient = Gson non lo serializza
    private String contentType;      // es. "image/jpeg", "audio/webm"
    private String originalName;
    private int sizeBytes;

    public MediaFile() {}

    public MediaFile(byte[] data, String contentType, String originalName) {
        this.data = data;
        this.contentType = contentType;
        this.originalName = originalName;
        this.sizeBytes = data != null ? data.length : 0;
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public byte[] getData() { return data; }
    public void setData(byte[] data) { this.data = data; this.sizeBytes = data != null ? data.length : 0; }

    public String getContentType() { return contentType; }
    public void setContentType(String contentType) { this.contentType = contentType; }

    public String getOriginalName() { return originalName; }
    public void setOriginalName(String originalName) { this.originalName = originalName; }

    public int getSizeBytes() { return sizeBytes; }
    public void setSizeBytes(int sizeBytes) { this.sizeBytes = sizeBytes; }
}
