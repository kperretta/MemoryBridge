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
        return true;
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
    // memoryId -> (userId -> Like). La mappa interna per userId garantisce che un
    // utente non possa mettere like due volte allo stesso ricordo, e rende il
    // toggle/lookup O(1) senza dover scorrere una lista.
    private final Map<Long, Map<Long, Like>> likesByMemory = new ConcurrentHashMap<>();
    private final AtomicLong likeSeq = new AtomicLong(0);

    /**
     * Alterna il like di un utente su un ricordo: se non l'aveva ancora messo lo
     * aggiunge, se ce l'aveva lo toglie (comportamento "toggle" tipico dei social).
     *
     * @return true se dopo la chiamata il ricordo risulta "piaciuto" da quell'utente,
     *         false se il like è appena stato rimosso.
     */
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