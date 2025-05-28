import { parseCSV } from '../../src/data/parser/csv.ts';
import { groupBy } from '../../src/data/transform/aggregate.ts';
import { histogram } from '../../src/components/histogram.ts';
import { scatterPlot } from '../../src/components/scatter-plot.ts';
import { barChart } from '../../src/components/bar-chart.ts';
import { createTooltip } from '../../src/interaction/tooltip.ts';
import { attachHover } from '../../src/interaction/hover.ts';
import { categoricalSlots } from '../../src/color/schemes.ts';
import { deviation, mean } from '../../src/utils/array.ts';
import { toNumber, toStringKey } from '../../src/utils/guards.ts';
import type { Row } from '../../src/types/data.ts';
import { currentTheme, element, loadText, reportError, statTile } from '../shared/shell.ts';

async function main(): Promise<void> {
  const theme = currentTheme();
  const { dataset } = parseCSV(await loadText('../data/quality.csv'), {
    source: 'quality.csv',
  });

  const defectRates = dataset.rows.map((row) => toNumber(row.defect_rate));
  const yields = dataset.rows.map((row) => toNumber(row.yield));
  const avgDefect = mean(defectRates, (v) => v) ?? 0;
  const sigma = deviation(defectRates, (v) => v) ?? 0;
  const avgYield = mean(yields, (v) => v) ?? 0;
  const outOfSpec = defectRates.filter((value) => value > avgDefect + 2 * sigma).length;

  document
    .querySelector('#tiles')
    ?.append(
      statTile('Batches', String(dataset.rows.length)),
      statTile('Mean defect rate', `${avgDefect.toFixed(2)}%`, `σ ${sigma.toFixed(2)}`),
      statTile('Mean yield', `${avgYield.toFixed(1)}%`),
      statTile('Beyond 2σ', String(outOfSpec), 'defect rate outliers')
    );

  const distributionHost = document.querySelector('#distribution');
  const readout = document.querySelector('#bin-readout');
  if (distributionHost) {
    const chart = histogram(distributionHost, {
      data: dataset,
      field: 'defect_rate',
      binCount: 14,
      width: 500,
      height: 300,
      margin: { top: 20, right: 20, bottom: 44, left: 52 },
      xLabel: 'Defect rate (%)',
      yLabel: 'Batches',
      ariaLabel: 'Distribution of defect rate across batches',
      theme,
    });

    const describe = (): void => {
      if (readout) {
        readout.textContent = `${chart.bins().length} bins rendered`;
      }
    };
    describe();

    document.querySelector('#bins')?.addEventListener('input', (event) => {
      chart.setBinCount(Number((event.target as HTMLInputElement).value));
      describe();
    });
  }

  const correlationHost = document.querySelector('#correlation');
  if (correlationHost) {
    const chart = scatterPlot(correlationHost, {
      data: dataset,
      x: 'throughput',
      y: 'defect_rate',
      color: 'line',
      size: 'yield',
      width: 500,
      height: 300,
      margin: { top: 44, right: 20, bottom: 44, left: 52 },
      xLabel: 'Throughput (units/hour)',
      yLabel: 'Defect rate (%)',
      ariaLabel: 'Throughput against defect rate by production line',
      theme,
    });

    const lines = [...new Set(dataset.rows.map((row) => toStringKey(row.line)))];
    const palette = categoricalSlots(3, theme.mode);
    const controls = document.querySelector('#line-controls');

    lines.forEach((line, index) => {
      const button = element('button', { type: 'button', 'aria-pressed': 'true' }, [line]);
      button.style.borderLeft = `4px solid ${palette[index] ?? theme.axis}`;
      button.addEventListener('click', () => {
        chart.toggleCategory(line);
        const hidden = chart.store.get().hiddenCategories.includes(line);
        button.setAttribute('aria-pressed', hidden ? 'false' : 'true');
      });
      controls?.append(button);
    });

    const tooltip = createTooltip(correlationHost as HTMLElement, { theme });
    const space = chart.context().space;

    const hover = attachHover<Row>(chart.element, {
      points: [],
      bounds: { x: 0, y: 0, width: space.inner.width, height: space.inner.height },
      offset: { x: space.plot.x, y: space.plot.y },
      radius: 20,
      identify: (row) => toStringKey(row.batch),
    });

    const reindex = (): void => {
      const scene = chart.scene();
      if (!scene) return;
      const points: { x: number; y: number; datum: Row }[] = [];
      const walk = (node: typeof scene): void => {
        if (node.type === 'circle' && node.datum) {
          points.push({
            x: Number(node.attrs.cx),
            y: Number(node.attrs.cy),
            datum: node.datum as Row,
          });
        }
        node.children?.forEach(walk);
      };
      walk(scene);
      hover.update(points);
    };
    reindex();

    hover.on('move', (target) => {
      const row = target.datum;
      tooltip.show(
        {
          title: `Batch ${toStringKey(row.batch)}`,
          rows: [
            {
              label: toStringKey(row.line),
              value: `${toNumber(row.defect_rate).toFixed(2)}% defects`,
              color: palette[lines.indexOf(toStringKey(row.line))] ?? theme.axis,
            },
            { label: 'Throughput', value: toNumber(row.throughput).toFixed(1) },
            { label: 'Yield', value: `${toNumber(row.yield).toFixed(1)}%` },
            { label: 'Shift', value: toStringKey(row.shift) },
          ],
        },
        { x: target.point.x + space.plot.x, y: target.point.y + space.plot.y }
      );
    });

    hover.on('leave', () => {
      tooltip.hide();
    });
  }

  const yieldHost = document.querySelector('#yield');
  if (yieldHost) {
    const summary = groupBy(
      ['line', 'shift'],
      [{ as: 'yield', op: 'mean', field: 'yield' }]
    )(dataset);

    barChart(yieldHost, {
      data: summary,
      x: 'line',
      y: 'yield',
      series: 'shift',
      grouping: 'grouped',
      width: 1040,
      height: 300,
      margin: { top: 44, right: 20, bottom: 44, left: 56 },
      yLabel: 'Mean yield (%)',
      ariaLabel: 'Mean yield by production line and shift',
      theme,
    });
  }
}

main().catch((error: unknown) => {
  reportError(document.querySelector('main') ?? document.body, error);
});
