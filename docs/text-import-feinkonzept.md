# Feinkonzept: Textaufteilung (Reiter „Text")

Verbindliche Verhaltensspezifikation für den Umbau der Text-Import-Oberfläche.
Code und Tests richten sich hiernach. Entscheidungen A–E sind bestätigt.

## 0. Geltungsbereich v1
Reiter `Text | Mathe`. Mathe bleibt unverändert. Der Text-Reiter kapselt:
unveränderlichen Rohtext (Quelle), Trennregeln, manuelle Bereiche, Ausschlüsse,
Reihenfolge und Live-Vorschau.

## 1. Kanonischer Text & Positionen
Alle Positionen (manuelle Bereiche, Abschnittsgrenzen) beziehen sich auf den
**normalisierten** Rohtext. Normalisierung passiert einmalig bei Eingabe/Upload:
`\r\n` und `\r` → `\n`. Der gespeicherte Rohtext ist danach `\n`-only.

## 2. Datenmodell
```ts
type ImportMode = 'text' | 'math';
type NewlineMode = 'none' | 'line' | 'paragraph';

interface CustomDelimiter { id: string; value: string; }   // literal, ≥1 Zeichen
interface TextSplitConfig {
  newlineMode: NewlineMode;              // Default: 'line'
  punctuation: string[];                 // Default: ['.', '!', '?']
  customDelimiters: CustomDelimiter[];   // v1: immer aus dem Ergebnis entfernt (Entsch. A)
  groupConsecutiveSeparators: boolean;   // Default: true
}

type ManualRangeType = 'section' | 'split';               // Entsch. D
interface ManualRange { id: string; type: ManualRangeType; start: number; end: number; }

interface TextSection { id: string; start: number; end: number; text: string; source: 'auto' | 'manual'; }
```
Getrennte UI-Zustände (nicht Teil von `buildTextSections`): `excludedSectionIds`,
`customOrder`.

## 3. Trennregeln
| Separator | Verhalten | Aus Ergebnis entfernt? |
|---|---|---|
| Satz-/Einzelzeichen (`punctuation`) | Grenze nach dem Zeichen; bleibt am vorherigen Abschnitt | nein |
| Zeilenumbruch (`line`) | jedes `\n` = Grenze | ja |
| Absatz (`paragraph`) | Lauf aus ≥2 `\n` = eine Grenze; einzelnes `\n` bleibt Text | ja |
| Benutzerdefiniert | wörtlich, Longest-Match zuerst | ja (v1, Entsch. A) |

## 4. Pipeline `buildTextSections(rawText, config, manualRanges)`
Reine Funktion, wendet **keine** Ausschlüsse/Reihenfolge an.
1. Benutzerdefinierte Trenner per Longest-Match (konsumiert).
2. Zeilen-/Absatzregel (konsumiert).
3. Ausgewählte Einzelzeichen (behaltene Grenze nach dem Zeichen).
4. Läufe/benachbarte Separatoren zu einer Grenze zusammenfassen.
5. Manuelle Grenzen ergänzen: `section [s,e)` fügt Grenzen bei `s`/`e` ein und
   entfernt Auto-Grenzen echt innerhalb; `split p` fügt Grenze bei `p` ein.
6. An Grenzen schneiden.
7. Trimmen (Whitespace + konsumierte Randzeichen fallen weg).
8. Leere Abschnitte verwerfen.
9. IDs `s-<start>-<end>` (finale Positionen) → stabil über Re-Renders.
10. `source`: `manual`, wenn aus `section`-Bereich, sonst `auto`.

## 5. Sonderfälle (v1)
- **Mehrfach-Satzzeichen** `Was?!` → eine Grenze, bleibt zusammen.
- **Dezimalzahl** (Entsch. B): `.`/`,` **direkt zwischen zwei Ziffern** ist keine Grenze.
- **Abkürzung** `z. B.` → wird auto getrennt, per Marker manuell zusammenführen.
- **Anführungszeichen** (Entsch. C): nach dem Satzzeichen werden unmittelbar
  folgende schließende Anführungs-/Klammerzeichen mit an den vorherigen Abschnitt
  gezogen; keine „Satz-geht-weiter"-Logik.
- Text ohne Satzzeichen → ein Abschnitt. Nur Whitespace → keine Abschnitte.

## 6. Manuelle Bearbeitung (Marker)
Zwei Primitive (Entsch. D): `section` (Bereich → ein Abschnitt, interne
Auto-Grenzen unterdrückt; „Zusammenführen" = `section` über zwei Abschnitte) und
`split` (Grenze an einem Punkt). Überschneidung: neuer `section`-Bereich entfernt
nur die überlappten manuellen Bereiche (UI-Ebene; die reine Funktion setzt
Überschneidungsfreiheit voraus, früherer gewinnt). `×` entfernt einen Bereich,
„Manuelle Änderungen zurücksetzen" alle. Tablet-Tipp-Auswahl ist P5.

## 7. Reset-Matrix (Entsch. E)
| Auslöser | Auto | manuelle Bereiche | Ausschlüsse | Reihenfolge |
|---|---|---|---|---|
| Rohtext geändert | neu | zurückgesetzt | zurückgesetzt | zurückgesetzt |
| Regeln geändert | neu | bleiben | zurückgesetzt | zurückgesetzt |
| manueller Bereich geändert | neu | (geänderter Stand) | zurückgesetzt | zurückgesetzt |
| Ausschluss/Reihenfolge | — (Post-Schritt) | bleiben | — | — |

Bei Textänderung Hinweis: „Der Text wurde verändert. Manuelle Anpassungen wurden
zurückgesetzt."

## 8. Drei getrennte Reset-Aktionen
- **Manuelle Änderungen zurücksetzen** → leert `manualRanges` (+ Ausschlüsse/Reihenfolge).
- **Aufteilung zurücksetzen** → Regeln auf Standard („Sätze"); Rohtext & manuelle Bereiche bleiben.
- **Text leeren** → leert Rohtext (und damit alles).

## 9. Löschen & Umsortieren (Ergebnis-Ebene)
- `×` an einem Abschnitt → `id` zu `excludedSectionIds`. Rohtext bleibt.
- Drag&Drop rechts → ändert nur `customOrder`. Ersetzt die alte `moveChunk`-Logik,
  die den Rohtext mutierte.

## 10. Umsetzungsphasen
- **P1** – reine Funktion `buildTextSections` + Tests, Semikolon-Sonderfall raus. ✅
- **P2** – Reiter vier → zwei; Schnellwahl, Satzzeichen-Chips, Zeilenmodus,
  benutzerdefinierte Trenner, Live-Vorschau auf `buildTextSections`.
- **P3** – Marker als Overlay (`section`/`split`, positionsbasiert).
- **P4** – Löschen = Ausschluss, DnD = nur Ergebnis-Reihenfolge.
- **P5** – Tablet-Auswahl (Wort antippen → Wort antippen) & Feinschliff.

## Test-Kontrakt (Auszug)
Siehe `src/utils/dashboard/textSections.test.ts` für die vollständige, ausführbare
Fassung.
