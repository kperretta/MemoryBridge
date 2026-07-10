package com.memorybridge.listener;

import com.memorybridge.data.DataStore;
import com.memorybridge.model.*;
import jakarta.servlet.ServletContextEvent;
import jakarta.servlet.ServletContextListener;
import jakarta.servlet.annotation.WebListener;

import java.io.IOException;
import java.io.InputStream;

/**
 * Popola il DataStore con dati demo all'avvio del contesto web.
 *
 * Famiglia Rossi (codice ROSSI2025) — 4 generazioni:
 *
 *   Andrea Rossi (1921-1998) + Concetta Bruno (1924-2011)          bisnonni
 *     |-- Luigi Rossi (1943-2020) + Angelica Verdi (1945-)          nonni
 *     |     |-- Maria Rossi (1965-) [account]                       madre
 *     |     |     |-- Marco Rossi (1988-) [account] + Laura Neri (1987-)
 *     |     |     |     |-- Sofia Rossi (2008-) [account]
 *     |     |     |     |-- Leonardo Rossi (2011-)
 *     |     |     |-- Chiara Rossi (1991-) [account]
 *     |     |-- Paolo Rossi (1968-) [account] + Elena Costa (1970-)
 *     |           |-- Luca Rossi (1996-)
 *     |-- Giuseppe Rossi (1946-2019) + Lucia Ferrari (1948-)
 *           |-- Davide Rossi (1974-)
 *
 * Credenziali di test (tutte con password "password"):
 *   maria@test.it   marco@test.it   sofia@test.it
 *   paolo@test.it   chiara@test.it
 *
 * ================================================================
 * GESTIONE FOTO — come funziona in questo file
 * ================================================================
 * Ogni foto/audio demo va messa come risorsa nel CLASSPATH, cioè in:
 *
 *     src/main/resources/demo-media/andrea-rossi.jpg
 *
 * Con una build Maven/Gradle standard, questo file finisce compilato in
 * WEB-INF/classes/demo-media/andrea-rossi.jpg dentro il WAR, e a runtime è
 * leggibile con getClass().getResourceAsStream("/demo-media/andrea-rossi.jpg").
 *
 * CONVENZIONE NOMI FILE: "nome-cognome.jpg" (tutto minuscolo, trattino).
 * Usiamo nome+cognome (invece del solo nome) per evitare ambiguità quando
 * più persone nell'albero condividono lo stesso nome proprio — es.
 * "Lucia Ferrari" e un'eventuale futura "Lucia Rossi" non andrebbero mai
 * a collidere sullo stesso file "lucia.jpg". Se in futuro ci fosse
 * un'ambiguità anche su nome+cognome, si può aggiungere l'anno di nascita:
 * "lucia-ferrari-1948.jpg".
 *
 * Il metodo helper attachMedia(...) qui sotto:
 *   1) legge i byte del file dal classpath (se non esiste, logga un warning
 *      e ritorna Optional.empty() senza far fallire l'avvio — così puoi
 *      aggiungere le foto quando vuoi, una alla volta, senza rompere nulla),
 *   2) chiama db.addMedia(bytes, contentType, nomeFile) → ottiene un
 *      MediaFile con un id,
 *   3) ritorna quell'id, che poi assegni con .setMediaId(id) sull'entità
 *      giusta (FamilyMember, Memory o User — tutte e tre hanno già il campo).
 *
 * Basta creare la cartella src/main/resources/demo-media/ e buttarci dentro
 * i file con i nomi usati qui sotto: al prossimo riavvio del server (con
 * rebuild!) compaiono da sole.
 *
 * Per servirle al frontend c'è già /api/media?id=N (vedi MediaServlet).
 */
@WebListener
public class AppInitListener implements ServletContextListener {

    private static final String FC = "ROSSI2025";

    @Override
    public void contextInitialized(ServletContextEvent sce) {
        DataStore db = DataStore.get();

        // ================================================================
        // ALBERO GENEALOGICO
        // ================================================================

        // ---------- Generazione 1: bisnonni ----------
        FamilyMember andrea = db.addFamilyMember(new FamilyMember(
                "Andrea", "Rossi", "1921-03-12", "1998-11-18",
                "Cresciuto a Napoli in una famiglia di artigiani. Falegname per gran parte della sua vita.",
                "M", FC));
        andrea.setBirthPlace("Napoli");
        attachMedia(db, "/demo-media/andrea-rossi.jpg", "image/jpeg").ifPresent(andrea::setMediaId);

        FamilyMember concetta = db.addFamilyMember(new FamilyMember(
                "Concetta", "Bruno", "1924-02-08", "2011-04-02",
                "Sposata con Andrea nel 1941. Cresceva cinque figli e teneva un piccolo orto.",
                "F", FC));
        concetta.setBirthPlace("Napoli");
        concetta.setSpouseId(andrea.getId());
        andrea.setSpouseId(concetta.getId());
        attachMedia(db, "/demo-media/concetta-bruno.jpg", "image/jpeg").ifPresent(concetta::setMediaId);

        // ---------- Generazione 2: nonni ----------
        FamilyMember luigi = db.addFamilyMember(new FamilyMember(
                "Luigi", "Rossi", "1943-06-04", "2020-01-30",
                "Figlio di Andrea e Concetta. Emigrato a Salerno negli anni '60 per lavoro.",
                "M", FC));
        luigi.setFatherId(andrea.getId());
        luigi.setMotherId(concetta.getId());
        luigi.setBirthPlace("Napoli");
        attachMedia(db, "/demo-media/luigi-rossi.jpg", "image/jpeg").ifPresent(luigi::setMediaId);

        FamilyMember giuseppe = db.addFamilyMember(new FamilyMember(
                "Giuseppe", "Rossi", "1946-09-19", "2019-03-11",
                "Fratello minore di Luigi. Rimasto a Napoli, ha continuato la bottega del padre Andrea.",
                "M", FC));
        giuseppe.setFatherId(andrea.getId());
        giuseppe.setMotherId(concetta.getId());
        giuseppe.setBirthPlace("Napoli");
        attachMedia(db, "/demo-media/giuseppe-rossi.jpg", "image/jpeg").ifPresent(giuseppe::setMediaId);

        FamilyMember angelica = db.addFamilyMember(new FamilyMember(
                "Angelica", "Verdi", "1945-09-22", null,
                "Sposata con Luigi nel 1963. Insegnante alle scuole elementari.",
                "F", FC));
        angelica.setSpouseId(luigi.getId());
        angelica.setBirthPlace("Salerno");
        luigi.setSpouseId(angelica.getId());
        attachMedia(db, "/demo-media/angelica-verdi.jpg", "image/jpeg").ifPresent(angelica::setMediaId);

        FamilyMember lucia = db.addFamilyMember(new FamilyMember(
                "Lucia", "Ferrari", "1948-12-01", null,
                "Sposata con Giuseppe nel 1970. Sarta, ha lavorato per anni nel quartiere.",
                "F", FC));
        lucia.setSpouseId(giuseppe.getId());
        lucia.setBirthPlace("Napoli");
        giuseppe.setSpouseId(lucia.getId());
        attachMedia(db, "/demo-media/lucia-ferrari.jpg", "image/jpeg").ifPresent(lucia::setMediaId);

        // ---------- Generazione 3: genitori e zii ----------
        FamilyMember maria = db.addFamilyMember(new FamilyMember(
                "Maria", "Rossi", "1965-05-10", null,
                "Custode della memoria familiare. Vive a Salerno.",
                "F", FC));
        maria.setFatherId(luigi.getId());
        maria.setMotherId(angelica.getId());
        maria.setBirthPlace("Salerno");
        attachMedia(db, "/demo-media/maria-rossi.jpg", "image/jpeg").ifPresent(maria::setMediaId);

        FamilyMember paolo = db.addFamilyMember(new FamilyMember(
                "Paolo", "Rossi", "1968-11-27", null,
                "Fratello di Maria. Vive ancora a Salerno, appassionato di pesca.",
                "M", FC));
        paolo.setFatherId(luigi.getId());
        paolo.setMotherId(angelica.getId());
        paolo.setBirthPlace("Salerno");
        attachMedia(db, "/demo-media/paolo-rossi.jpg", "image/jpeg").ifPresent(paolo::setMediaId);

        FamilyMember elena = db.addFamilyMember(new FamilyMember(
                "Elena", "Costa", "1970-03-15", null,
                "Sposata con Paolo nel 1994. Infermiera.",
                "F", FC));
        elena.setSpouseId(paolo.getId());
        paolo.setSpouseId(elena.getId());
        elena.setBirthPlace("Salerno");
        attachMedia(db, "/demo-media/elena-costa.jpg", "image/jpeg").ifPresent(elena::setMediaId);

        FamilyMember davide = db.addFamilyMember(new FamilyMember(
                "Davide", "Rossi", "1974-08-09", null,
                "Figlio di Giuseppe e Lucia, cugino di Maria e Paolo. Vive a Napoli.",
                "M", FC));
        davide.setFatherId(giuseppe.getId());
        davide.setMotherId(lucia.getId());
        davide.setBirthPlace("Napoli");
        attachMedia(db, "/demo-media/davide-rossi.jpg", "image/jpeg").ifPresent(davide::setMediaId);

        // ---------- Generazione 4: figli ----------
        FamilyMember marco = db.addFamilyMember(new FamilyMember(
                "Marco", "Rossi", "1988-02-14", null,
                "Figlio di Maria. Vive a Roma, impiegato.",
                "M", FC));
        marco.setMotherId(maria.getId());
        marco.setBirthPlace("Salerno");
        attachMedia(db, "/demo-media/marco-rossi.jpg", "image/jpeg").ifPresent(marco::setMediaId);

        FamilyMember chiara = db.addFamilyMember(new FamilyMember(
                "Chiara", "Rossi", "1991-06-30", null,
                "Figlia di Maria, sorella di Marco. Vive a Salerno, fa la fisioterapista.",
                "F", FC));
        chiara.setMotherId(maria.getId());
        chiara.setBirthPlace("Salerno");
        attachMedia(db, "/demo-media/chiara-rossi.jpg", "image/jpeg").ifPresent(chiara::setMediaId);

        FamilyMember laura = db.addFamilyMember(new FamilyMember(
                "Laura", "Neri", "1987-04-22", null,
                "Sposata con Marco nel 2007. Grafica freelance.",
                "F", FC));
        laura.setSpouseId(marco.getId());
        marco.setSpouseId(laura.getId());
        laura.setBirthPlace("Roma");
        attachMedia(db, "/demo-media/laura-neri.jpg", "image/jpeg").ifPresent(laura::setMediaId);

        FamilyMember luca = db.addFamilyMember(new FamilyMember(
                "Luca", "Rossi", "1996-01-05", null,
                "Figlio di Paolo ed Elena, cugino di Marco e Chiara.",
                "M", FC));
        luca.setFatherId(paolo.getId());
        luca.setMotherId(elena.getId());
        luca.setBirthPlace("Salerno");
        attachMedia(db, "/demo-media/luca-rossi.jpg", "image/jpeg").ifPresent(luca::setMediaId);

        // ---------- Generazione 5: nipoti ----------
        FamilyMember sofia = db.addFamilyMember(new FamilyMember(
                "Sofia", "Rossi", "2008-07-03", null,
                "Figlia di Marco e Laura. Studentessa al liceo.",
                "F", FC));
        sofia.setFatherId(marco.getId());
        sofia.setMotherId(laura.getId());
        sofia.setBirthPlace("Roma");
        attachMedia(db, "/demo-media/sofia-rossi.jpg", "image/jpeg").ifPresent(sofia::setMediaId);

        FamilyMember leonardo = db.addFamilyMember(new FamilyMember(
                "Leonardo", "Rossi", "2011-10-19", null,
                "Figlio di Marco e Laura, fratello minore di Sofia.",
                "M", FC));
        leonardo.setFatherId(marco.getId());
        leonardo.setMotherId(laura.getId());
        leonardo.setBirthPlace("Roma");
        attachMedia(db, "/demo-media/leonardo-rossi.jpg", "image/jpeg").ifPresent(leonardo::setMediaId);

        // ---------- Persiste gli aggiornamenti sui nodi con relazioni impostate dopo la creazione ----------
        db.updateFamilyMember(andrea);
        db.updateFamilyMember(concetta);
        db.updateFamilyMember(luigi);
        db.updateFamilyMember(giuseppe);
        db.updateFamilyMember(angelica);
        db.updateFamilyMember(lucia);
        db.updateFamilyMember(maria);
        db.updateFamilyMember(paolo);
        db.updateFamilyMember(elena);
        db.updateFamilyMember(davide);
        db.updateFamilyMember(marco);
        db.updateFamilyMember(chiara);
        db.updateFamilyMember(laura);
        db.updateFamilyMember(luca);
        db.updateFamilyMember(sofia);
        db.updateFamilyMember(leonardo);

        // ================================================================
        // UTENTI (con eventuale foto profilo separata da quella del FamilyMember)
        // ================================================================
        User uMaria = new User("Maria", "Rossi", "maria@test.it", "password", FC);
        uMaria.setFamilyMemberId(maria.getId());
        attachMedia(db, "/demo-media/maria-rossi-avatar.jpg", "image/jpeg").ifPresent(uMaria::setMediaId);
        db.addUser(uMaria);

        User uMarco = new User("Marco", "Rossi", "marco@test.it", "password", FC);
        uMarco.setFamilyMemberId(marco.getId());
        attachMedia(db, "/demo-media/marco-rossi-avatar.jpg", "image/jpeg").ifPresent(uMarco::setMediaId);
        db.addUser(uMarco);

        User uSofia = new User("Sofia", "Rossi", "sofia@test.it", "password", FC);
        uSofia.setFamilyMemberId(sofia.getId());
        attachMedia(db, "/demo-media/sofia-rossi-avatar.jpg", "image/jpeg").ifPresent(uSofia::setMediaId);
        db.addUser(uSofia);

        User uPaolo = new User("Paolo", "Rossi", "paolo@test.it", "password", FC);
        uPaolo.setFamilyMemberId(paolo.getId());
        db.addUser(uPaolo);

        User uChiara = new User("Chiara", "Rossi", "chiara@test.it", "password", FC);
        uChiara.setFamilyMemberId(chiara.getId());
        db.addUser(uChiara);

        // ================================================================
        // RICORDI DEMO (post nel feed)
        // ================================================================
        Memory m1 = new Memory(uMarco.getId(), andrea.getId(), "text",
                "Il nonno falegname",
                "Il nonno Andrea aveva una piccola bottega nel centro storico di Napoli. " +
                        "Da bambino mi portava a vedere come costruiva le sedie: gli piaceva raccontare che " +
                        "l'olfatto del legno appena tagliato era il profumo più bello del mondo.",
                "Racconto tramandato da mio padre.", FC);
        m1.setEventDate("1955-01-01");
        attachMedia(db, "/demo-media/andrea-bottega.jpg", "image/jpeg").ifPresent(m1::setMediaId);
        db.addMemory(m1);

        Memory m2 = new Memory(uMaria.getId(), maria.getId(), "text",
                "Il primo giorno di scuola",
                "Nel 1971 mia madre mi accompagnò a scuola per il primo giorno. " +
                        "Mi ricordo il grembiule nero e il fiocco bianco. Piangevo, ma la maestra fu molto dolce.",
                "Un ricordo d'infanzia.", FC);
        m2.setEventDate("1971-10-01");
        attachMedia(db, "/demo-media/maria-primo-giorno.jpg", "image/jpeg").ifPresent(m2::setMediaId);
        db.addMemory(m2);

        Memory m3 = new Memory(uSofia.getId(), maria.getId(), "text",
                "La ricetta della nonna",
                "Nonna Maria mi ha insegnato a fare gli agnolotti. Dice che è la ricetta " +
                        "della sua bisnonna. Ho registrato tutti i passaggi per non dimenticarli.",
                "Domenica in cucina con la nonna.", FC);
        m3.setEventDate("2024-12-15");
        attachMedia(db, "/demo-media/maria-agnolotti.jpg", "image/jpeg").ifPresent(m3::setMediaId);
        db.addMemory(m3);

        Memory m4 = new Memory(uPaolo.getId(), giuseppe.getId(), "text",
                "Le partite di pesca con zio Giuseppe",
                "Ogni estate zio Giuseppe ci portava al molo a pescare all'alba. " +
                        "Non prendevamo quasi mai niente, ma tornavamo sempre felici.",
                "Ricordo d'infanzia condiviso con Davide.", FC);
        m4.setEventDate("1980-07-15");
        attachMedia(db, "/demo-media/giuseppe-pesca.jpg", "image/jpeg").ifPresent(m4::setMediaId);
        db.addMemory(m4);

        // Ricordo di tipo "photo": qui il campo mediaId punta all'immagine vera,
        // mentre content resta una didascalia/descrizione testuale.
        Memory m5 = new Memory(uChiara.getId(), angelica.getId(), "photo",
                "Nonna Angelica in classe",
                "Una foto che mostra nonna Angelica davanti alla sua classe di prima elementare, " +
                        "scattata durante il suo primo anno di insegnamento.",
                "Foto ritrovata in un vecchio album.", FC);
        m5.setEventDate("1968-10-05");
        attachMedia(db, "/demo-media/angelica-classe.jpg", "image/jpeg").ifPresent(m5::setMediaId);
        db.addMemory(m5);

        // Ricordo di tipo "audio": stesso meccanismo, con content-type audio.
        Memory m6 = new Memory(uMaria.getId(), concetta.getId(), "audio",
                "La voce di nonna Concetta",
                "Una breve registrazione in cui nonna Concetta racconta di quando, durante la guerra, " +
                        "nascose le provviste di famiglia in giardino.",
                "Registrazione fatta durante una visita a Napoli nel 2005.", FC);
        m6.setEventDate("2005-08-20");
        attachMedia(db, "/demo-media/concetta-voce.mp3", "audio/mpeg").ifPresent(m6::setMediaId);
        db.addMemory(m6);

        Memory m7 = new Memory(uSofia.getId(), marco.getId(), "text",
                "Imparare ad andare in bicicletta",
                "Papà mi teneva la sella e correva accanto a me lungo il parco. " +
                        "La prima volta che mi ha lasciata andare da sola non me ne sono nemmeno accorta.",
                "Un pomeriggio di primavera al parco.", FC);
        m7.setEventDate("2014-04-12");
        attachMedia(db, "/demo-media/sofia-bicicletta.jpg", "image/jpeg").ifPresent(m7::setMediaId);
        db.addMemory(m7);

        Memory m8 = new Memory(uPaolo.getId(), davide.getId(), "text",
                "Le estati a Napoli con il cugino Davide",
                "Passavamo intere giornate per le stradine del centro storico, giocando a pallone " +
                        "fino a quando non si accendevano i lampioni.",
                "Ricordi condivisi con mio cugino.", FC);
        m8.setEventDate("1985-08-01");
        attachMedia(db, "/demo-media/paolo-davide-napoli.jpg", "image/jpeg").ifPresent(m8::setMediaId);
        db.addMemory(m8);

        Memory m9 = new Memory(uChiara.getId(), elena.getId(), "text",
                "Il primo giorno di lavoro di zia Elena",
                "Zia Elena racconta sempre di quanto fosse nervosa il primo giorno in ospedale, " +
                        "e di come un'infermiera più anziana l'abbia rassicurata con una tazza di caffè.",
                "Raccontato da zia Elena durante una cena di famiglia.", FC);
        m9.setEventDate("1995-02-10");
        attachMedia(db, "/demo-media/elena-voce.mp3", "audio/mpeg").ifPresent(m9::setMediaId);
        db.addMemory(m9);

        Memory m10 = new Memory(uMarco.getId(), luigi.getId(), "text",
                "Il trasloco a Salerno",
                "Nonno Luigi raccontava spesso del giorno in cui arrivò a Salerno con una valigia " +
                        "e la speranza di trovare lavoro nei cantieri navali.",
                "Storia di famiglia tramandata oralmente.", FC);
        m10.setEventDate("1963-03-01");
        attachMedia(db, "/demo-media/luigi-trasloco.jpg", "image/jpeg").ifPresent(m10::setMediaId);
        db.addMemory(m10);

        // ================================================================
        // COMMENTI DEMO
        // ================================================================
        db.addComment(new Comment(m1.getId(), uMaria.getId(),
                "Che bello leggere queste parole. Anche io mi ricordo il profumo della bottega."));
        db.addComment(new Comment(m1.getId(), uSofia.getId(),
                "Non sapevo nulla del bisnonno, grazie per averlo raccontato!"));
        db.addComment(new Comment(m3.getId(), uMarco.getId(),
                "Bellissima domenica, ne rifaremo altre!"));
        db.addComment(new Comment(m4.getId(), uChiara.getId(),
                "Zio Giuseppe mi manca tantissimo, grazie per aver condiviso questo ricordo."));
        db.addComment(new Comment(m4.getId(), uMaria.getId(),
                "Anche a me ha insegnato a pescare, un'estate a Napoli!"));
        db.addComment(new Comment(m5.getId(), uMaria.getId(),
                "Che meraviglia questa foto, non l'avevo mai vista."));
        db.addComment(new Comment(m7.getId(), uMarco.getId(),
                "Me lo ricordo come fosse ieri, eri bravissima!"));
        db.addComment(new Comment(m8.getId(), uMaria.getId(),
                "Quanti ricordi, dovreste tornarci insieme un'estate."));
        db.addComment(new Comment(m10.getId(), uPaolo.getId(),
                "Papà ce lo raccontava sempre con gli occhi lucidi."));

        sce.getServletContext().log("Memory Bridge: dati demo caricati (16 membri, 5 account, 10 ricordi). " +
                "Login: maria@test.it, marco@test.it, sofia@test.it, paolo@test.it, chiara@test.it (password: 'password')");
    }

    /**
     * Legge un file dal classpath (es. src/main/resources/demo-media/foo.jpg) e,
     * se esiste, lo salva nel DataStore come MediaFile, ritornandone l'id.
     * Se il file non è presente logga un warning e ritorna Optional.empty()
     * senza lanciare eccezioni: così puoi aggiungere le immagini gradualmente
     * senza rompere l'avvio del server.
     */
    private java.util.Optional<Long> attachMedia(DataStore db, String classpathResource, String contentType) {
        try (InputStream in = getClass().getResourceAsStream(classpathResource)) {
            if (in == null) {
                logWarn("File non trovato nel classpath: " + classpathResource
                        + " (verifica che sia in src/main/resources" + classpathResource
                        + " e che il progetto sia stato ricompilato)");
                return java.util.Optional.empty();
            }
            byte[] bytes = in.readAllBytes();
            String fileName = classpathResource.substring(classpathResource.lastIndexOf('/') + 1);
            MediaFile media = db.addMedia(bytes, contentType, fileName);
            return java.util.Optional.of(media.getId());
        } catch (IOException e) {
            logWarn("Impossibile leggere " + classpathResource + ": " + e.getMessage());
            return java.util.Optional.empty();
        }
    }

    private void logWarn(String msg) {
        System.err.println("[AppInitListener] " + msg);
    }
}