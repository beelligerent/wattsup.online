'use client';
import { GoogleGenAI, Type } from "@google/genai";
import { AIInsight, MeterReading, EquipmentSummary, AIReportResponse } from '../types';

export const getAIInsights = async (
  readings: MeterReading[],
  summaries: EquipmentSummary[],
  prompt: string
): Promise<AIReportResponse> => {
  const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
  if (!apiKey) throw new Error("Gemini API Key not configured.");

  const ai = new GoogleGenAI({ apiKey });
  
  // Prepare a more comprehensive version of the data for the AI
  const dataSummary = {
    totalRecords: readings.length,
    equipmentCount: summaries.length,
    topConsumers: summaries.sort((a, b) => b.totalKWh - a.totalKWh).slice(0, 10).map(s => ({
      name: s.name,
      area: s.area,
      kwh: Math.round(s.totalKWh),
      efficiency: Math.round(s.avgEfficiency),
      status: s.efficiencyStatus
    })),
    areaPerformance: summaries.reduce((acc: any, s) => {
      if (!acc[s.area]) acc[s.area] = { totalKWh: 0, count: 0 };
      acc[s.area].totalKWh += s.totalKWh;
      acc[s.area].count += 1;
      return acc;
    }, {}),
    anomalies: summaries.filter(s => s.anomalyCount > 0).map(s => ({
      name: s.name,
      count: s.anomalyCount
    })),
    recentTrends: readings.slice(0, 300).map(r => ({
      timestamp: r.timestamp,
      equipment: r.equipmentName,
      kwh: r.kwh
    }))
  };

  const systemInstruction = `You are WattsUp AI, an expert energy performance engineer and management consultant. 
  Your goal is to provide high-impact, data-driven reports that are easy for management to understand while providing technical depth for engineers.

  CRITICAL REQUIREMENTS:
  1. EXACT VALUES: Always use the exact numerical values provided in the data.
  2. DATA TABLES: Use Markdown tables for comparisons and lists of equipment.
  3. STRUCTURED REPORT (reportText):
     - HEADER: Professional report header (To, From, Date, Subject).
     - EXECUTIVE SUMMARY: 3-4 sentences highlighting critical findings and financial impact.
     - KEY FINDINGS & DATA ANALYSIS: Detailed breakdown with specific data points.
     - RECOMMENDATIONS: Clear, actionable next steps.
  4. VISUALIZATIONS (visualizations):
     - Provide 2-3 relevant visualizations (bar, line, or pie) that support your findings.
     - For 'pie' charts, use them for distribution (e.g., energy by area).
     - For 'bar' charts, use them for comparison (e.g., top consumers).
     - For 'line' charts, use them for trends (e.g., daily consumption).
  5. FINANCIAL IMPACT: Always calculate cost impact in PHP (assume ₱12/kWh if not specified).

  Tone: Professional, authoritative, and data-centric.`;

  const responseSchema = {
    type: Type.OBJECT,
    properties: {
      reportText: {
        type: Type.STRING,
        description: "The full markdown text of the report."
      },
      visualizations: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            type: {
              type: Type.STRING,
              enum: ["bar", "line", "pie"],
              description: "The type of chart."
            },
            title: {
              type: Type.STRING,
              description: "The title of the chart."
            },
            data: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  label: { type: Type.STRING },
                  value: { type: Type.NUMBER }
                }
              }
            }
          },
          required: ["type", "title", "data"]
        }
      }
    },
    required: ["reportText", "visualizations"]
  };

  const maxRetries = 3;
  let retryCount = 0;

  while (retryCount < maxRetries) {
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Data Summary: ${JSON.stringify(dataSummary)}\n\nUser Query: ${prompt}`,
        config: {
          systemInstruction,
          responseMimeType: "application/json",
          responseSchema,
          temperature: 0.7,
        },
      });

      if (!response.text) throw new Error("No response from AI.");
      return JSON.parse(response.text) as AIReportResponse;
    } catch (error: any) {
      console.error(`AI Service Error (Attempt ${retryCount + 1}):`, error);
      
      const isRetryable = error?.message?.includes('503') || 
                          error?.message?.includes('high demand') || 
                          error?.status === 'UNAVAILABLE';

      if (isRetryable && retryCount < maxRetries - 1) {
        retryCount++;
        const delay = Math.pow(2, retryCount - 1) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }

      throw error;
    }
  }

  throw new Error("Error communicating with AI Analytics after multiple attempts.");
};
