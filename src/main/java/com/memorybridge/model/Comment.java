package com.memorybridge.model;

import java.time.LocalDateTime;

public class Comment {
    private Long id;
    private Long memoryId;
    private Long authorId;
    private String text;
    private LocalDateTime createdAt;

    public Comment() {}

    public Comment(Long memoryId, Long authorId, String text) {
        this.memoryId = memoryId;
        this.authorId = authorId;
        this.text = text;
        this.createdAt = LocalDateTime.now();
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getMemoryId() { return memoryId; }
    public void setMemoryId(Long memoryId) { this.memoryId = memoryId; }

    public Long getAuthorId() { return authorId; }
    public void setAuthorId(Long authorId) { this.authorId = authorId; }

    public String getText() { return text; }
    public void setText(String text) { this.text = text; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
