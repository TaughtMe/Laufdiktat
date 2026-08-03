# CLAUDE.md

Kurze Arbeitsgrundlage für KI-Agenten (Claude Code, Codex, etc.) in diesem Repo. Details zu Stack/Struktur stehen in [README.md](README.md) — hier nur die Regeln, die sonst in jedem Chat neu erklärt werden müssten.

## Projekt

Laufdiktat: React 19 + TypeScript + Vite PWA für Schulklassen (Wörter/Sätze abschreiben, Battle-Modus, Stationen, Mathe-Modus). Lehrkraft-Dashboard + Schülergeräte, Live-Sync über Supabase Realtime Broadcast (keine DB-Tabellen für Live-Daten).

## Grundprinzipien

1. **Datenminimierung ist bewusstes Designziel, kein Zufall.** Teilnehmer-Tokens liegen in `sessionStorage`, nicht `localStorage`. Schlägt eine Änderung persistente Speicherung auf Schülergeräten vor (localStorage, Cookies, IndexedDB) — nicht einfach umsetzen, sondern nachfragen. Siehe `LESSONS.md`.
2. **Minimale Diffs.** Nur die für die Aufgabe nötigen Dateien ändern. Keine Refactorings, Umbenennungen oder Aufräumarbeiten "nebenbei", auch wenn sie sinnvoll erscheinen — dafür extra fragen.
3. **Bestehende Architektur respektieren.** Seiten (`pages/*.tsx`) bleiben dünn; Logik gehört in Hooks (`hooks/`) und reine, getestete Utility-Funktionen (`utils/`). Neue Logik entsprechend einsortieren statt in Komponenten zu mischen.
4. **Keine neuen Dependencies ohne Rückfrage.** Bestehende Lösungen (Tailwind-Utilities, native Browser-APIs) bevorzugen, bevor eine neue Library vorgeschlagen wird.
5. **Risiken vor größeren Eingriffen benennen.** Bei Änderungen, die mehrere Module oder die Live-Sync-Logik betreffen, kurz sagen was brechen könnte, bevor losgelegt wird.
6. **Self-Review nach größeren Änderungen.** Kurz auf Bugs, Seiteneffekte, Performance und unnötige Komplexität prüfen, bevor die Änderung als fertig gilt.
7. **`LESSONS.md` konsultieren.** Vor Arbeit an einem bekannten Problemfeld (Reconnect/Teilnehmer-Identität, Touch-Handling, Sync) dort nachsehen, ob es dazu schon eine dokumentierte Entscheidung gibt. Neue, nicht-offensichtliche Erkenntnisse dort ergänzen statt nur im Chat zu erwähnen.

## Tests

`npm test` (Vitest) vor Abschluss größerer Änderungen an `utils/` laufen lassen — dort liegt die getestete Logik.
