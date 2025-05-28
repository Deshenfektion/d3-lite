import { parseCSV } from '../../src/data/parser/csv.ts';
import { createDataset } from '../../src/data/dataset.ts';
import { fold } from '../../src/data/transform/reshape.ts';
import { lineChart } from '../../src/components/line-chart.ts';
import { attachBrush, selectionToDomain } from '../../src/interaction/brush.ts';
import { scaleLinear } from '../../src/scales/linear.ts';
import { formatSI, formatTime } from '../../src/utils/format.ts';
import { mean, quantile } from '../../src/utils/array.ts';
import { toNumber } from '../../src/utils/guards.ts';
import type { Row } from '../../src/types/data.ts';
import { currentTheme, loadText, reportError, statTile } from '../shared/shell.ts';

const si = formatSI(1);
const hourLabel = formatTime('hour');

async function main(): Promise<void> {
  const theme = currentTheme();
  const { dataset } = parseCSV(await loadText('../data/traffic.csv'), {
    source: 'traffic.csv',
  });

  const withTime = createDataset(
    dataset.rows.map((row) => ({
      ...row,
      t: toNumber(row.timestamp),
    }))
  );

  const p50 = withTime.rows.map((row) => toNumber(row.latency_p50));
  const p95 = withTime.rows.map((row) => toNumber(row.latency_p95));
  const requests = withTime.rows.map((row) => toNumber(row.requests));

  document
    .querySelector('#tiles')
    ?.append(
      statTile('Samples', String(withTime.rows.length), '30 minute buckets'),
      statTile('Median p50', `${(mean(p50, (v) => v) ?? 0).toFixed(1)} ms`),
      statTile('Peak p95', `${Math.max(...p95).toFixed(0)} ms`),
      statTile('Total requests', si(requests.reduce((sum, value) => sum + value, 0)))
    );

  let range: [number, number] | undefined;
  let liveTimer = 0;
  let liveRows: Row[] = [...withTime.rows];

  const inRange = (rows: readonly Row[]): Row[] =>
    range === undefined
      ? [...rows]
      : rows.filter((row) => {
          const t = toNumber(row.t);
          return t >= range![0] && t <= range![1];
        });

  const latencyHost = document.querySelector('#latency');
  const volumeHost = document.querySelector('#volume');
  const errorHost = document.querySelector('#errors');
  const readout = document.querySelector('#range-readout');

  const latencyRows = (rows: readonly Row[]): Row[] =>
    fold({
      fields: ['latency_p50', 'latency_p95'],
      keep: ['t'],
      as: { key: 'percentile', value: 'latency' },
    })(createDataset(inRange(rows))).rows.map((row) => ({
      ...row,
      percentile: row.percentile === 'latency_p50' ? 'p50' : 'p95',
    }));

  const latency = latencyHost
    ? lineChart(latencyHost, {
        data: latencyRows(liveRows),
        x: 't',
        y: 'latency',
        series: 'percentile',
        temporal: true,
        width: 1040,
        height: 320,
        margin: { top: 44, right: 20, bottom: 40, left: 60 },
        yLabel: 'Latency (ms)',
        ariaLabel: 'Request latency percentiles over time',
        theme,
      })
    : undefined;

  const volume = volumeHost
    ? lineChart(volumeHost, {
        data: inRange(liveRows),
        x: 't',
        y: 'requests',
        temporal: true,
        area: true,
        width: 1040,
        height: 220,
        margin: { top: 20, right: 20, bottom: 40, left: 60 },
        yLabel: 'Requests',
        ariaLabel: 'Request volume over time',
        theme,
      })
    : undefined;

  const errors = errorHost
    ? lineChart(errorHost, {
        data: inRange(liveRows),
        x: 't',
        y: 'error_rate',
        temporal: true,
        area: true,
        width: 1040,
        height: 220,
        margin: { top: 20, right: 20, bottom: 40, left: 60 },
        yLabel: 'Error rate (%)',
        ariaLabel: 'Error rate over time',
        theme,
      })
    : undefined;

  const refresh = (): void => {
    latency?.setData(latencyRows(liveRows));
    volume?.setData(inRange(liveRows));
    errors?.setData(inRange(liveRows));
    if (readout) {
      readout.textContent =
        range === undefined
          ? `Showing all ${liveRows.length} samples`
          : `${hourLabel(range[0])} to ${hourLabel(range[1])} · ${inRange(liveRows).length} samples`;
    }
  };
  refresh();

  if (volume && volumeHost) {
    const space = volume.context().space;
    const times = withTime.rows.map((row) => toNumber(row.t));
    const timeScale = scaleLinear({
      domain: [Math.min(...times), Math.max(...times)],
      range: [0, space.inner.width],
    });

    const brush = attachBrush(volume.element, {
      axis: 'x',
      minSize: 6,
      extent: {
        x: space.plot.x,
        y: space.plot.y,
        width: space.inner.width,
        height: space.inner.height,
      },
    });

    brush.on('end', (selection) => {
      const shifted = { ...selection.rect, x: selection.rect.x - space.plot.x };
      range = selectionToDomain(shifted, timeScale, 'x');
      refresh();
    });

    brush.on('clear', () => {
      range = undefined;
      refresh();
    });
  }

  document.querySelector('#reset')?.addEventListener('click', () => {
    range = undefined;
    refresh();
  });

  document.querySelector('#live')?.addEventListener('click', (event) => {
    const button = event.currentTarget as HTMLButtonElement;
    const running = button.getAttribute('aria-pressed') === 'true';

    if (running) {
      clearInterval(liveTimer);
      liveTimer = 0;
      button.setAttribute('aria-pressed', 'false');
      button.textContent = 'Start live feed';
      return;
    }

    button.setAttribute('aria-pressed', 'true');
    button.textContent = 'Stop live feed';
    liveTimer = window.setInterval(() => {
      const previous = liveRows.at(-1);
      if (!previous) return;
      const nextT = toNumber(previous.t) + 30 * 60 * 1000;
      const drift = (Math.random() - 0.45) * 8;
      liveRows = [
        ...liveRows.slice(1),
        {
          timestamp: new Date(nextT).toISOString(),
          t: nextT,
          requests: Math.max(80, toNumber(previous.requests) + (Math.random() - 0.5) * 180),
          latency_p50: Math.max(15, toNumber(previous.latency_p50) + drift),
          latency_p95: Math.max(40, toNumber(previous.latency_p95) + drift * 2.4),
          error_rate: Math.max(0, toNumber(previous.error_rate) + (Math.random() - 0.5) * 0.2),
        },
      ];
      refresh();
    }, 1000);
  });

  const p95Peak = quantile(p95, 0.99, (v) => v) ?? 0;
  if (readout && p95Peak > 0) refresh();
}

main().catch((error: unknown) => {
  reportError(document.querySelector('main') ?? document.body, error);
});
