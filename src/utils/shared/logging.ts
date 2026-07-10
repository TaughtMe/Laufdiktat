/**
 * Technische Fehlerdetails bleiben auf Entwicklungsumgebungen beschraenkt.
 * In Produktions-Browserkonsolen landen dadurch weder RPC-Details noch
 * versehentlich mitgelieferte Request-Metadaten. Nutzerhinweise erfolgen
 * separat ueber den sichtbaren UI-Fehlerzustand.
 */
export const logDevError = (context: string, error: unknown): void => {
  if (import.meta.env.DEV) console.error(context, error);
};
