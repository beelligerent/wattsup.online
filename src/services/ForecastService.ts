'use client';
import { ForecastPoint, MeterReading } from '../types';
import { addDays, format, parseISO } from 'date-fns';

export const generateForecast = (
  readings: MeterReading[],
  daysToForecast: number = 7
): ForecastPoint[] => {
  if (readings.length < 5) return [];

  // Aggregate daily total plant kW
  const dailyTotals = new Map<string, number>();
  readings.forEach(r => {
    const day = r.timestamp.split(' ')[0];
    dailyTotals.set(day, (dailyTotals.get(day) || 0) + r.actualKW);
  });

  const sortedDays = Array.from(dailyTotals.entries())
    .sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime());

  const xValues = sortedDays.map((_, i) => i);
  const yValues = sortedDays.map(d => d[1]);

  // Simple Linear Regression: y = mx + b
  const n = xValues.length;
  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
  for (let i = 0; i < n; i++) {
    sumX += xValues[i];
    sumY += yValues[i];
    sumXY += xValues[i] * yValues[i];
    sumX2 += xValues[i] * xValues[i];
  }

  const m = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const b = (sumY - m * sumX) / n;

  const result: ForecastPoint[] = sortedDays.map(d => ({
    timestamp: d[0],
    actual: d[1]
  }));

  const lastDate = parseISO(sortedDays[sortedDays.length - 1][0]);

  for (let i = 1; i <= daysToForecast; i++) {
    const forecastX = n + i - 1;
    const forecastY = m * forecastX + b;
    const forecastDate = format(addDays(lastDate, i), 'yyyy-MM-dd');

    // Add some "confidence band" logic
    const variance = Math.sqrt(yValues.reduce((acc, y, idx) => acc + Math.pow(y - (m * idx + b), 2), 0) / n);

    result.push({
      timestamp: forecastDate,
      forecast: Math.max(0, forecastY),
      lowerBound: Math.max(0, forecastY - variance),
      upperBound: forecastY + variance
    });
  }

  return result;
};
