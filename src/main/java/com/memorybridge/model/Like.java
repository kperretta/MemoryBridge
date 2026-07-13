package com.memorybridge.model;


import java.time.LocalDateTime;

/**
 * Un "mi piace" di un utente su un ricordo. Un utente può mettere like
 * a un ricordo una sola volta (il toggle in DataStore lo garantisce).
 */
public class Like {
    private Long id;
    private Long memoryId;
    private Long userId;
    private LocalDateTime createdAt;

    public Like() {}

    public Like(Long memoryId, Long userId) {
        this.memoryId = memoryId;
        this.userId = userId;
        this.createdAt = LocalDateTime.now();
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getMemoryId() { return memoryId; }
    public void setMemoryId(Long memoryId) { this.memoryId = memoryId; }

    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}