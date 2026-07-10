package com.memorybridge.model;

/**
 * Utente registrato che può accedere all'app.
 * NOTA: la password qui è salvata in chiaro perché stiamo simulando il DB.
 * In un sistema reale userei BCrypt.
 */
public class User {
    private Long id;
    private String firstName;
    private String lastName;
    private String email;
    private String password;
    private String familyCode;      // codice del nucleo familiare
    private String avatarUrl;
    private Long familyMemberId;    // eventuale collegamento al nodo dell'albero
    private Long mediaId;           // foto profilo utente

    public User() {}

    public User(String firstName, String lastName, String email,
                String password, String familyCode) {
        this.firstName = firstName;
        this.lastName = lastName;
        this.email = email;
        this.password = password;
        this.familyCode = familyCode;
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getFirstName() { return firstName; }
    public void setFirstName(String firstName) { this.firstName = firstName; }

    public String getLastName() { return lastName; }
    public void setLastName(String lastName) { this.lastName = lastName; }

    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }

    public String getPassword() { return password; }
    public void setPassword(String password) { this.password = password; }

    public String getFamilyCode() { return familyCode; }
    public void setFamilyCode(String familyCode) { this.familyCode = familyCode; }

    public String getAvatarUrl() { return avatarUrl; }
    public void setAvatarUrl(String avatarUrl) { this.avatarUrl = avatarUrl; }

    public Long getFamilyMemberId() { return familyMemberId; }
    public void setFamilyMemberId(Long familyMemberId) { this.familyMemberId = familyMemberId; }

    public Long getMediaId() { return mediaId; }
    public void setMediaId(Long mediaId) { this.mediaId = mediaId; }

    public String getFullName() { return firstName + " " + lastName; }

    public User toSafeCopy() {
        User copy = new User();
        copy.id = this.id;
        copy.firstName = this.firstName;
        copy.lastName = this.lastName;
        copy.email = this.email;
        copy.password = null;              // esclusa
        copy.familyCode = this.familyCode;
        copy.avatarUrl = this.avatarUrl;
        copy.familyMemberId = this.familyMemberId;
        copy.mediaId = this.mediaId;
        return copy;
    }
}
