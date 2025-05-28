import { darkTheme, lightTheme, type Theme } from '../../src/color/schemes.ts';

export function currentTheme(): Theme {
  const stamped = document.documentElement.dataset.theme;
  if (stamped === 'dark') return darkTheme;
  if (stamped === 'light') return lightTheme;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? darkTheme : lightTheme;
}

export function onThemeChange(handler: (theme: Theme) => void): void {
  const query = window.matchMedia('(prefers-color-scheme: dark)');
  query.addEventListener('change', () => {
    handler(currentTheme());
  });
}

export async function loadText(path: string): Promise<string> {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`Failed to load ${path}: ${response.status}`);
  return response.text();
}

export function element<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string> = {},
  children: (Node | string)[] = []
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
  node.append(...children);
  return node;
}

export function statTile(label: string, value: string, delta?: string): HTMLElement {
  return element('div', { class: 'tile' }, [
    element('div', { class: 'label' }, [label]),
    element('div', { class: 'value' }, [value]),
    ...(delta ? [element('div', { class: 'delta' }, [delta])] : []),
  ]);
}

export function dataTable(
  headers: readonly string[],
  rows: readonly (readonly (string | number)[])[],
  numericFrom = 1
): HTMLElement {
  const head = element(
    'tr',
    {},
    headers.map((label, index) =>
      element('th', index >= numericFrom ? { class: 'num' } : {}, [label])
    )
  );

  const body = rows.map((row) =>
    element(
      'tr',
      {},
      row.map((cell, index) =>
        element('td', index >= numericFrom ? { class: 'num' } : {}, [String(cell)])
      )
    )
  );

  return element('div', { class: 'table-scroll' }, [
    element('table', { class: 'data' }, [
      element('thead', {}, [head]),
      element('tbody', {}, body),
    ]),
  ]);
}

export function reportError(host: Element, error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  host.append(element('p', { class: 'status' }, [`Could not render: ${message}`]));
}
