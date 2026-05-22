export interface Student {
  name: string;
  reachedStation: string | number;
  progressPercent: number;
}

/**
 * Exports student results to a CSV file.
 * Uses semicolon (;) separator for German Excel compatibility.
 * Prepends UTF-8 BOM (\uFEFF) to ensure correct character encoding in Excel on Windows.
 */
export const exportResultsToCSV = (students: Student[]) => {
  const headers = ['Name', 'Erreichte_Station', 'Fortschritt_Prozent'];
  const csvRows = [headers.join(';')];

  for (const student of students) {
    const row = [
      student.name,
      student.reachedStation,
      `${student.progressPercent}%`
    ];
    
    // Escape values that contain semicolons, quotes, or newlines
    const escapedRow = row.map(val => {
      const stringVal = String(val);
      if (stringVal.includes(';') || stringVal.includes('"') || stringVal.includes('\n')) {
        return `"${stringVal.replace(/"/g, '""')}"`;
      }
      return stringVal;
    });
    
    csvRows.push(escapedRow.join(';'));
  }

  const csvContent = '\uFEFF' + csvRows.join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `laufdiktat_ergebnisse_${new Date().toISOString().split('T')[0]}.csv`);
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
