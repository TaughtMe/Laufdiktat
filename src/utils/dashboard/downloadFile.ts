/**
 * Löst im Browser den Download einer Textdatei aus (Blob + kurzlebiger Anker).
 * Generische Fassung des Musters aus exportUtils.ts – dort bewusst nicht
 * refaktoriert, um den getesteten CSV-Export-Pfad nicht anzufassen.
 */
export const downloadTextFile = (
  filename: string,
  content: string,
  mime = 'text/plain;charset=utf-8;'
): void => {
  // UTF-8-BOM, damit Umlaute in Windows-Editoren (Notepad, Excel) korrekt ankommen.
  const blob = new Blob(['﻿' + content], { type: mime });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
};
