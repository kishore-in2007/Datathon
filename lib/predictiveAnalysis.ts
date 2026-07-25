import { initDb } from "./db";

export type PredictionData = {
  district: string;
  crimeType: string;
  weeklyCounts: number[];
  slope: number;
  average: number;
  projectedNextWeek: number;
  factors: { label: string; percent: number }[];
  hotspots: { lat: number; lon: number; areaName: string; score: number; cases: number }[];
};

function regression(values: number[]) {
  const n = values.length;
  const sumX = (n * (n - 1)) / 2;
  const sumY = values.reduce((a, b) => a + b, 0);
  const sumXY = values.reduce((sum, y, x) => sum + x * y, 0);
  const sumXX = values.reduce((sum, _, x) => sum + x * x, 0);
  const denominator = n * sumXX - sumX * sumX;
  const slope = denominator ? (n * sumXY - sumX * sumY) / denominator : 0;
  return { slope, intercept: (sumY - slope * sumX) / n };
}

export async function getPrediction(district = "Bengaluru North", crimeType = "chain-snatching"): Promise<PredictionData> {
  const db = await initDb();
  const trend = await db.execute({
    sql: `SELECT CAST((julianday('now')-julianday(date_reported))/7 AS INTEGER) AS weeks_ago, COUNT(*) AS count
      FROM cases WHERE district=? AND crime_type=? AND date_reported>=date('now','-56 days')
      GROUP BY weeks_ago`,
    args: [district, crimeType],
  });
  const byWeek = new Map(trend.rows.map((row) => [Number(row.weeks_ago), Number(row.count)]));
  const weeklyCounts = Array.from({ length: 8 }, (_, index) => byWeek.get(7 - index) || 0);
  const { slope, intercept } = regression(weeklyCounts);
  const average = weeklyCounts.reduce((a, b) => a + b, 0) / 8;
  const projectedNextWeek = Math.max(0, intercept + slope * 8);
  const recent = (weeklyCounts[6] + weeklyCounts[7]) / 2;
  const raw = [Math.max(recent, 0.1), Math.max(average, 0.1), Math.max(slope * 4, 0.1)];
  const total = raw.reduce((a, b) => a + b, 0);
  const first = Math.round((raw[0] / total) * 100);
  const second = Math.round((raw[1] / total) * 100);
  const factors = [
    { label: "Recent two-week activity", percent: first },
    { label: "Eight-week baseline", percent: second },
    { label: "Trend momentum", percent: 100 - first - second },
  ];
  const hotspotRows = await db.execute({
    sql: `SELECT ROUND(l.lat,2) AS lat, ROUND(l.lon,2) AS lon, l.area_name,
      SUM(1.0/(CAST((julianday('now')-julianday(c.date_reported))/7 AS INTEGER)+1)) AS score,
      COUNT(*) AS cases
      FROM locations l JOIN cases c ON c.case_id=l.case_id
      WHERE c.date_reported>=date('now','-56 days')
      GROUP BY ROUND(l.lat,2),ROUND(l.lon,2),l.area_name ORDER BY score DESC LIMIT 20`,
    args: [],
  });
  const hotspots = hotspotRows.rows.map((row) => ({
    lat: Number(row.lat), lon: Number(row.lon), areaName: String(row.area_name),
    score: Number(Number(row.score).toFixed(2)), cases: Number(row.cases),
  }));
  return {
    district, crimeType, weeklyCounts, slope: Number(slope.toFixed(2)),
    average: Number(average.toFixed(2)), projectedNextWeek: Number(projectedNextWeek.toFixed(1)), factors, hotspots,
  };
}
