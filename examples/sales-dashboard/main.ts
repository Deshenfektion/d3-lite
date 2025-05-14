import { parseCSV } from '../../src/data/parser/csv.ts';
import { parseJSON } from '../../src/data/parser/json.ts';
import { createDataset } from '../../src/data/dataset.ts';
import { groupBy } from '../../src/data/transform/aggregate.ts';
import { sortBy } from '../../src/data/transform/basics.ts';
import { pipeline } from '../../src/data/transform/pipeline.ts';
import { validateDataset } from '../../src/data/schema/validate.ts';
import { barChart } from '../../src/components/bar-chart.ts';
import { lineChart } from '../../src/components/line-chart.ts';
import { createTooltip } from '../../src/interaction/tooltip.ts';
import { attachHover } from '../../src/interaction/hover.ts';
import { formatCurrency } from '../../src/utils/format.ts';
import { categoricalSlots } from '../../src/color/schemes.ts';
import { toNumber, toStringKey } from '../../src/utils/guards.ts';
import type { Row } from '../../src/types/data.ts';
import {
  currentTheme,
  dataTable,
  element,
  loadText,
  onThemeChange,
  reportError,
  statTile,
} from '../shared/shell.ts';

const money = formatCurrency('$', 0);

async function main(): Promise<void> {
  const theme = currentTheme();

  const [salesText, targetsText] = await Promise.all([
    loadText('../data/sales.csv'),
    loadText('../data/targets.json'),
  ]);

  const { dataset: sales, issues } = parseCSV(salesText, { source: 'sales.csv' });
  const { dataset: targets } = parseJSON(targetsText, {
    path: 'targets',
    source: 'targets.json',
  });

  const validation = validateDataset(sales, [
    { name: 'region', type: 'string', nullable: false },
    { name: 'revenue', type: 'number', min: 0 },
    { name: 'segment', type: 'string' },
  ]);

  const totalRevenue = sales.rows.reduce((sum, row) => sum + toNumber(row.revenue), 0);
  const totalUnits = sales.rows.reduce((sum, row) => sum + toNumber(row.units), 0);
  const months = [...new Set(sales.rows.map((row) => toStringKey(row.month)))].sort();
  const latest = months.at(-1) ?? '';
  const previous = months.at(-2) ?? '';

  const revenueIn = (month: string): number =>
    sales.rows
      .filter((row) => toStringKey(row.month) === month)
      .reduce((sum, row) => sum + toNumber(row.revenue), 0);

  const latestRevenue = revenueIn(latest);
  const change = previous ? (latestRevenue / revenueIn(previous) - 1) * 100 : 0;

  document.querySelector('#tiles')?.append(
    statTile('Total revenue', money(totalRevenue * 1000), `${months.length} months`),
    statTile('Units shipped', totalUnits.toLocaleString('en-US')),
    statTile(
      `Revenue ${latest}`,
      money(latestRevenue * 1000),
      `${change >= 0 ? '+' : ''}${change.toFixed(1)}% vs ${previous}`
    ),
    statTile(
      'Data quality',
      validation.valid ? 'Passing' : `${validation.problems.length} issues`,
      `${issues.length} parser notes`
    )
  );

  const byRegionHost = document.querySelector('#by-region');
  if (byRegionHost) {
    const regionChart = barChart(byRegionHost, {
      data: sales,
      x: 'region',
      y: 'revenue',
      series: 'segment',
      grouping: 'stacked',
      width: 1040,
      height: 340,
      margin: { top: 44, right: 20, bottom: 44, left: 64 },
      yLabel: 'Revenue (thousands)',
      ariaLabel: 'Revenue by region, stacked by segment',
      theme,
    });

    const controls = document.querySelector('#segment-controls');
    const segments = [...new Set(sales.rows.map((row) => toStringKey(row.segment)))];
    const palette = categoricalSlots(segments.length, theme.mode);

    segments.forEach((segment, index) => {
      const button = element('button', { type: 'button', 'aria-pressed': 'true' }, [segment]);
      button.style.borderLeft = `4px solid ${palette[index] ?? theme.axis}`;
      button.addEventListener('click', () => {
        regionChart.toggleSeries(segment);
        const hidden = regionChart.store.get().hiddenSeries.includes(segment);
        button.setAttribute('aria-pressed', hidden ? 'false' : 'true');
      });
      controls?.append(button);
    });

    onThemeChange((next) => {
      regionChart.setTheme(next);
    });
  }

  const monthlyHost = document.querySelector('#monthly');
  if (monthlyHost) {
    const monthly = pipeline(
      groupBy(
        ['month', 'region'],
        [{ as: 'revenue', op: 'sum', field: 'revenue' }]
      ),
      sortBy(['month'])
    )(sales);

    const monthIndex = new Map(months.map((month, index) => [month, index]));
    const indexed = createDataset(
      monthly.rows.map((row) => ({
        ...row,
        monthIndex: monthIndex.get(toStringKey(row.month)) ?? 0,
      }))
    );

    const chart = lineChart(monthlyHost, {
      data: indexed,
      x: 'monthIndex',
      y: 'revenue',
      series: 'region',
      width: 500,
      height: 300,
      margin: { top: 44, right: 20, bottom: 40, left: 60 },
      yLabel: 'Revenue (thousands)',
      showPoints: true,
      ariaLabel: 'Monthly revenue by region',
      theme,
    });

    const tooltip = createTooltip(monthlyHost as HTMLElement, { theme });
    const space = chart.context().space;
    const palette = categoricalSlots(4, theme.mode);
    const regions = [...new Set(indexed.rows.map((row) => toStringKey(row.region)))];

    const hover = attachHover<Row>(chart.element, {
      bounds: { x: 0, y: 0, width: space.inner.width, height: space.inner.height },
      offset: { x: space.plot.x, y: space.plot.y },
      radius: 26,
      identify: (row) => `${toStringKey(row.month)}-${toStringKey(row.region)}`,
      points: [],
    });

    const rebuildIndex = (): void => {
      const nodes: { x: number; y: number; datum: Row }[] = [];
      const scene = chart.scene();
      if (!scene) return;
      const walk = (node: typeof scene): void => {
        if (node.type === 'circle' && node.datum) {
          nodes.push({
            x: Number(node.attrs.cx),
            y: Number(node.attrs.cy),
            datum: node.datum as Row,
          });
        }
        node.children?.forEach(walk);
      };
      walk(scene);
      hover.update(nodes);
    };
    rebuildIndex();

    hover.on('move', (target) => {
      const region = toStringKey(target.datum.region);
      tooltip.show(
        {
          title: toStringKey(target.datum.month),
          rows: [
            {
              label: region,
              value: money(toNumber(target.datum.revenue) * 1000),
              color: palette[regions.indexOf(region)] ?? theme.axis,
            },
          ],
        },
        { x: target.point.x + space.plot.x, y: target.point.y + space.plot.y }
      );
    });
    hover.on('leave', () => {
      tooltip.hide();
    });
  }

  const attainmentHost = document.querySelector('#attainment');
  if (attainmentHost) {
    const actuals = groupBy(['region'], [{ as: 'revenue', op: 'sum', field: 'revenue' }])(sales);
    const targetBy = new Map(
      targets.rows.map((row) => [toStringKey(row.region), toNumber(row.quarterlyTarget)])
    );

    const attainment = createDataset(
      actuals.rows.map((row) => {
        const region = toStringKey(row.region);
        const quarterlyActual = toNumber(row.revenue) / 4;
        const target = targetBy.get(region) ?? 0;
        return {
          region,
          attainment: target === 0 ? 0 : Math.round((quarterlyActual / target) * 1000) / 10,
        };
      })
    );

    barChart(attainmentHost, {
      data: attainment,
      x: 'region',
      y: 'attainment',
      horizontal: true,
      showValues: true,
      width: 500,
      height: 300,
      margin: { top: 20, right: 56, bottom: 40, left: 72 },
      xLabel: 'Attainment (%)',
      ariaLabel: 'Quarterly attainment against target by region',
      theme,
    });
  }

  const tableHost = document.querySelector('#table');
  if (tableHost) {
    const summary = pipeline(
      groupBy(
        ['region', 'segment'],
        [
          { as: 'revenue', op: 'sum', field: 'revenue' },
          { as: 'units', op: 'sum', field: 'units' },
        ]
      ),
      sortBy([{ field: 'revenue', direction: 'desc' }])
    )(sales);

    tableHost.append(
      dataTable(
        ['Region', 'Segment', 'Revenue', 'Units'],
        summary.rows.map((row) => [
          toStringKey(row.region),
          toStringKey(row.segment),
          money(toNumber(row.revenue) * 1000),
          toNumber(row.units).toLocaleString('en-US'),
        ]),
        2
      )
    );
  }
}

main().catch((error: unknown) => {
  reportError(document.querySelector('main') ?? document.body, error);
});
