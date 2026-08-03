# LESSONS.md

Dokumentierte Probleme, Entscheidungen und "nicht wieder ändern"-Hinweise. Vor Arbeit an einem verwandten Bereich hier nachsehen; nach Abschluss nicht-offensichtliche Erkenntnisse ergänzen (kurz: Problem → Lösung → Warum).

---

**Datenminimierung: Teilnehmertoken in sessionStorage, nicht localStorage**

Problem: Naheliegend wäre, das Teilnehmertoken in `localStorage` zu speichern, damit ein Schüler nach hartem Schließen der PWA (OS killt den Prozess) wieder dieselbe Tierfigur/Identität bekommt.

Entscheidung: Bewusst nicht gemacht. Schulkontext — es sollen so wenig Daten wie möglich dauerhaft auf Schülergeräten liegen. Eine neue Tierfigur nach komplettem Tab-/App-Schluss ist akzeptierter Trade-off.

Nicht wieder ändern ohne explizite Rückfrage beim Nutzer.

---

**Reconnect-Duplikat-Fix (v4.1.3): "21 Teilnehmer bei 19 Schülern"**

Problem: Bei Reconnect im selben Tab wurde teils ein neuer Teilnehmer statt derselben Identität angelegt → mehr Teilnehmer als tatsächlich anwesende Schüler.

Lösung: Das Teilnehmertoken bleibt für die gesamte Raum-Sitzung in `sessionStorage` (`pendingJoin` wird beim Rundenstart nicht mehr geräumt) → Reconnect im selben Tab nutzt dieselbe Identität weiter.

Bewusst weiterhin offen: Wenn das OS die PWA hart beendet (sessionStorage geht verloren), entsteht ein neuer Teilnehmer. Der naheliegende Fix wäre `localStorage` — wurde wegen der Datenminimierungs-Entscheidung oben nicht gemacht.

---

<!-- Neue Einträge unten anfügen: kurzer Titel, dann Problem / Lösung / Warum-nicht-anders. -->
