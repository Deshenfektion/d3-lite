import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const random = mulberry32(20250512);

const gaussian = (mean: number, deviation: number): number => {
  const u = Math.max(random(), 1e-9);
  const v = Math.max(random(), 1e-9);
  return mean + deviation * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
};

const here = (name: string): string =>
  fileURLToPath(new URL(name, import.meta.url));

const toCsv = (rows: readonly Record<string, string | number>[]): string => {
  if (rows.length === 0) return '';
  const header = Object.keys(rows[0]!);
  const lines = [header.join(',')];
  for (const row of rows) {
    lines.push(header.map((key) => String(row[key] ?? '')).join(','));
  }
  return `${lines.join('\n')}\n`;
};

const REGIONS = ['North', 'South', 'East', 'West'];
const SEGMENTS = ['Enterprise', 'Mid-market', 'SMB'];
const MONTHS = [
  '2024-07', '2024-08', '2024-09', '2024-10', '2024-11', '2024-12',
  '2025-01', '2025-02', '2025-03', '2025-04', '2025-05', '2025-06',
];

const regionBase: Record<string, number> = {
  North: 420,
  South: 310,
  East: 265,
  West: 380,
};

const segmentWeight: Record<string, number> = {
  Enterprise: 0.52,
  'Mid-market': 0.31,
  SMB: 0.17,
};

const sales: Record<string, string | number>[] = [];
MONTHS.forEach((month, monthIndex) => {
  const seasonal = 1 + 0.14 * Math.sin((monthIndex / MONTHS.length) * Math.PI * 2);
  const trend = 1 + monthIndex * 0.018;
  for (const region of REGIONS) {
    for (const segment of SEGMENTS) {
      const base = (regionBase[region] ?? 300) * (segmentWeight[segment] ?? 0.2);
      const revenue = Math.max(12, gaussian(base * seasonal * trend, base * 0.09));
      const unitPrice = 210 + gaussian(0, 18);
      sales.push({
        month,
        region,
        segment,
        revenue: Math.round(revenue * 100) / 100,
        units: Math.max(1, Math.round((revenue * 1000) / unitPrice)),
      });
    }
  }
});
writeFileSync(here('sales.csv'), toCsv(sales));

const targets = REGIONS.map((region) => ({
  region,
  quarterlyTarget: Math.round((regionBase[region] ?? 300) * 3 * 1.05),
  owner: { name: `${region} desk`, headcount: 4 + Math.round(random() * 6) },
}));
writeFileSync(here('targets.json'), `${JSON.stringify({ targets }, null, 2)}\n`);

const LINES = ['Line A', 'Line B', 'Line C'];
const quality: Record<string, string | number>[] = [];
for (let batch = 1; batch <= 240; batch++) {
  const line = LINES[batch % LINES.length] as string;
  const lineBias = line === 'Line C' ? 1.7 : line === 'Line B' ? 1.15 : 1;
  const throughput = Math.max(40, gaussian(180 / lineBias, 22));
  const defectRate = Math.max(0.05, gaussian(1.4 * lineBias, 0.55));
  quality.push({
    batch,
    line,
    shift: batch % 2 === 0 ? 'Day' : 'Night',
    throughput: Math.round(throughput * 10) / 10,
    defect_rate: Math.round(defectRate * 100) / 100,
    yield: Math.round((100 - defectRate * 2.4 - random() * 1.5) * 100) / 100,
  });
}
writeFileSync(here('quality.csv'), toCsv(quality));

const series: Record<string, string | number>[] = [];
const start = Date.UTC(2025, 4, 5, 0, 0, 0);
let p50 = 42;
let p95 = 128;
for (let step = 0; step < 336; step++) {
  const timestamp = new Date(start + step * 30 * 60 * 1000);
  const hour = timestamp.getUTCHours();
  const daily = 1 + 0.42 * Math.sin(((hour - 4) / 24) * Math.PI * 2);
  const incident = step > 190 && step < 214 ? 2.6 : 1;

  p50 = Math.max(18, p50 * 0.82 + gaussian(44 * daily * incident, 4) * 0.18);
  p95 = Math.max(p50 * 1.6, p95 * 0.82 + gaussian(132 * daily * incident, 14) * 0.18);

  series.push({
    timestamp: timestamp.toISOString(),
    requests: Math.round(Math.max(80, gaussian(1400 * daily, 120))),
    latency_p50: Math.round(p50 * 10) / 10,
    latency_p95: Math.round(p95 * 10) / 10,
    error_rate: Math.round(Math.max(0, gaussian(0.6 * incident, 0.22)) * 100) / 100,
  });
}
writeFileSync(here('traffic.csv'), toCsv(series));

process.stdout.write(
  `sales ${sales.length} rows, quality ${quality.length} rows, traffic ${series.length} rows\n`
);
