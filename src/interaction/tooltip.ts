import type { Point } from '../types/geometry.ts';
import type { Theme } from '../color/schemes.ts';

export interface TooltipRow {
  readonly label: string;
  readonly value: string;
  readonly color?: string;
}

export interface TooltipContent {
  readonly title?: string;
  readonly rows: readonly TooltipRow[];
}

export interface TooltipOptions {
  readonly theme: Theme;
  readonly offset?: Point;
  readonly className?: string;
}

export interface Tooltip {
  show(content: TooltipContent, at: Point): void;
  hide(): void;
  visible(): boolean;
  element: HTMLDivElement;
  destroy(): void;
}

const EDGE_PADDING = 8;

export function createTooltip(container: HTMLElement, options: TooltipOptions): Tooltip {
  const { theme } = options;
  const offset = options.offset ?? { x: 12, y: 12 };

  const element = document.createElement('div');
  element.className = options.className ?? 'd3l-tooltip';
  element.setAttribute('role', 'tooltip');
  element.style.position = 'absolute';
  element.style.pointerEvents = 'none';
  element.style.opacity = '0';
  element.style.zIndex = '10';
  element.style.padding = '8px 10px';
  element.style.borderRadius = '6px';
  element.style.font = '12px system-ui, -apple-system, "Segoe UI", sans-serif';
  element.style.background = theme.surface;
  element.style.color = theme.textPrimary;
  element.style.border = `1px solid ${theme.border}`;
  element.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.12)';
  element.style.transition = 'opacity 90ms ease-out';
  element.style.maxWidth = '260px';

  if (getComputedStyle(container).position === 'static') {
    container.style.position = 'relative';
  }
  container.appendChild(element);

  let isVisible = false;

  const render = (content: TooltipContent): void => {
    element.replaceChildren();

    if (content.title) {
      const title = document.createElement('div');
      title.textContent = content.title;
      title.style.fontWeight = '600';
      title.style.marginBottom = content.rows.length > 0 ? '4px' : '0';
      element.appendChild(title);
    }

    for (const row of content.rows) {
      const line = document.createElement('div');
      line.style.display = 'flex';
      line.style.alignItems = 'center';
      line.style.gap = '6px';
      line.style.whiteSpace = 'nowrap';

      if (row.color) {
        const swatch = document.createElement('span');
        swatch.style.width = '8px';
        swatch.style.height = '8px';
        swatch.style.borderRadius = '2px';
        swatch.style.flex = '0 0 auto';
        swatch.style.background = row.color;
        line.appendChild(swatch);
      }

      const label = document.createElement('span');
      label.textContent = row.label;
      label.style.color = theme.textSecondary;
      line.appendChild(label);

      const value = document.createElement('span');
      value.textContent = row.value;
      value.style.marginLeft = 'auto';
      value.style.fontVariantNumeric = 'tabular-nums';
      line.appendChild(value);

      element.appendChild(line);
    }
  };

  const position = (at: Point): void => {
    const bounds = container.getBoundingClientRect();
    const width = element.offsetWidth || 140;
    const height = element.offsetHeight || 48;

    let x = at.x + offset.x;
    let y = at.y + offset.y;

    if (x + width + EDGE_PADDING > bounds.width) x = at.x - width - offset.x;
    if (y + height + EDGE_PADDING > bounds.height) y = at.y - height - offset.y;

    element.style.left = `${Math.max(EDGE_PADDING, x)}px`;
    element.style.top = `${Math.max(EDGE_PADDING, y)}px`;
  };

  return {
    element,

    show(content: TooltipContent, at: Point): void {
      render(content);
      position(at);
      element.style.opacity = '1';
      isVisible = true;
    },

    hide(): void {
      element.style.opacity = '0';
      isVisible = false;
    },

    visible(): boolean {
      return isVisible;
    },

    destroy(): void {
      element.remove();
      isVisible = false;
    },
  };
}
