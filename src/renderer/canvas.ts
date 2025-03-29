import type { AttrValue, SceneNode } from './scene.ts';
import { createStats, type RenderStats, type Renderer } from './types.ts';

export interface CanvasContext2D {
  save(): void;
  restore(): void;
  translate(x: number, y: number): void;
  scale(x: number, y: number): void;
  clearRect(x: number, y: number, width: number, height: number): void;
  fillRect(x: number, y: number, width: number, height: number): void;
  strokeRect(x: number, y: number, width: number, height: number): void;
  beginPath(): void;
  closePath(): void;
  moveTo(x: number, y: number): void;
  lineTo(x: number, y: number): void;
  arc(x: number, y: number, radius: number, start: number, end: number): void;
  fill(path?: unknown): void;
  stroke(path?: unknown): void;
  fillText(text: string, x: number, y: number): void;
  fillStyle: string;
  strokeStyle: string;
  lineWidth: number;
  globalAlpha: number;
  font: string;
  textAlign: string;
  textBaseline: string;
}

export interface CanvasRendererOptions {
  readonly width: number;
  readonly height: number;
  readonly devicePixelRatio?: number;
  readonly background?: string;
  readonly pathFactory?: (d: string) => unknown;
  readonly font?: string;
}

function numberAttr(attrs: SceneNode['attrs'], key: string, fallback = 0): number {
  const value: AttrValue = attrs[key];
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value);
    return Number.isNaN(parsed) ? fallback : parsed;
  }
  return fallback;
}

function stringAttr(attrs: SceneNode['attrs'], key: string): string | undefined {
  const value: AttrValue = attrs[key];
  return typeof value === 'string' ? value : undefined;
}

export function createCanvasRenderer(
  context: CanvasContext2D,
  options: CanvasRendererOptions
): Renderer {
  const stats = createStats();
  const pathFactory =
    options.pathFactory ??
    ((d: string): unknown =>
      typeof Path2D === 'undefined' ? undefined : new Path2D(d));

  const applyPaint = (attrs: SceneNode['attrs']): { fill?: string; stroke?: string } => {
    const fill = stringAttr(attrs, 'fill');
    const stroke = stringAttr(attrs, 'stroke');
    const opacity = attrs.opacity ?? attrs['fill-opacity'];
    context.globalAlpha = typeof opacity === 'number' ? opacity : 1;
    if (fill && fill !== 'none') context.fillStyle = fill;
    if (stroke && stroke !== 'none') {
      context.strokeStyle = stroke;
      context.lineWidth = numberAttr(attrs, 'stroke-width', 1);
    }
    return {
      ...(fill === undefined ? {} : { fill }),
      ...(stroke === undefined ? {} : { stroke }),
    };
  };

  const drawNode = (node: SceneNode): void => {
    const { attrs } = node;

    if (node.type === 'group') {
      context.save();
      if (node.transform) {
        context.translate(node.transform.x, node.transform.y);
        if (node.transform.k !== 1) context.scale(node.transform.k, node.transform.k);
      }
      if (node.children) {
        for (const child of node.children) drawNode(child);
      }
      context.restore();
      return;
    }

    const paint = applyPaint(attrs);
    stats.updated++;

    switch (node.type) {
      case 'rect': {
        const x = numberAttr(attrs, 'x');
        const y = numberAttr(attrs, 'y');
        const width = numberAttr(attrs, 'width');
        const height = numberAttr(attrs, 'height');
        if (paint.fill && paint.fill !== 'none') context.fillRect(x, y, width, height);
        if (paint.stroke && paint.stroke !== 'none') context.strokeRect(x, y, width, height);
        break;
      }
      case 'circle': {
        context.beginPath();
        context.arc(
          numberAttr(attrs, 'cx'),
          numberAttr(attrs, 'cy'),
          numberAttr(attrs, 'r'),
          0,
          Math.PI * 2
        );
        context.closePath();
        if (paint.fill && paint.fill !== 'none') context.fill();
        if (paint.stroke && paint.stroke !== 'none') context.stroke();
        break;
      }
      case 'line': {
        context.beginPath();
        context.moveTo(numberAttr(attrs, 'x1'), numberAttr(attrs, 'y1'));
        context.lineTo(numberAttr(attrs, 'x2'), numberAttr(attrs, 'y2'));
        if (paint.stroke && paint.stroke !== 'none') context.stroke();
        break;
      }
      case 'path': {
        const d = stringAttr(attrs, 'd');
        if (!d) break;
        const compiled = pathFactory(d);
        if (compiled === undefined) break;
        if (paint.fill && paint.fill !== 'none') context.fill(compiled);
        if (paint.stroke && paint.stroke !== 'none') context.stroke(compiled);
        break;
      }
      case 'text': {
        if (node.text === undefined) break;
        context.font = options.font ?? '12px system-ui, sans-serif';
        context.textAlign = stringAttr(attrs, 'text-anchor') === 'middle' ? 'center' : 'left';
        context.textBaseline = 'alphabetic';
        if (paint.fill && paint.fill !== 'none') {
          context.fillText(node.text, numberAttr(attrs, 'x'), numberAttr(attrs, 'y'));
        }
        stats.textWrites++;
        break;
      }
    }
  };

  return {
    stats,

    render(scene: SceneNode): void {
      context.save();
      context.globalAlpha = 1;
      context.clearRect(0, 0, options.width, options.height);
      if (options.background) {
        context.fillStyle = options.background;
        context.fillRect(0, 0, options.width, options.height);
      }
      drawNode(scene);
      context.restore();
      stats.frames++;
    },

    resetStats(): void {
      const fresh = createStats();
      for (const key of Object.keys(fresh) as (keyof RenderStats)[]) {
        stats[key] = fresh[key];
      }
    },

    destroy(): void {
      context.clearRect(0, 0, options.width, options.height);
    },
  };
}
