import { NextRequest, NextResponse } from 'next/server';
import { getDatabase, safeQueryAll, getErrorStatus, isConfigured, ensureContainers } from '../_cosmos';

// Run once on first request
let containersEnsured = false;

export async function GET(req: NextRequest) {
  if (!isConfigured()) {
    return NextResponse.json({
      error: 'Cosmos DB not configured',
      hint: 'Set COSMOS_ENDPOINT and COSMOS_KEY in .env.local'
    }, { status: 503 });
  }

  const userId = req.nextUrl.searchParams.get('userId');
  if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 });

  if (!containersEnsured) {
    containersEnsured = true;
    ensureContainers().catch(console.error);
  }

  try {
    console.log(`[Preload] Starting for userId: ${userId}`);
    const startTime = Date.now();

    const READINGS_COLS = [
      'c.id','c.timestamp','c.equipmentName','c.area','c.unit',
      'c.actualKW','c.baselineKW','c.designKW','c.kwh',
      'c.efficiencyScore','c.carbonEmission','c.isAnomaly','c.anomalyReason','c.fileId'
    ].join(', ');

    const [readings, files, logs, systemSettings, appSettings, costRulesData, rolesData, userResource] =
      await Promise.all([
        safeQueryAll('energy_readings', `SELECT ${READINGS_COLS} FROM c`)
          .then(r => { console.log(`[Preload] energy_readings: ${r.length} (${Date.now()-startTime}ms)`); return r; })
          .catch(err => { console.error('[Preload] energy_readings FAILED:', err.message); return []; }),

        safeQueryAll('uploaded_files', 'SELECT c.id, c.fileName, c.uploadedBy, c.uploadedAt, c.recordCount, c.fileSize, c.storagePath, c.downloadUrl FROM c')
          .then(r => { console.log(`[Preload] uploaded_files: ${r.length}`); return r; })
          .catch(() => []),

        safeQueryAll('audit_logs', 'SELECT c.id, c.user, c.action, c.details, c.timestamp FROM c')
          .then(r => { r.sort((a:any,b:any) => new Date(b.timestamp).getTime()-new Date(a.timestamp).getTime()); return r.slice(0,500); })
          .catch(() => []),

        safeQueryAll('system_settings', 'SELECT * FROM c').catch(() => []),
        safeQueryAll('settings', 'SELECT * FROM c').catch(() => []),
        safeQueryAll('cost_rules', 'SELECT * FROM c').catch(() => []),
        safeQueryAll('roles', 'SELECT * FROM c').catch(() => []),

        getDatabase()!.container('users').item(userId, userId).read()
          .then(({ resource }) => resource ?? null)
          .catch(() => null),
      ]);

    const sortedReadings = (readings as any[]).sort(
      (a,b) => new Date(b.timestamp).getTime()-new Date(a.timestamp).getTime()
    );

    // Compute summaries server-side
    const equipmentMap = new Map<string, any>();
    const areaMap = new Map<string, any>();

    sortedReadings.forEach((r: any) => {
      if (!equipmentMap.has(r.equipmentName)) {
        equipmentMap.set(r.equipmentName, { name:r.equipmentName, area:r.area, unit:r.unit, baselineKW:r.baselineKW??0, designKW:r.designKW??0, totalKWh:0, totalKW:0, count:0, anomalyCount:0, totalCarbon:0, maxDemand:0, minLoad:Infinity, totalEfficiency:0 });
      }
      const eq = equipmentMap.get(r.equipmentName);
      eq.totalKWh += r.kwh??0; eq.totalKW += r.actualKW??0; eq.count++;
      eq.totalCarbon += r.carbonEmission??0;
      eq.maxDemand = Math.max(eq.maxDemand, r.actualKW??0);
      eq.minLoad = Math.min(eq.minLoad, r.actualKW??0);
      eq.totalEfficiency += r.efficiencyScore??0;
      if (r.isAnomaly) eq.anomalyCount++;

      if (!areaMap.has(r.area)) {
        areaMap.set(r.area, { area:r.area, totalKW:0, totalKWh:0, totalEfficiency:0, count:0, equipmentNames:new Set<string>(), carbonEmission:0 });
      }
      const ar = areaMap.get(r.area);
      ar.totalKW += r.actualKW??0; ar.totalKWh += r.kwh??0;
      ar.totalEfficiency += r.efficiencyScore??0; ar.count++;
      ar.equipmentNames.add(r.equipmentName);
      ar.carbonEmission += r.carbonEmission??0;
    });

    const equipmentSummaries = Array.from(equipmentMap.values()).map(eq => ({
      ...eq,
      avgLoad: eq.count>0 ? eq.totalKW/eq.count : 0,
      avgKWh: eq.count>0 ? eq.totalKWh/eq.count : 0,
      avgEfficiency: eq.count>0 ? eq.totalEfficiency/eq.count : 0,
      efficiencyStatus: eq.count>0 && eq.totalEfficiency/eq.count>85 ? 'Efficient' : eq.count>0 && eq.totalEfficiency/eq.count>70 ? 'Normal' : 'Inefficient',
      minLoad: eq.minLoad===Infinity ? 0 : eq.minLoad,
    }));

    const areaSummaries = Array.from(areaMap.values()).map(ar => {
      const areaEquip = equipmentSummaries.filter(eq => eq.area===ar.area);
      return {
        area: ar.area,
        totalKW: areaEquip.reduce((s,eq) => s+eq.avgLoad, 0),
        totalKWh: ar.totalKWh,
        avgEfficiency: ar.count>0 ? ar.totalEfficiency/ar.count : 0,
        equipmentCount: ar.equipmentNames.size,
        carbonEmission: ar.carbonEmission,
      };
    });

    const elapsed = Date.now()-startTime;
    console.log(`[Preload] Complete in ${elapsed}ms — ${sortedReadings.length} readings, ${equipmentSummaries.length} equipment`);

    return NextResponse.json({
      readings: sortedReadings,
      files,
      logs,
      settings: [...(systemSettings as any[]), ...(appSettings as any[])],
      userProfile: userResource,
      summaries: { equipment: equipmentSummaries, area: areaSummaries },
      costRules: costRulesData,
      roles: rolesData,
      timestamp: new Date().toISOString(),
    }, {
      headers: { 'Connection': 'keep-alive', 'Keep-Alive': 'timeout=300' }
    });
  } catch (err: any) {
    console.error('[Preload] Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
