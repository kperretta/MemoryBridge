package com.memorybridge.model;

import java.time.LocalDateTime;

/**
 * Un ricordo: può essere una storia raccontata, una foto, un audio, un video.
 * È associato a un membro dell'albero (taggedPersonId) e ha un autore (authorId).
 */
public class Memory {
    private Long id;
    private Long authorId;         // User che ha creato il ricordo
    private Long taggedPersonId;   // FamilyMember a cui il ricordo si riferisce
    private String type;           // "text", "audio", "photo", "video"
    private String title;
    private String content;        // testo del ricordo o path/URL del media
    private String description;    // didascalia
    private String eventDate;      // data del fatto ricordato (opzionale, "yyyy-MM-dd")
    private LocalDateTime createdAt;
    private String familyCode;

    public Memory() {}

    public Memory(Long authorId, Long taggedPersonId, String type,
                  String title, String content, String description,
                  String familyCode) {
        this.authorId = authorId;
        this.taggedPersonId = taggedPersonId;
        this.type = type;
        this.title = title;
        this.content = content;
        this.description = description;
        this.createdAt = LocalDateTime.now();
        this.familyCode = familyCode;
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getAuthorId() { return authorId; }
    public void setAuthorId(Long authorId) { this.authorId = authorId; }

    public Long getTaggedPersonId() { return taggedPersonId; }
    public void setTaggedPersonId(Long taggedPersonId) { this.taggedPersonId = taggedPersonId; }

    public String getType() { return type; }
    public void setType(String type) { this.type = type; }

    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }

    public String getContent() { return content; }
    public void setContent(String content) { this.content = content; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public String getEventDate() { return eventDate; }
    public void setEventDate(String eventDate) { this.eventDate = eventDate; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }

    public String getFamilyCode() { return familyCode; }
    public void setFamilyCode(String familyCode) { this.familyCode = familyCode; }
}
