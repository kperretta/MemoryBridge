package com.memorybridge.model;

/**
 * Nodo dell'albero genealogico. Un FamilyMember può o meno corrispondere
 * a un User registrato.
 * Le relazioni sono modellate con motherId, fatherId, spouseId.
 *
 * Un FamilyMember può anche essere un nodo "fantasma": un'ancora interna,
 * creata automaticamente quando si aggiunge un fratello/sorella a qualcuno
 * di cui non sono ancora stati registrati i genitori.
 */
public class FamilyMember {
    private Long id;
    private String firstName;
    private String lastName;
    private String birthDate;      // formato ISO "yyyy-MM-dd"
    private String deathDate;      // null se vivente
    private String birthPlace;
    private String description;
    private String photoUrl;
    private String gender;         // "M" o "F"
    private Long motherId;
    private Long fatherId;
    private Long spouseId;
    private String familyCode;     // a quale famiglia appartiene
    private Long mediaId;          // foto profilo del membro
    private Long userId;           // se questo nodo corrisponde a un User registrato, il suo id
    private boolean phantom = false; // Nodo fantasma (genitore "ancora" per fratelli orfani)
    private Long phantomForId;     // id del membro "reale" per cui è stato creato la prima volta

    public FamilyMember() {}

    public FamilyMember(String firstName, String lastName, String birthDate,
                        String deathDate, String description, String gender,
                        String familyCode) {
        this.firstName = firstName;
        this.lastName = lastName;
        this.birthDate = birthDate;
        this.deathDate = deathDate;
        this.description = description;
        this.gender = gender;
        this.familyCode = familyCode;
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getFirstName() { return firstName; }
    public void setFirstName(String firstName) { this.firstName = firstName; }

    public String getLastName() { return lastName; }
    public void setLastName(String lastName) { this.lastName = lastName; }

    public String getBirthDate() { return birthDate; }
    public void setBirthDate(String birthDate) { this.birthDate = birthDate; }

    public String getDeathDate() { return deathDate; }
    public void setDeathDate(String deathDate) { this.deathDate = deathDate; }

    public String getBirthPlace() { return birthPlace; }
    public void setBirthPlace(String birthPlace) { this.birthPlace = birthPlace; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public String getPhotoUrl() { return photoUrl; }
    public void setPhotoUrl(String photoUrl) { this.photoUrl = photoUrl; }

    public String getGender() { return gender; }
    public void setGender(String gender) { this.gender = gender; }

    public Long getMotherId() { return motherId; }
    public void setMotherId(Long motherId) { this.motherId = motherId; }

    public Long getFatherId() { return fatherId; }
    public void setFatherId(Long fatherId) { this.fatherId = fatherId; }

    public Long getSpouseId() { return spouseId; }
    public void setSpouseId(Long spouseId) { this.spouseId = spouseId; }

    public String getFamilyCode() { return familyCode; }
    public void setFamilyCode(String familyCode) { this.familyCode = familyCode; }

    public Long getMediaId() { return mediaId; }
    public void setMediaId(Long mediaId) { this.mediaId = mediaId; }

    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }

    public boolean isPhantom() { return phantom; }
    public void setPhantom(boolean phantom) { this.phantom = phantom; }

    public Long getPhantomForId() { return phantomForId; }
    public void setPhantomForId(Long phantomForId) { this.phantomForId = phantomForId; }

    public String getFullName() { return firstName + " " + lastName; }
}