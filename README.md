# Laufdiktat

Eine interaktive Web-App für das **Laufdiktat** im Unterricht: Schülerinnen und Schüler holen sich Wörter oder Sätze an einem Gerät ab, laufen zurück an ihren Platz und schreiben sie aus dem Gedächtnis. Die Lehrkraft steuert alles über ein Dashboard und sieht den Fortschritt der Klasse in Echtzeit.

Die App läuft als **PWA** (installierbar, offline-fähig) und ist als [Cloudflare Pages](https://pages.cloudflare.com/)-Seite deploybar. Es werden **keine Daten dauerhaft gespeichert** – die Live-Synchronisation läuft über flüchtige Supabase-Broadcasts (siehe [Datenschutz](#datenschutz)).

## Ablauf in Kürze

1. Die Lehrkraft öffnet das **Dashboard**, importiert eine Wortliste und öffnet einen Raum (4-stelliger Code oder QR-Code).
2. Die Schüler öffnen die Startseite, geben den Code ein (oder scannen den QR-Code) und wählen einen zufälligen Tiernamen.
3. Die Lehrkraft startet die Sitzung – die Wörter erscheinen auf den Schülergeräten.
4. Das Dashboard zeigt live, wer bei welchem Wort ist; am Ende gibt es Sterne/Punkte.

## Modi

| Modus | Beschreibung |
|-------|--------------|
| **Laufdiktat** | Klassisch: pro Wort/Satz einmal ansehen, dann abschreiben. |
| **Freies Üben** | Selbstlern-Modus mit gestufter Hilfe (Striche → einzelne Buchstaben / Wort-Fragmente) und einer Abtipp-Phase (grünes Karaoke-Mitlesen) ab einer einstellbaren Fehlerzahl. Optional mit Vorlesen. |
| **Battle Mode** | Spielerisch: pro getipptem Wort lädt sich ein Balken auf, mit dem man Mitschüler angreifen (Tinten-Klecks) oder sich per Schild schützen kann. Ranking über Live-Fortschritt. |
| **Stationen** | Ohne persönliche Geräte: mehrere „Stationen" mit Nummern, an denen sich die Kinder abwechselnd ein Wort abholen. Ein Spickenzähler erfasst wiederholtes Ansehen. |

Zusätzlich gibt es einen **Mathe-Modus** beim Import: Statt Wörtern werden Rechenaufgaben angezeigt (`4 + 4`), erwartet wird das Ergebnis (`8`). Generator für `+ − · :` (Division nur ganzzahlig) oder manuelle Eingabe; auch als Lückenaufgaben.

## Tech-Stack

- **React 19** + **TypeScript** + **Vite 8**
- **Tailwind CSS v4**
- **Zustand** für den globalen Zustand (`src/store/gameStore.ts`)
- **react-router-dom v7**
- **Supabase Realtime (Broadcast)** für die Live-Synchronisation – **keine Datenbank-Tabellen**, nur Broadcast-Channels
- **vite-plugin-pwa** (Service Worker, installierbar)
- **Vitest** für Unit-Tests

## Setup (lokal)

Voraussetzung: Node.js (aktuelle LTS) und npm.

```bash
git clone https://github.com/TaughtMe/Laufdiktat.git
cd Laufdiktat
npm install
```

### Supabase-Zugangsdaten

Die Live-Räume brauchen ein Supabase-Projekt (kostenloser Tarif genügt):

1. Auf [supabase.com](https://supabase.com/) ein Projekt anlegen.
2. Unter **Project Settings → API** die `Project URL` und den `anon public`-Key kopieren.
3. `.env.example` nach `.env` kopieren und die Werte eintragen:

```env
VITE_SUPABASE_URL=https://dein-projekt.supabase.co
VITE_SUPABASE_ANON_KEY=dein-anon-key
```

> Es werden **keine Tabellen** benötigt – die App nutzt ausschließlich Realtime-Broadcasts. Ohne `.env` startet die App trotzdem, aber die Räume (Echtzeit-Synchronisation) funktionieren nicht.

### Entwicklungsserver

```bash
npm run dev       # Dev-Server (Vite)
npm run build     # Produktions-Build (tsc -b && vite build)
npm run preview   # Produktions-Build lokal ansehen
npm run lint      # ESLint
npm test          # Unit-Tests (Vitest)
```

## Deployment (Cloudflare Pages)

Die App ist ein statischer Build und läuft auf Cloudflare Pages:

- **Build-Befehl:** `npm run build`
- **Ausgabeverzeichnis:** `dist`
- **Umgebungsvariablen:** `VITE_SUPABASE_URL` und `VITE_SUPABASE_ANON_KEY` in den Projekt-Einstellungen von Cloudflare Pages hinterlegen.
- **SPA-Routing:** Da die App client-seitiges Routing nutzt, müssen unbekannte Pfade auf `index.html` umgeleitet werden. Das übernimmt `public/_redirects` (`/* /index.html 200`), das bereits im Projekt liegt.

Jeder Push auf `main` löst ein neues Deployment aus. Die `APP_VERSION` in `src/pwa.ts` (aktuell passend zu `package.json`) steuert das Update-Verhalten der PWA; die Versionsanzeige unten rechts leuchtet rot, wenn ein Update verfügbar ist.

## Datenschutz

Die App ist bewusst **datensparsam** aufgebaut:

- **Keine dauerhafte Speicherung.** Es gibt keine Datenbank-Tabellen; die Synchronisation läuft über flüchtige Supabase-Broadcasts, die nur während einer laufenden Sitzung existieren.
- **Keine Accounts, kein Login** für Schüler. Beim Beitritt wird ein **zufälliger Tiername** vergeben (z. B. „Schlauer Igel").
- **Empfehlung:** Keine echten Klarnamen von Schülerinnen und Schülern eingeben – die zufälligen Tiernamen genügen für die Zuordnung im Unterricht.
- Impressum und Datenschutzhinweise sind in der App unter `/legal` verlinkt.

## Projektstruktur

```
src/
  pages/          Seiten (Home, Game, Dashboard, StationGame, LegalPage)
  hooks/
    game/         useGameRoom, useExitGuard
    battle/       useBattleMode
    dashboard/    useDashboardRoom, useManualHighlighting, useMathImport
  utils/
    game/         checkAnswer, buildHint, scoring
    dashboard/    csvParser, mathTasks, exportUtils
    supabaseClient.ts
  components/
    game/         GameOverlays
    dashboard/    DashboardOnboarding
    shared/       AnimalAvatar, LegalLink, NumberStepper, QrScannerOverlay, VersionBadge
  store/          gameStore (Zustand)
  types/          game (Typen: WordItem, GameMode, BattleOptions …)
```

Die Seiten (`Dashboard.tsx`, `Game.tsx`) enthalten überwiegend die Seitenstruktur; die Logik liegt in Hooks und reinen Utility-Funktionen (letztere sind mit Vitest getestet).
