package com.memorybridge.data;

import com.memorybridge.model.*;

import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;

//Database simulato in memoria, Singleton thread-safe. I dati vengono persi al riavvio del server
public class DataStore {

    private static final DataStore INSTANCE = new DataStore();

    private final Map<Long, User> users = new ConcurrentHashMap<>();
    private final Map<Long, FamilyMember> familyMembers = new ConcurrentHashMap<>();
    private final Map<Long, Memory> memories = new ConcurrentHashMap<>();
    private final Map<Long, Comment> comments = new ConcurrentHashMap<>();
    private final Map<Long, MediaFile> media = new ConcurrentHashMap<>();

    // Codici di invito generati, mappati al familyCode a cui appartengono
    private final Map<String, String> inviteCodes = new ConcurrentHashMap<>();

    private final AtomicLong userSeq = new AtomicLong(0);
    private final AtomicLong familyMemberSeq = new AtomicLong(0);
    private final AtomicLong memorySeq = new AtomicLong(0);
    private final AtomicLong commentSeq = new AtomicLong(0);
    private final AtomicLong mediaSeq = new AtomicLong(0);

    private DataStore() {}
    public static DataStore get() { return INSTANCE; }

    // ==================== USERS ====================

    public User addUser(User u) {
        u.setId(userSeq.incrementAndGet());
        users.put(u.getId(), u);
        return u;
    }

    public User findUser(Long id) { return users.get(id); }

    public User findUserByEmail(String email) {
        return users.values().stream()
                .filter(u -> u.getEmail().equalsIgnoreCase(email))
                .findFirst().orElse(null);
    }

    public List<User> allUsers() {
        return new ArrayList<>(users.values());
    }

    public List<User> usersByFamily(String familyCode) {
        return users.values().stream()
                .filter(u -> familyCode.equals(u.getFamilyCode()))
                .toList();
    }

    /**
     * Verifica se un familyCode è già in uso, sia da utenti registrati sia
     * da membri dell'albero (es. un familiare aggiunto senza account).
     * Usato per evitare collisioni quando si genera un nuovo codice famiglia
     * e per validare un codice inserito a mano in registrazione.
     */
    public boolean familyCodeExists(String familyCode) {
        if (familyCode == null || familyCode.isBlank()) return false;
        boolean inUsers = users.values().stream()
                .anyMatch(u -> familyCode.equalsIgnoreCase(u.getFamilyCode()));
        if (inUsers) return true;
        return familyMembers.values().stream()
                .anyMatch(m -> familyCode.equalsIgnoreCase(m.getFamilyCode()));
    }

    // ==================== FAMILY MEMBERS ====================

    public FamilyMember addFamilyMember(FamilyMember m) {
        m.setId(familyMemberSeq.incrementAndGet());
        familyMembers.put(m.getId(), m);
        return m;
    }

    public FamilyMember findFamilyMember(Long id) { return familyMembers.get(id); }

    public List<FamilyMember> familyTree(String familyCode) {
        return familyMembers.values().stream()
                .filter(m -> familyCode.equals(m.getFamilyCode()))
                .sorted(Comparator.comparing(FamilyMember::getBirthDate,
                        Comparator.nullsLast(Comparator.naturalOrder())))
                .toList();
    }

    public boolean updateFamilyMember(FamilyMember updated) {
        if (updated.getId() == null || !familyMembers.containsKey(updated.getId())) return false;
        familyMembers.put(updated.getId(), updated);
        return true;
    }

    /** Elimina un membro e ripulisce i riferimenti (madre/padre/coniuge) negli altri nodi. */
    public boolean deleteFamilyMember(Long id) {
        if (id == null || familyMembers.remove(id) == null) return false;
        familyMembers.values().forEach(m -> {
            if (id.equals(m.getMotherId())) m.setMotherId(null);
            if (id.equals(m.getFatherId())) m.setFatherId(null);
            if (id.equals(m.getSpouseId())) m.setSpouseId(null);
        });
        cleanupOrphanPhantoms();
        return true;
    }

    // ---- Nodi fantasma (genitore-ancora per fratelli orfani) ----

    /**
     * Restituisce il fantasma già associato a memberId, se esiste, altrimenti
     * ne crea uno nuovo. Usato solo la prima volta che due fratelli senza
     * genitori registrati vengono collegati fra loro: le aggiunte successive
     * riusano semplicemente il fatherId (già valorizzato col fantasma) copiato
     * dal fratello target, senza richiamare questo metodo.
     */
    public FamilyMember getOrCreatePhantomParent(String familyCode, Long memberId) {
        return familyMembers.values().stream()
                .filter(m -> familyCode.equals(m.getFamilyCode())
                        && m.isPhantom()
                        && memberId.equals(m.getPhantomForId()))
                .findFirst()
                .orElseGet(() -> {
                    FamilyMember phantom = new FamilyMember();
                    phantom.setFamilyCode(familyCode);
                    phantom.setPhantom(true);
                    phantom.setPhantomForId(memberId);
                    phantom.setFirstName("_phantom_");
                    phantom.setLastName("");
                    return addFamilyMember(phantom);
                });
    }

    /**
     * Sostituisce integralmente un genitore fantasma con un genitore reale:
     * tutti i membri che avevano quel fantasma in motherId o fatherId vengono
     * aggiornati con realParentId, poi il fantasma viene eliminato.
     */
    public void replacePhantomParent(Long phantomId, Long realParentId) {
        if (phantomId == null) return;
        FamilyMember phantom = familyMembers.get(phantomId);
        if (phantom == null || !phantom.isPhantom()) return;

        familyMembers.values().forEach(m -> {
            if (phantomId.equals(m.getFatherId())) m.setFatherId(realParentId);
            if (phantomId.equals(m.getMotherId())) m.setMotherId(realParentId);
        });
        familyMembers.remove(phantomId);
    }

    /**
     * Propaga un genitore reale appena aggiunto (tipicamente la madre,
     * mentre il padre resta ancora un fantasma) a tutti i fratelli che
     * condividono lo stesso fantasma, assumendo che siano fratelli "pieni".
     * Il fantasma NON viene rimosso: resta come ancora per il genitore
     * ancora sconosciuto.
     */
    public void propagateNewParentToPhantomSiblings(Long phantomId, String field, Long realParentId) {
        if (phantomId == null) return;
        FamilyMember phantom = familyMembers.get(phantomId);
        if (phantom == null || !phantom.isPhantom()) return;

        familyMembers.values().forEach(m -> {
            boolean condividePhantom = phantomId.equals(m.getFatherId()) || phantomId.equals(m.getMotherId());
            if (!condividePhantom) return;
            if ("mother".equals(field)) {
                m.setMotherId(realParentId);
            } else {
                m.setFatherId(realParentId);
            }
        });
    }

    /** Rimuove i nodi fantasma che nessun figlio referenzia più (es. dopo eliminazioni). */
    private void cleanupOrphanPhantoms() {
        Set<Long> referenced = new HashSet<>();
        familyMembers.values().forEach(m -> {
            if (m.getMotherId() != null) referenced.add(m.getMotherId());
            if (m.getFatherId() != null) referenced.add(m.getFatherId());
        });
        familyMembers.values().removeIf(m -> m.isPhantom() && !referenced.contains(m.getId()));
    }

    // ==================== MEMORIES ====================

    public Memory addMemory(Memory m) {
        m.setId(memorySeq.incrementAndGet());
        memories.put(m.getId(), m);
        return m;
    }

    public Memory findMemory(Long id) { return memories.get(id); }

    public List<Memory> memoriesByFamily(String familyCode) {
        return memories.values().stream()
                .filter(m -> familyCode.equals(m.getFamilyCode()))
                .sorted(Comparator.comparing(Memory::getCreatedAt).reversed())
                .toList();
    }

    public List<Memory> memoriesByPerson(Long personId) {
        return memories.values().stream()
                .filter(m -> personId.equals(m.getTaggedPersonId()))
                .sorted(Comparator.comparing(Memory::getEventDate,
                        Comparator.nullsLast(Comparator.naturalOrder())))
                .toList();
    }

    // ==================== COMMENTS ====================

    public Comment addComment(Comment c) {
        c.setId(commentSeq.incrementAndGet());
        comments.put(c.getId(), c);
        return c;
    }

    public List<Comment> commentsByMemory(Long memoryId) {
        return comments.values().stream()
                .filter(c -> memoryId.equals(c.getMemoryId()))
                .sorted(Comparator.comparing(Comment::getCreatedAt))
                .toList();
    }

    // ==================== LIKES ====================
    private final Map<Long, Map<Long, Like>> likesByMemory = new ConcurrentHashMap<>();
    private final AtomicLong likeSeq = new AtomicLong(0);

    public boolean toggleLike(Long memoryId, Long userId) {
        if (memoryId == null || userId == null) return false;
        Map<Long, Like> forMemory = likesByMemory.computeIfAbsent(memoryId, k -> new ConcurrentHashMap<>());
        if (forMemory.remove(userId) != null) {
            return false; // era già piaciuto, ora tolto
        }
        Like like = new Like(memoryId, userId);
        like.setId(likeSeq.incrementAndGet());
        forMemory.put(userId, like);
        return true; // ora piaciuto
    }

    public int likeCount(Long memoryId) {
        if (memoryId == null) return 0;
        Map<Long, Like> forMemory = likesByMemory.get(memoryId);
        return forMemory == null ? 0 : forMemory.size();
    }

    public boolean hasLiked(Long memoryId, Long userId) {
        if (memoryId == null || userId == null) return false;
        Map<Long, Like> forMemory = likesByMemory.get(memoryId);
        return forMemory != null && forMemory.containsKey(userId);
    }

    /** Utile per un futuro "chi ha messo like a questo ricordo". */
    public List<Like> likersOf(Long memoryId) {
        Map<Long, Like> forMemory = likesByMemory.get(memoryId);
        return forMemory == null ? List.of() : new ArrayList<>(forMemory.values());
    }

    // ==================== INVITES ====================

    public String createInviteCode(String familyCode) {
        String code = UUID.randomUUID().toString().substring(0, 8).toUpperCase();
        inviteCodes.put(code, familyCode);
        return code;
    }

    public String familyCodeForInvite(String inviteCode) {
        return inviteCodes.get(inviteCode);
    }

    // ==================== MEDIA ====================

    public MediaFile addMedia(byte[] data, String contentType, String originalName) {
        MediaFile m = new MediaFile(data, contentType, originalName);
        m.setId(mediaSeq.incrementAndGet());
        media.put(m.getId(), m);
        return m;
    }

    public MediaFile findMedia(Long id) {
        return id == null ? null : media.get(id);
    }
}