'use client';
import { MeterReading } from '../types';
import { isValid, format } from 'date-fns';

export class CSVValidationError extends Error {
  constructor(public message: string, public row?: number, public column?: string) {
    super(message);
    this.name = 'CSVValidationError';
  }
}

export const parseEnergyCSV = (rawRows: any[][]): MeterReading[] => {
  if (rawRows.length < 5) {
    throw new CSVValidationError('CSV must have at least 5 rows (4 header rows + at least 1 data row).');
  }

  // Row 0: areas (first cell is "Date" label, columns 1..N are area names)
  // Area cells may be blank when consecutive columns share an area — fill forward
  const rawAreas = rawRows[0].slice(1);
  const areas: string[] = [];
  let lastArea = 'Unknown';
  for (const cell of rawAreas) {
    const trimmed = (cell ?? '').toString().trim();
    if (trimmed !== '') lastArea = trimmed;
    areas.push(lastArea);
  }

  // Row 1: equipment names
  const equipmentNames = rawRows[1].slice(1).map((v: any) => (v ?? '').toString().trim());

  // Row 2: units
  const units = rawRows[2].slice(1).map((v: any) => (v ?? '').toString().trim() || 'kW');

  // Row 3: design KW values
  const designKWRaw = rawRows[3].slice(1);

  const expectedColCount = equipmentNames.length;
  if (expectedColCount === 0) {
    throw new CSVValidationError('No equipment columns found in the second row.');
  }

  const designKWs: number[] = designKWRaw.map((v: any, idx: number) => {
    const val = parseFloat((v ?? '').toString());
    if (isNaN(val)) {
      throw new CSVValidationError(
        `Invalid Design KW value "${v}" for equipment "${equipmentNames[idx]}". Must be a number.`,
        4,
        equipmentNames[idx]
      );
    }
    return val;
  });

  const readings: MeterReading[] = [];

  // Data rows start at index 4
  for (let i = 4; i < rawRows.length; i++) {
    const row = rawRows[i];
    const rowNum = i + 1;

    // Skip entirely empty rows
    if (!row || row.length === 0 || row.every((c: any) => (c ?? '').toString().trim() === '')) continue;

    const dateStr = (row[0] ?? '').toString().trim();
    if (!dateStr) continue; // Skip rows with no date

    const parsedDate = new Date(dateStr);
    if (!isValid(parsedDate)) {
      throw new CSVValidationError(
        `Invalid date format "${dateStr}" in row ${rowNum}. Use YYYY-MM-DD or ISO format.`,
        rowNum,
        'Date'
      );
    }
    const timestamp = format(parsedDate, "yyyy-MM-dd'T'HH:mm:ss");

    for (let j = 0; j < expectedColCount; j++) {
      const colIndex = j + 1;
      const valRaw = (row[colIndex] ?? '').toString().trim();
      const actualKW = parseFloat(valRaw);
      const equipmentName = equipmentNames[j] || `Equipment_${j + 1}`;
      const area = areas[j] || 'Unknown';
      const unit = units[j] || 'kW';
      const designKW = designKWs[j] ?? 0;
      const baselineKW = designKW;

      if (isNaN(actualKW)) {
        // Skip blank/non-numeric cells (don't throw — partial rows are common)
        if (valRaw === '') continue;
        throw new CSVValidationError(
          `Invalid kW value "${valRaw}" for equipment "${equipmentName}" in row ${rowNum}. Must be a number.`,
          rowNum,
          equipmentName
        );
      }

      // Derived values
      const kwh = actualKW * 24;
      const efficiencyScore = baselineKW > 0 ? Math.min((baselineKW / actualKW) * 100, 200) : 100;
      const carbonEmission = kwh * 0.712; // kg CO2

      let isAnomaly = false;
      let anomalyReason = '';

      if (baselineKW > 0 && actualKW > baselineKW * 1.2) {
        isAnomaly = true;
        anomalyReason = 'Exceeds baseline by >20%';
      } else if (baselineKW > 0 && actualKW > 0 && actualKW < baselineKW * 0.5) {
        isAnomaly = true;
        anomalyReason = 'Significant drop below baseline (>50%)';
      }

      readings.push({
        timestamp,
        equipmentName,
        area,
        unit,
        baselineKW,
        designKW,
        actualKW,
        kwh,
        efficiencyScore,
        carbonEmission,
        isAnomaly,
        anomalyReason: anomalyReason || undefined,
      });
    }
  }

  return readings;
};
