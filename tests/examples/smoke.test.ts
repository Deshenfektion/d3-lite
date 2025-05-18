import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setScheduler } from '@/state/signal.ts';

function readExample(path: string): string {
  return readFileSync(resolve(process.cwd(), 'examples', path), 'utf8');
}

function mountMarkup(htmlPath: string): void {
  const html = readExample(htmlPath);
  const body = /<body>([\s\S]*?)<\/body>/.exec(html)?.[1] ?? '';
  document.body.innerHTML = body.replace(/<script[\s\S]*?<\/script>/g, '');
}

function installFetch(): void {
  vi.stubGlobal(
    'fetch',
    vi.fn((input: string) => {
      const name = String(input).replace(/^.*\/data\//, '');
      const text = readExample(`data/${name}`);
      return Promise.resolve({ ok: true, status: 200, text: () => Promise.resolve(text) });
    })
  );
}

async function settle(): Promise<void> {
  for (let i = 0; i < 12; i++) await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
  for (let i = 0; i < 12; i++) await Promise.resolve();
}

beforeEach(() => {
  setScheduler((flush) => {
    flush();
  });
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }))
  );
  installFetch();
  vi.resetModules();
});

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.innerHTML = '';
});

describe('sales dashboard example', () => {
  it('renders every chart without runtime errors', async () => {
    mountMarkup('sales-dashboard/index.html');
    await import('../../examples/sales-dashboard/main.ts');
    await settle();

    expect(document.querySelector('#by-region svg')).not.toBeNull();
    expect(document.querySelector('#monthly svg')).not.toBeNull();
    expect(document.querySelector('#attainment svg')).not.toBeNull();
    expect(document.querySelectorAll('#tiles .tile')).toHaveLength(4);
    expect(document.querySelector('#table table')).not.toBeNull();
    expect(document.body.textContent).not.toContain('Could not render');
  });

  it('offers one legend toggle per segment', async () => {
    mountMarkup('sales-dashboard/index.html');
    await import('../../examples/sales-dashboard/main.ts');
    await settle();

    const buttons = document.querySelectorAll('#segment-controls button');
    expect(buttons).toHaveLength(3);

    const before = document.querySelectorAll('#by-region path').length;
    (buttons[0] as HTMLButtonElement).click();
    await settle();

    expect(buttons[0]!.getAttribute('aria-pressed')).toBe('false');
    expect(document.querySelectorAll('#by-region path').length).toBeLessThan(before);
  });
});

describe('quality metrics example', () => {
  it('renders the distribution, correlation and yield charts', async () => {
    mountMarkup('quality-metrics/index.html');
    await import('../../examples/quality-metrics/main.ts');
    await settle();

    expect(document.querySelector('#distribution svg')).not.toBeNull();
    expect(document.querySelector('#correlation svg')).not.toBeNull();
    expect(document.querySelector('#yield svg')).not.toBeNull();
    expect(document.querySelectorAll('#correlation circle').length).toBeGreaterThan(100);
    expect(document.body.textContent).not.toContain('Could not render');
  });

  it('rebins the histogram from the slider', async () => {
    mountMarkup('quality-metrics/index.html');
    await import('../../examples/quality-metrics/main.ts');
    await settle();

    const before = document.querySelectorAll('#distribution path').length;
    const slider = document.querySelector('#bins') as HTMLInputElement;
    slider.value = '36';
    slider.dispatchEvent(new Event('input', { bubbles: true }));
    await settle();

    expect(document.querySelectorAll('#distribution path').length).not.toBe(before);
  });
});

describe('time series example', () => {
  it('renders the latency, volume and error charts', async () => {
    mountMarkup('time-series/index.html');
    await import('../../examples/time-series/main.ts');
    await settle();

    expect(document.querySelector('#latency svg')).not.toBeNull();
    expect(document.querySelector('#volume svg')).not.toBeNull();
    expect(document.querySelector('#errors svg')).not.toBeNull();
    expect(document.querySelector('#range-readout')?.textContent).toContain('samples');
    expect(document.body.textContent).not.toContain('Could not render');
  });
});

describe('explorer example', () => {
  it('infers a schema and renders a default chart', async () => {
    mountMarkup('explorer/index.html');
    await import('../../examples/explorer/main.ts');
    await settle();

    expect(document.querySelector('#chart svg')).not.toBeNull();
    expect(document.querySelector('#schema')?.textContent).toContain('rows');
    expect(document.querySelector('#table table')).not.toBeNull();
    expect(document.body.textContent).not.toContain('Could not render');
  });

  it('rebuilds the chart when the type changes', async () => {
    mountMarkup('explorer/index.html');
    await import('../../examples/explorer/main.ts');
    await settle();

    const kind = document.querySelector('#kind') as HTMLSelectElement;
    kind.value = 'histogram';
    kind.dispatchEvent(new Event('change', { bubbles: true }));
    await settle();

    expect(document.querySelector('#chart svg')).not.toBeNull();
    expect(document.body.textContent).not.toContain('Could not render');
  });

  it('accepts pasted data', async () => {
    mountMarkup('explorer/index.html');
    await import('../../examples/explorer/main.ts');
    await settle();

    const paste = document.querySelector('#paste') as HTMLTextAreaElement;
    paste.value = 'city,people\nBerlin,3.6\nHamburg,1.9';
    (document.querySelector('#load-paste') as HTMLButtonElement).click();
    await settle();

    expect(document.querySelector('#schema')?.textContent).toContain('2 rows');
    expect(document.querySelector('#chart svg')).not.toBeNull();
  });
});
