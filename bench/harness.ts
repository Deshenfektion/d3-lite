export interface BenchResult {
  readonly name: string;
  readonly iterations: number;
  readonly meanMs: number;
  readonly medianMs: number;
  readonly p95Ms: number;
  readonly opsPerSecond: number;
}

export interface BenchOptions {
  readonly iterations?: number;
  readonly warmup?: number;
}

export function benchmark(
  name: string,
  body: () => void,
  options: BenchOptions = {}
): BenchResult {
  const iterations = options.iterations ?? 200;
  const warmup = options.warmup ?? Math.min(50, Math.ceil(iterations / 4));

  for (let i = 0; i < warmup; i++) body();

  const samples = new Float64Array(iterations);
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    body();
    samples[i] = performance.now() - start;
  }

  const sorted = Array.from(samples).sort((a, b) => a - b);
  const total = sorted.reduce((sum, value) => sum + value, 0);
  const meanMs = total / iterations;
  const medianMs = sorted[Math.floor(iterations / 2)] ?? 0;
  const p95Ms = sorted[Math.min(iterations - 1, Math.floor(iterations * 0.95))] ?? 0;

  return {
    name,
    iterations,
    meanMs,
    medianMs,
    p95Ms,
    opsPerSecond: meanMs > 0 ? 1000 / meanMs : Number.POSITIVE_INFINITY,
  };
}

export function formatResults(results: readonly BenchResult[]): string {
  const header = ['benchmark', 'iters', 'mean ms', 'median ms', 'p95 ms', 'ops/sec'];
  const rows = results.map((result) => [
    result.name,
    String(result.iterations),
    result.meanMs.toFixed(4),
    result.medianMs.toFixed(4),
    result.p95Ms.toFixed(4),
    result.opsPerSecond < 1000
      ? result.opsPerSecond.toFixed(1)
      : Math.round(result.opsPerSecond).toLocaleString('en-US'),
  ]);

  const widths = header.map((label, column) =>
    Math.max(label.length, ...rows.map((row) => (row[column] ?? '').length))
  );

  const line = (cells: readonly string[]): string =>
    cells.map((cell, column) => cell.padEnd(widths[column] ?? 0)).join('  ');

  return [
    line(header),
    widths.map((width) => '-'.repeat(width)).join('  '),
    ...rows.map(line),
  ].join('\n');
}

export function seededRandom(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
