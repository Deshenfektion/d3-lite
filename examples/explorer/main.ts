import { parse } from '../../src/data/parser/index.ts';
import { fieldsOfType } from '../../src/data/schema/infer.ts';
import { limit } from '../../src/data/transform/basics.ts';
import { barChart } from '../../src/components/bar-chart.ts';
import { lineChart } from '../../src/components/line-chart.ts';
import { scatterPlot } from '../../src/components/scatter-plot.ts';
import { histogram } from '../../src/components/histogram.ts';
import type { Chart } from '../../src/components/chart.ts';
import type { Dataset } from '../../src/types/data.ts';
import { toStringKey } from '../../src/utils/guards.ts';
import { currentTheme, dataTable, element, loadText, reportError } from '../shared/shell.ts';

type ChartKind = 'bar' | 'line' | 'scatter' | 'histogram';

const theme = currentTheme();

let dataset: Dataset | undefined;
let active: Chart<object> | undefined;

const select = (id: string): HTMLSelectElement =>
  document.querySelector(`#${id}`) as HTMLSelectElement;

function fillOptions(
  target: HTMLSelectElement,
  values: readonly string[],
  allowNone = false
): void {
  const previous = target.value;
  target.replaceChildren();
  if (allowNone) target.append(element('option', { value: '' }, ['(none)']));
  for (const value of values) target.append(element('option', { value }, [value]));
  if (values.includes(previous)) target.value = previous;
}

function describeSchema(source: Dataset): string {
  const parts = source.schema.fields.map(
    (field) => `${field.name}: ${field.type}${field.nullable ? '?' : ''}`
  );
  return `${source.schema.rowCount} rows · ${parts.join(' · ')}`;
}

function rebuildFieldChoices(source: Dataset): void {
  const numeric = fieldsOfType(source.schema, 'number');
  const categorical = [
    ...fieldsOfType(source.schema, 'string'),
    ...fieldsOfType(source.schema, 'boolean'),
  ];
  const kind = select('kind').value as ChartKind;

  const xChoices =
    kind === 'scatter' || kind === 'line'
      ? [...numeric, ...categorical]
      : [...categorical, ...numeric];
  fillOptions(select('x'), kind === 'histogram' ? numeric : xChoices);
  fillOptions(select('y'), numeric);
  fillOptions(select('series'), categorical, true);

  select('y').disabled = kind === 'histogram';
  select('series').disabled = kind === 'histogram';
}

function render(): void {
  const host = document.querySelector('#chart');
  if (!host || !dataset) return;

  active?.destroy();
  host.replaceChildren();

  const kind = select('kind').value as ChartKind;
  const x = select('x').value;
  const y = select('y').value;
  const series = select('series').value || undefined;

  const base = {
    width: 1040,
    height: 340,
    margin: { top: 44, right: 24, bottom: 48, left: 64 },
    theme,
    xLabel: x,
    yLabel: kind === 'histogram' ? 'Count' : y,
  };

  try {
    if (kind === 'histogram') {
      active = histogram(host, {
        ...base,
        data: dataset,
        field: x,
        ariaLabel: `Distribution of ${x}`,
      }) as unknown as Chart<object>;
    } else if (kind === 'line') {
      active = lineChart(host, {
        ...base,
        data: dataset,
        x,
        y,
        ...(series ? { series } : {}),
        showPoints: dataset.rows.length <= 120,
        ariaLabel: `${y} against ${x}`,
      }) as unknown as Chart<object>;
    } else if (kind === 'scatter') {
      active = scatterPlot(host, {
        ...base,
        data: dataset,
        x,
        y,
        ...(series ? { color: series } : {}),
        ariaLabel: `${y} against ${x}`,
      }) as unknown as Chart<object>;
    } else {
      active = barChart(host, {
        ...base,
        data: dataset,
        x,
        y,
        ...(series ? { series } : {}),
        ariaLabel: `${y} by ${x}`,
      }) as unknown as Chart<object>;
    }
  } catch (error) {
    reportError(host, error);
  }

  const tableHost = document.querySelector('#table');
  if (tableHost) {
    const preview = limit(50)(dataset);
    const headers = dataset.schema.fields.map((field) => field.name);
    tableHost.replaceChildren(
      dataTable(
        headers,
        preview.rows.map((row) => headers.map((name) => toStringKey(row[name]))),
        1
      )
    );
  }
}

function adopt(source: Dataset): void {
  dataset = source;
  const status = document.querySelector('#schema');
  if (status) status.textContent = describeSchema(source);
  rebuildFieldChoices(source);
  render();
}

async function loadSource(path: string): Promise<void> {
  const text = await loadText(path);
  const { dataset: parsed } = parse(text, {
    source: path,
    ...(path.endsWith('.json') ? { path: 'targets' } : {}),
  });
  adopt(parsed);
}

async function main(): Promise<void> {
  await loadSource(select('source').value);

  select('source').addEventListener('change', () => {
    void loadSource(select('source').value);
  });

  select('kind').addEventListener('change', () => {
    if (dataset) rebuildFieldChoices(dataset);
    render();
  });

  for (const id of ['x', 'y', 'series']) {
    select(id).addEventListener('change', render);
  }

  document.querySelector('#load-paste')?.addEventListener('click', () => {
    const text = (document.querySelector('#paste') as HTMLTextAreaElement).value.trim();
    if (text === '') return;
    const { dataset: parsed, issues } = parse(text, { source: 'pasted' });
    if (parsed.rows.length === 0) {
      const status = document.querySelector('#schema');
      if (status) {
        status.textContent = issues[0]?.message ?? 'Nothing could be parsed from that input';
      }
      return;
    }
    adopt(parsed);
  });
}

main().catch((error: unknown) => {
  reportError(document.querySelector('main') ?? document.body, error);
});
