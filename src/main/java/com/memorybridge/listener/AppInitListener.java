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
                "Il nonno Andrea aveva una piccola bottega da falegname, e ogni volta che ci entravo " +
                        "provavo una sensazione di calma che non ho mai più ritrovato altrove. Da bambino " +
                        "potevo restare per ore semplicemente ad ascoltarlo lavorare, senza bisogno di " +
                        "parole, sentendomi al sicuro nel ritmo lento e paziente dei suoi gesti. Gli piaceva " +
                        "raccontare che l'odore della segatura appena tagliata era il profumo più bello del " +
                        "mondo, e lo diceva sempre con lo stesso entusiasmo, come se fosse la prima volta " +
                        "che me lo confidava. Non alzava mai la voce, nemmeno quando io sbagliavo o " +
                        "rompevo qualche attrezzo, e questo mi faceva sentire libero di sbagliare senza " +
                        "paura di deluderlo, cosa rara per un bambino di quei tempi. Ogni tanto smetteva di " +
                        "lavorare solo per farmi toccare il legno appena levigato, spiegandomi con una " +
                        "pazienza infinita ogni dettaglio, come se anche il legno avesse qualcosa da " +
                        "insegnarmi. Ancora oggi, quando sento quell'odore, mi torna in gola un groppo di " +
                        "nostalgia improvvisa, e per un attimo mi sento di nuovo bambino, protetto e " +
                        "ascoltato. Non ho mai capito se fosse più bravo a costruire sedie o a farmi " +
                        "sentire al sicuro, ma per lui credo fossero la stessa identica arte.",
                "Racconto tramandato da mio padre.", FC);
        m1.setEventDate("1955-01-01");
        attachMedia(db, "/demo-media/andrea-bottega.jpg", "image/jpeg").ifPresent(m1::setMediaId);
        db.addMemory(m1);

        Memory m2 = new Memory(uMaria.getId(), maria.getId(), "text",
                "Il primo giorno di scuola",
                "Nel 1971 mia madre mi accompagnò a scuola per il primo giorno, tenendomi la mano così " +
                        "stretta che sembrava avesse più paura lei di me. Ricordo soprattutto la sensazione " +
                        "di quella mano, il calore che mi dava sicurezza, e il rumore dei miei passi che nel " +
                        "silenzio del corridoio mi sembravano enormi, quasi assordanti, in mezzo a genitori " +
                        "e bambini altrettanto impauriti. Piangevo, non tanto per la paura della scuola in " +
                        "sé, quanto per il distacco improvviso da lei, per quella mano che sapevo si sarebbe " +
                        "staccata dalla mia da un momento all'altro. Ma la maestra mi si avvicinò e mi parlò " +
                        "piano, con una voce calda, come se avesse tutto il tempo del mondo solo per me, " +
                        "ignorando la fila di altri bambini che aspettavano. Mi chiese come mi chiamavo, e " +
                        "in pochi minuti quella sensazione di smarrimento si era già un po' sciolta. Quando " +
                        "mi voltai, mia madre non c'era più, ma stranamente non piangevo più nemmeno io. Da " +
                        "quel giorno ho sempre pensato che le cose più spaventose, affrontate con la persona " +
                        "giusta accanto anche solo per pochi minuti, diventano quasi sopportabili, e forse è " +
                        "per questo che ancora oggi, davanti a una nuova sfida, cerco sempre uno sguardo " +
                        "gentile a cui aggrapparmi.",
                "Un ricordo d'infanzia.", FC);
        m2.setEventDate("1971-10-01");
        attachMedia(db, "/demo-media/maria-primo-giorno.jpg", "image/jpeg").ifPresent(m2::setMediaId);
        db.addMemory(m2);

        Memory m3 = new Memory(uSofia.getId(), maria.getId(), "text",
                "La ricetta della nonna",
                "Nonna Maria mi ha insegnato a fare gli agnolotti in un pomeriggio d'inverno, con le mani " +
                        "infarinate e una sensazione di calore e complicità che raramente ho provato " +
                        "altrove. Mi ha raccontato che quella ricetta viene dalla sua bisnonna, tramandata " +
                        "di madre in figlia senza mai essere scritta da nessuna parte fino a quel giorno, e " +
                        "mentre parlava le si illuminava lo sguardo, come se stesse rivivendo ricordi che " +
                        "nemmeno lei sapeva di avere ancora così vividi. Mi ha guidato passo dopo passo, con " +
                        "una pazienza infinita, correggendomi ogni volta con dolcezza invece che con fretta. " +
                        "Ho sbagliato quasi tutti i primi impasti, ma lei rideva di gusto e diceva che anche " +
                        "sua nonna le aveva fatto lo stesso discorso da bambina, che gli errori fanno parte " +
                        "della ricetta tanto quanto la farina. Ho scritto ogni singolo passaggio, con tutte " +
                        "le sue imprecisioni e i suoi 'quanto basta', non solo per non dimenticare la " +
                        "ricetta in sé, ma per non perdere quella sensazione calda di appartenenza, quella " +
                        "certezza di essere parte di qualcosa che viene da molto lontano e che, grazie a " +
                        "lei, non finirà con noi.",
                "Domenica in cucina con la nonna.", FC);
        m3.setEventDate("2024-12-15");
        attachMedia(db, "/demo-media/maria-agnolotti.jpg", "image/jpeg").ifPresent(m3::setMediaId);
        db.addMemory(m3);

        Memory m4 = new Memory(uPaolo.getId(), giuseppe.getId(), "text",
                "Le partite di pesca con zio Giuseppe",
                "Ogni estate zio Giuseppe ci portava a pescare all'alba, e non prendevamo quasi mai " +
                        "niente, cosa che lui sapeva benissimo fin dall'inizio, ma ci teneva lo stesso a " +
                        "svegliarci prima del sole, come se il pesce fosse solo una scusa elaborata per " +
                        "stare insieme qualche ora lontano da tutto. Parlava poco, zio Giuseppe, preferiva " +
                        "restare in silenzio, ma quei silenzi condivisi valevano più di mille discorsi, ed " +
                        "erano proprio quei momenti a farci sentire davvero ascoltati, senza bisogno di " +
                        "parole. Quando qualche pesciolino abboccava era una festa vera, con lui che rideva " +
                        "e ci abbracciava come se avessimo vinto chissà cosa. Tornavamo sempre felici, con " +
                        "la certezza, anche da bambini, che quei momenti sarebbero rimasti con noi molto " +
                        "più a lungo di qualsiasi pesce che avremmo mai potuto portare a casa. Quello che mi " +
                        "manca di più non è il mare, ma quella sensazione di essere semplicemente lì con " +
                        "lui, senza fretta, senza aspettative, solo presenti l'uno per l'altro.",
                "Ricordo d'infanzia condiviso con Davide.", FC);
        m4.setEventDate("1980-07-15");
        attachMedia(db, "/demo-media/giuseppe-pesca.jpg", "image/jpeg").ifPresent(m4::setMediaId);
        db.addMemory(m4);

        // Ricordo di tipo "photo": qui il campo mediaId punta all'immagine vera,
        // mentre content racconta l'emozione dietro la foto (non la descrive semplicemente).
        Memory m5 = new Memory(uChiara.getId(), angelica.getId(), "photo",
                "Nonna Angelica in classe",
                "Nonna Angelica ci raccontava sempre con orgoglio del suo primo anno da maestra, di " +
                        "quanto fosse terrorizzata la mattina del primo giorno, e di come quella paura si " +
                        "fosse sciolta non appena aveva sentito la curiosità e la fiducia dei suoi alunni " +
                        "verso di lei. Diceva che insegnare non era semplicemente un lavoro, ma una " +
                        "promessa che si rinnovava ogni singola mattina: quella di credere in ogni bambino " +
                        "anche quando lui stesso non ci credeva ancora, di trovare la pazienza anche nei " +
                        "giorni più difficili, di non arrendersi mai davanti a chi sembrava irrecuperabile. " +
                        "Per anni ha conservato tutte le letterine che i suoi alunni le scrivevano a fine " +
                        "anno, e ogni volta che gliele rileggevamo insieme si commuoveva come se fosse la " +
                        "prima volta, ricordando il nome di ognuno di loro con una precisione sorprendente. " +
                        "Diceva sempre che di tutte le cose che aveva fatto nella vita, quella era l'unica " +
                        "di cui non si era mai pentita nemmeno per un secondo.",
                "Un ricordo che la nonna raccontava spesso, con la voce che tremava un po' ogni volta.", FC);
        m5.setEventDate("1968-10-05");
        attachMedia(db, "/demo-media/angelica-classe.jpg", "image/jpeg").ifPresent(m5::setMediaId);
        db.addMemory(m5);

        Memory m7 = new Memory(uSofia.getId(), marco.getId(), "text",
                "Imparare ad andare in bicicletta",
                "Papà mi teneva la sella e correva accanto a me, ripetendomi di continuare a pedalare e " +
                        "di non pensare a cadere, con il fiatone e la voce spezzata dalla corsa ma sempre " +
                        "incoraggiante. Sentivo il suo respiro affannato dietro di me, la sua presenza che " +
                        "ogni tanto sembrava allontanarsi per una frazione di secondo e poi tornava subito, " +
                        "come per rassicurarmi che c'era ancora, che non ero davvero sola anche quando lo " +
                        "sembrava. Ricordo la paura mista all'euforia di sentire la bicicletta traballare " +
                        "sotto di me a ogni curva, quella sensazione di equilibrio precario che sembrava " +
                        "poter cedere da un momento all'altro. La prima volta che mi ha davvero lasciata " +
                        "andare da sola non me ne sono nemmeno accorta: continuavo a pedalare convinta che " +
                        "fosse ancora lì a tenermi, finché non ho sentito la sua voce sempre più lontana " +
                        "gridare di gioia. In quel momento ho capito che quella era la sensazione più bella " +
                        "del mondo: farcela da sola, e sentire qualcuno orgoglioso di te proprio nel " +
                        "momento in cui hai smesso di aver bisogno del suo aiuto.",
                "Un pomeriggio di primavera al parco.", FC);
        m7.setEventDate("2014-04-12");
        attachMedia(db, "/demo-media/sofia-bicicletta.jpg", "image/jpeg").ifPresent(m7::setMediaId);
        db.addMemory(m7);

        Memory m8 = new Memory(uPaolo.getId(), davide.getId(), "text",
                "Le estati a Napoli con il cugino Davide",
                "Passavamo intere giornate insieme, io e Davide, con un pallone consumato e le ginocchia " +
                        "sempre sbucciate, senza mai stancarci l'uno dell'altro. Giocavamo finché non si " +
                        "faceva buio e le nostre madri ci richiamavano a casa, e ogni volta promettevamo " +
                        "che l'ultima partita sarebbe stata davvero l'ultima, salvo poi ricominciare subito " +
                        "dopo per 'un altro gol, solo uno'. Non avevamo niente di speciale da fare, nessun " +
                        "programma, nessuna meta, eppure quelle giornate mi sembrano oggi tra le più piene " +
                        "della mia vita: piene di risate senza motivo, di litigi finti dimenticati un " +
                        "attimo dopo, di un'amicizia che si costruiva un calcio al pallone alla volta, " +
                        "senza che nessuno dei due se ne accorgesse davvero. Quello che ricordo con più " +
                        "affetto non sono i luoghi in cui giocavamo, ma la sensazione di leggerezza e " +
                        "complicità che provavo ogni volta che ero con lui.",
                "Ricordi condivisi con mio cugino.", FC);
        m8.setEventDate("1985-08-01");
        attachMedia(db, "/demo-media/paolo-davide-napoli.jpg", "image/jpeg").ifPresent(m8::setMediaId);
        db.addMemory(m8);

        Memory m9 = new Memory(uChiara.getId(), elena.getId(), "text",
                "Il primo giorno di lavoro di zia Elena",
                "Zia Elena racconta sempre di quanto fosse nervosa il primo giorno in ospedale, con le " +
                        "mani che le tremavano così tanto da farle temere di non riuscire nemmeno a " +
                        "mettersi i guanti. Ci descrive ancora oggi quella sensazione di essere " +
                        "completamente inadeguata di fronte a tutto quello che non sapeva ancora fare, il " +
                        "cuore che le batteva forte e la voce che le si strozzava in gola ogni volta che " +
                        "qualcuno le rivolgeva la parola. Diceva che continuava a ripetersi mentalmente " +
                        "ogni procedura studiata sui libri, terrorizzata all'idea di dimenticare qualcosa " +
                        "di fondamentale proprio nel momento sbagliato. Poi racconta di un'infermiera più " +
                        "anziana che, senza dire quasi nulla, le ha messo in mano una tazza di caffè caldo " +
                        "e le ha detto solo: \"Anche io tremavo, il primo giorno. Passa.\" Non le diede " +
                        "consigli, non le spiegò nulla di tecnico: si sedette accanto a lei in silenzio, " +
                        "lasciandole solo il tempo di riprendere fiato. Zia Elena dice che quella tazza di " +
                        "caffè, e quei minuti di silenzio condiviso, le hanno insegnato più cose sulla " +
                        "gentilezza di qualsiasi corso di formazione, e che ancora oggi, quando vede una " +
                        "nuova collega spaventata, cerca di essere per lei quello che quella donna fu per " +
                        "lei tanti anni fa.",
                "Raccontato da zia Elena durante una cena di famiglia.", FC);
        m9.setEventDate("1995-02-10");
        db.addMemory(m9);

        Memory m10 = new Memory(uMarco.getId(), luigi.getId(), "text",
                "Il trasloco a Salerno",
                "Nonno Luigi raccontava spesso del giorno in cui arrivò a Salerno con una valigia di " +
                        "cartone legata con lo spago e la speranza di trovare lavoro nei cantieri navali. " +
                        "Diceva di essere arrivato senza conoscere nessuno in città, con l'indirizzo di un " +
                        "lontano parente scritto su un pezzetto di carta che teneva stretto come fosse un " +
                        "tesoro, rileggendolo ogni pochi minuti per paura di averlo perso. Ricordava " +
                        "soprattutto la sensazione di solitudine mista a determinazione di quei primi " +
                        "giorni, la paura di non farcela e insieme la voglia disperata di dimostrare a se " +
                        "stesso che ce l'avrebbe fatta. Ci raccontava del sollievo quando finalmente trovò " +
                        "lavoro e poté mandare i primi soldi a casa, e di quanto gli mancasse Napoli anche " +
                        "quando il mare che aveva davanti era altrettanto bello, come se nessun altro posto " +
                        "potesse mai davvero sostituire quello in cui era cresciuto. Diceva sempre che i " +
                        "primi mesi erano stati i più duri della sua vita, ma anche quelli che gli avevano " +
                        "insegnato di più su cosa significasse davvero cavarsela da soli. Ogni volta che " +
                        "raccontava questa storia gli si inumidivano gli occhi, la voce si faceva più bassa, " +
                        "e capivamo che quella valigia non conteneva solo vestiti, ma tutta la sua " +
                        "giovinezza, le sue paure e il coraggio che non sapeva ancora di avere.",
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

        sce.getServletContext().log("Memory Bridge: dati demo caricati (16 membri, 5 account, 9 ricordi). " +
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