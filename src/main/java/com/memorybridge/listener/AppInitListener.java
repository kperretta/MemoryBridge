package com.memorybridge.listener;

import com.memorybridge.data.DataStore;
import com.memorybridge.model.*;
import jakarta.servlet.ServletContextEvent;
import jakarta.servlet.ServletContextListener;
import jakarta.servlet.annotation.WebListener;

/**
 * Popola il DataStore con dati demo all'avvio del contesto web.
 * Famiglia Rossi (codice ROSSI2025):
 *   - Andrea Rossi (bisnonno, 1921-1998)
 *   - Luigi Rossi (nonno, 1943-2020) + Angelica Verdi (nonna, 1945-)
 *   - Maria Rossi (madre, 1947-) [ha account]
 *   - Marco Rossi (figlio di Maria, 1975-) [ha account]
 *   - Sofia Rossi (figlia di Marco, 2008-) [ha account]
 *
 * Credenziali di test:
 *   maria@test.it / password
 *   marco@test.it / password
 *   sofia@test.it / password
 */
@WebListener
public class AppInitListener implements ServletContextListener {

    private static final String FC = "ROSSI2025";

    @Override
    public void contextInitialized(ServletContextEvent sce) {
        DataStore db = DataStore.get();

        // ---------- Albero genealogico ----------
        FamilyMember andrea = db.addFamilyMember(new FamilyMember(
                "Andrea", "Rossi", "1921-03-12", "1998-11-18",
                "Cresciuto a Napoli in una famiglia di artigiani. Falegname per gran parte della sua vita.",
                "M", FC));
        andrea.setBirthPlace("Napoli");

        FamilyMember luigi = db.addFamilyMember(new FamilyMember(
                "Luigi", "Rossi", "1943-06-04", "2020-01-30",
                "Figlio di Andrea. Emigrato a Salerno negli anni '60 per lavoro.",
                "M", FC));
        luigi.setFatherId(andrea.getId());
        luigi.setBirthPlace("Napoli");

        FamilyMember angelica = db.addFamilyMember(new FamilyMember(
                "Angelica", "Verdi", "1945-09-22", null,
                "Sposata con Luigi nel 1965. Insegnante alle scuole elementari.",
                "F", FC));
        angelica.setSpouseId(luigi.getId());
        angelica.setBirthPlace("Salerno");
        luigi.setSpouseId(angelica.getId());

        FamilyMember maria = db.addFamilyMember(new FamilyMember(
                "Maria", "Rossi", "1947-05-10", null,
                "Custode della memoria familiare. Vive a Salerno.",
                "F", FC));
        maria.setFatherId(luigi.getId());
        maria.setMotherId(angelica.getId());
        maria.setBirthPlace("Salerno");

        FamilyMember marco = db.addFamilyMember(new FamilyMember(
                "Marco", "Rossi", "1975-02-14", null,
                "Figlio di Maria. Vive a Roma, impiegato.",
                "M", FC));
        marco.setMotherId(maria.getId());
        marco.setBirthPlace("Salerno");

        FamilyMember sofia = db.addFamilyMember(new FamilyMember(
                "Sofia", "Rossi", "2008-07-03", null,
                "Figlia di Marco. Studentessa al liceo.",
                "F", FC));
        sofia.setFatherId(marco.getId());
        sofia.setBirthPlace("Roma");

        // Aggiorna gli update sui nodi che hanno cambiato relazione
        db.updateFamilyMember(luigi);
        db.updateFamilyMember(angelica);
        db.updateFamilyMember(maria);
        db.updateFamilyMember(marco);
        db.updateFamilyMember(sofia);

        // ---------- Utenti ----------
        User uMaria = new User("Maria", "Rossi", "maria@test.it", "password", FC);
        uMaria.setFamilyMemberId(maria.getId());
        db.addUser(uMaria);

        User uMarco = new User("Marco", "Rossi", "marco@test.it", "password", FC);
        uMarco.setFamilyMemberId(marco.getId());
        db.addUser(uMarco);

        User uSofia = new User("Sofia", "Rossi", "sofia@test.it", "password", FC);
        uSofia.setFamilyMemberId(sofia.getId());
        db.addUser(uSofia);

        // ---------- Ricordi demo ----------
        Memory m1 = new Memory(uMarco.getId(), andrea.getId(), "text",
                "Il nonno falegname",
                "Il nonno Andrea aveva una piccola bottega nel centro storico di Napoli. " +
                        "Da bambino mi portava a vedere come costruiva le sedie: gli piaceva raccontare che " +
                        "l'olfatto del legno appena tagliato era il profumo più bello del mondo.",
                "Racconto tramandato da mio padre.", FC);
        m1.setEventDate("1955-01-01");
        db.addMemory(m1);

        Memory m2 = new Memory(uMaria.getId(), maria.getId(), "text",
                "Il primo giorno di scuola",
                "Nel 1953 mia madre mi accompagnò a scuola per il primo giorno. " +
                        "Mi ricordo il grembiule nero e il fiocco bianco. Piangevo, ma la maestra fu molto dolce.",
                "Un ricordo d'infanzia.", FC);
        m2.setEventDate("1953-10-01");
        db.addMemory(m2);

        Memory m3 = new Memory(uSofia.getId(), sofia.getId(), "text",
                "La ricetta della nonna",
                "Nonna Maria mi ha insegnato a fare gli agnolotti. Dice che è la ricetta " +
                        "della sua bisnonna. Ho registrato tutti i passaggi per non dimenticarli.",
                "Domenica in cucina con la nonna.", FC);
        m3.setEventDate("2024-12-15");
        db.addMemory(m3);

        // ---------- Commenti demo ----------
        db.addComment(new Comment(m1.getId(), uMaria.getId(),
                "Che bello leggere queste parole. Anche io mi ricordo il profumo della bottega."));
        db.addComment(new Comment(m1.getId(), uSofia.getId(),
                "Non sapevo nulla del bisnonno, grazie per averlo raccontato!"));
        db.addComment(new Comment(m3.getId(), uMarco.getId(),
                "Bellissima domenica, ne rifaremo altre!"));

        sce.getServletContext().log("Memory Bridge: dati demo caricati. " +
                "Login con maria@test.it / marco@test.it / sofia@test.it (password: 'password')");
    }
}
