// Zeitkonstanten für die verbindungsunabhängige Online-Erkennung (DB-Heartbeat,
// siehe Migration 20260728120000_participant_heartbeat.sql).
//
// Der Schüler-Client meldet sich alle HEARTBEAT_INTERVAL_MS als "noch da"
// (room_participants.last_seen_at, siehe touchParticipant/useGameRoom). Das
// Lehrer-Dashboard (useDashboardRoom) wertet einen Teilnehmer als online,
// dessen last_seen_at jünger als ONLINE_THRESHOLD_MS ist. Die Schwelle MUSS
// ein Mehrfaches des Intervalls sein, damit ein einzelner verlorener Heartbeat
// (kurzer WLAN-Aussetzer im Klassenzimmer) niemanden fälschlich ausgraut.
export const HEARTBEAT_INTERVAL_MS = 15_000;
export const ONLINE_THRESHOLD_MS = 45_000;

// Wie oft das Dashboard die Teilnehmerliste unabhängig von Presence pollt --
// damit die "N verbunden"-Anzeige nie mehr als wenige Sekunden nachhängt,
// selbst wenn ein Presence-Event einmal ausbleibt.
export const PARTICIPANTS_POLL_MS = 8_000;
