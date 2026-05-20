'use client';
import { MeterReading, EquipmentSummary, AreaSummary, DashboardStats, EfficiencyStatus } from '../types';
import { parseISO, differenceInDays, isWithinInterval } from 'date-fns';

export const EMISSION_FACTOR = 0.712; // kg CO2 per kWh

export const calculateEfficiencyStatusFromVariance = (variance: number): EfficiencyStatus => {
  if (variance > 5) return 'Efficient';
  if (variance >= -5) return 'Normal';
  return 'Inefficient';
};

export const calculateDetailedCost = (totalKWh: number, maxDemand: number, rules: { energyPrice: number, demandCharge: number, systemLoss: number, vat: number }) => {
  const energyCharge = totalKWh * rules.energyPrice;
  const systemLossCharge = energyCharge * (rules.systemLoss / 100);
  const peakDemandCharge = rules.demandCharge * maxDemand;
  const subtotal = energyCharge + systemLossCharge + peakDemandCharge;
  const vatCharge = subtotal * (rules.vat / 100);
  return {
    totalCost: subtotal + vatCharge,
    energyCharge,
    systemLossCharge,
    peakDemandCharge,
    vatCharge,
    avgCostPerKWh: totalKWh > 0 ? (subtotal + vatCharge) / totalKWh : 0
  };
};

export const aggregateData = (
  readings: MeterReading[], 
  dailyMWGenerated: number = 100,
  baselineParams?: { 
    range: [Date | null, Date | null], 
    factor: number, 
    allReadings?: MeterReading[],
    appliedEquipment?: string[],
    decimals?: number
  }
): DashboardStats => {
  const equipmentMap = new Map<string, MeterReading[]>();
  const areaMap = new Map<string, MeterReading[]>();

  // Find date range to calculate number of days
  const timestamps = readings.map(r => new Date(r.timestamp).getTime());
  const minDate = new Date(Math.min(...timestamps));
  const maxDate = new Date(Math.max(...timestamps));
  const daysInPeriod = Math.max(1, differenceInDays(maxDate, minDate) + 1);

  readings.forEach(r => {
    if (!equipmentMap.has(r.equipmentName)) equipmentMap.set(r.equipmentName, []);
    equipmentMap.get(r.equipmentName)!.push(r);

    if (!areaMap.has(r.area)) areaMap.set(r.area, []);
    areaMap.get(r.area)!.push(r);
  });

  const equipmentSummaries: EquipmentSummary[] = Array.from(equipmentMap.entries()).map(([name, data]) => {
    // Sort data by timestamp ascending to find running streaks
    const sortedData = [...data].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    
    const actualKWs = data.map(d => d.actualKW);
    const avgLoad = actualKWs.reduce((a, b) => a + b, 0) / actualKWs.length;
    
    // Use the sum of kwh field if available, otherwise fallback to calculation
    const totalKWh = data.reduce((sum, d) => sum + (d.kwh || 0), 0) || (avgLoad * 24 * daysInPeriod);
    const avgKWh = totalKWh / daysInPeriod;
    
    const maxDemand = Math.max(...actualKWs);
    const minLoad = Math.min(...actualKWs);
    const avgEfficiency = data.reduce((a, b) => a + b.efficiencyScore, 0) / data.length;
    const totalCarbon = totalKWh * EMISSION_FACTOR; 
    const anomalyCount = data.filter(d => d.isAnomaly).length;
    
    const baselineKW = data[0].baselineKW;
    const designKW = data[0].designKW;
    const loadFactor = maxDemand > 0 ? (avgLoad / maxDemand) * 100 : 0;
    const utilization = (actualKWs.filter(kw => kw > baselineKW * 0.1).length / data.length) * 100;

    // Calculate "Running Since" and "Days Online"
    let lastZeroIndex = -1;
    for (let i = sortedData.length - 1; i >= 0; i--) {
      if (sortedData[i].actualKW === 0) {
        lastZeroIndex = i;
        break;
      }
    }

    let runningSince = 'N/A';
    let daysOnline = 0;

    if (sortedData.length > 0) {
      const latestReading = sortedData[sortedData.length - 1];
      
      if (latestReading.actualKW > 0) {
        const startIndex = lastZeroIndex === -1 ? 0 : lastZeroIndex + 1;
        if (startIndex < sortedData.length) {
          const startReading = sortedData[startIndex];
          runningSince = startReading.timestamp.split(' ')[0];
          
          try {
            const startDate = parseISO(startReading.timestamp);
            const endDate = parseISO(latestReading.timestamp);
            daysOnline = Math.max(0, differenceInDays(endDate, startDate));
          } catch (e) {
            console.error("Error calculating days online:", e);
          }
        }
      } else {
        daysOnline = 0;
        runningSince = 'Off';
      }
    }

    let computedBaseline = 0;
    const shouldApplyBaseline = baselineParams && 
                               baselineParams.range[0] && 
                               baselineParams.range[1] && 
                               (!baselineParams.appliedEquipment || baselineParams.appliedEquipment.includes(name));

    if (shouldApplyBaseline) {
      const baselineSource = baselineParams!.allReadings || readings;
      const equipmentBaselineData = baselineSource.filter(d => d.equipmentName === name);
      
      const baselineData = equipmentBaselineData.filter(d => {
        try {
          const date = parseISO(d.timestamp);
          return isWithinInterval(date, {
            start: baselineParams!.range[0]!,
            end: baselineParams!.range[1]!
          });
        } catch (e) {
          return false;
        }
      });
      
      if (baselineData.length > 0) {
        const avgBaselineLoad = baselineData.reduce((a, b) => a + b.actualKW, 0) / baselineData.length;
        computedBaseline = avgBaselineLoad * (baselineParams!.factor / 100);

        if (typeof baselineParams!.decimals === 'number') {
          const p = Math.pow(10, baselineParams!.decimals);
          computedBaseline = Math.round(computedBaseline * p) / p;
        }
      }
    }

    const effectiveBaseline = computedBaseline || baselineKW;
    const variance = effectiveBaseline > 0 ? ((effectiveBaseline - avgLoad) / effectiveBaseline * 100) : 0;

    return {
      name,
      area: data[0].area,
      unit: data[0].unit,
      baselineKW,
      designKW,
      avgLoad,
      avgKWh,
      maxDemand,
      minLoad,
      totalKWh,
      avgEfficiency,
      efficiencyStatus: calculateEfficiencyStatusFromVariance(variance),
      totalCarbon,
      anomalyCount,
      loadFactor,
      utilization,
      daysOnline,
      runningSince,
      computedBaseline: effectiveBaseline
    };
  });

  const areaSummaries: AreaSummary[] = Array.from(areaMap.entries()).map(([area, data]) => {
    const totalKWh = data.reduce((a, b) => a + (b.kwh || 0), 0);
    const avgEfficiency = data.reduce((a, b) => a + b.efficiencyScore, 0) / data.length;
    const carbonEmission = data.reduce((a, b) => a + b.carbonEmission, 0);
    
    // Calculate average total KW for the area
    // We sum the average loads of all equipment in this area
    const areaEquip = equipmentSummaries.filter(eq => eq.area === area);
    const avgTotalKW = areaEquip.reduce((sum, eq) => sum + eq.avgLoad, 0);

    return {
      area,
      totalKW: avgTotalKW,
      totalKWh,
      avgEfficiency,
      equipmentCount: areaEquip.length,
      carbonEmission
    };
  });

  const totalPlantKWh = equipmentSummaries.reduce((a, b) => a + b.totalKWh, 0);
  const totalPlantKW = areaSummaries.reduce((a, b) => a + b.totalKW, 0);
  const totalCarbonEmission = equipmentSummaries.reduce((a, b) => a + b.totalCarbon, 0) / 1000; // to tons
  const anomalyCount = equipmentSummaries.reduce((a, b) => a + b.anomalyCount, 0);

  const energyIntensity = dailyMWGenerated > 0 ? totalPlantKWh / (dailyMWGenerated * daysInPeriod) : 0;

  const potentialSavingsKWh = equipmentSummaries
    .filter(eq => eq.efficiencyStatus === 'Inefficient')
    .reduce((sum, eq) => {
      const baselineKWh = eq.totalKWh * (eq.avgEfficiency / 100);
      return sum + Math.max(0, eq.totalKWh - baselineKWh);
    }, 0);

  const topEquipment = [...equipmentSummaries].sort((a, b) => b.totalKWh - a.totalKWh).slice(0, 10);
  const highestEnergyEquipment = equipmentSummaries.length > 0 ? [...equipmentSummaries].sort((a, b) => b.totalKWh - a.totalKWh)[0].name : 'N/A';
  const mostEfficientArea = areaSummaries.length > 0 ? [...areaSummaries].sort((a, b) => b.avgEfficiency - a.avgEfficiency)[0].area : 'N/A';
  const maxDemand = equipmentSummaries.length > 0 ? Math.max(...equipmentSummaries.map(eq => eq.maxDemand)) : 0;

  return {
    totalPlantKW,
    totalPlantKWh,
    energyIntensity,
    totalEquipmentCount: equipmentSummaries.length,
    highestEnergyEquipment,
    mostEfficientArea,
    totalCarbonEmission,
    anomalyCount,
    maxDemand,
    potentialSavingsKWh,
    totalCostImpact: 0, // Will be calculated in component if needed or passed via rules
    daysInPeriod,
    topEquipment,
    allEquipment: equipmentSummaries,
    areaBreakdown: areaSummaries
  };
};
