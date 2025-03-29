import { describe, expect, it } from 'vitest';
import { createCanvasRenderer, type CanvasContext2D } from '@/renderer/canvas.ts';
import { circle, group, line, path, rect, text } from '@/renderer/scene.ts';

interface Call {
  readonly name: string;
  readonly args: readonly unknown[];
}

function recordingContext(): { context: CanvasContext2D; calls: Call[] } {
  const calls: Call[] = [];
  const record =
    (name: string) =>
    (...args: unknown[]): void => {
      calls.push({ name, args });
    };

  const context: CanvasContext2D = {
    save: record('save'),
    restore: record('restore'),
    translate: record('translate'),
    scale: record('scale'),
    clearRect: record('clearRect'),
    fillRect: record('fillRect'),
    strokeRect: record('strokeRect'),
    beginPath: record('beginPath'),
    closePath: record('closePath'),
    moveTo: record('moveTo'),
    lineTo: record('lineTo'),
    arc: record('arc'),
    fill: record('fill'),
    stroke: record('stroke'),
    fillText: record('fillText'),
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    globalAlpha: 1,
    font: '',
    textAlign: '',
    textBaseline: '',
  };

  return { context, calls };
}

const options = { width: 200, height: 100, pathFactory: (d: string) => d };

describe('createCanvasRenderer', () => {
  it('clears the surface on every frame', () => {
    const { context, calls } = recordingContext();
    const renderer = createCanvasRenderer(context, options);
    renderer.render(group({ key: 'root' }));
    expect(calls.some((call) => call.name === 'clearRect')).toBe(true);
  });

  it('fills rectangles', () => {
    const { context, calls } = recordingContext();
    createCanvasRenderer(context, options).render(
      group({ key: 'root' }, [rect('a', { x: 1, y: 2, width: 3, height: 4, fill: '#2a78d6' })])
    );
    expect(calls.find((call) => call.name === 'fillRect')?.args).toEqual([1, 2, 3, 4]);
  });

  it('skips fills marked none', () => {
    const { context, calls } = recordingContext();
    createCanvasRenderer(context, options).render(
      group({ key: 'root' }, [rect('a', { width: 3, height: 4, fill: 'none' })])
    );
    expect(calls.some((call) => call.name === 'fillRect')).toBe(false);
  });

  it('draws circles as arcs', () => {
    const { context, calls } = recordingContext();
    createCanvasRenderer(context, options).render(
      group({ key: 'root' }, [circle('c', { cx: 10, cy: 20, r: 5, fill: '#000' })])
    );
    const arc = calls.find((call) => call.name === 'arc');
    expect(arc?.args.slice(0, 3)).toEqual([10, 20, 5]);
  });

  it('strokes lines', () => {
    const { context, calls } = recordingContext();
    createCanvasRenderer(context, options).render(
      group({ key: 'root' }, [line('l', { x1: 0, y1: 0, x2: 10, y2: 10, stroke: '#000' })])
    );
    expect(calls.some((call) => call.name === 'moveTo')).toBe(true);
    expect(calls.some((call) => call.name === 'stroke')).toBe(true);
  });

  it('compiles path data through the path factory', () => {
    const { context, calls } = recordingContext();
    createCanvasRenderer(context, options).render(
      group({ key: 'root' }, [path('p', { d: 'M0,0L5,5', stroke: '#000' })])
    );
    expect(calls.find((call) => call.name === 'stroke')?.args).toEqual(['M0,0L5,5']);
  });

  it('draws text', () => {
    const { context, calls } = recordingContext();
    createCanvasRenderer(context, options).render(
      group({ key: 'root' }, [text('t', 'Revenue', { x: 4, y: 8, fill: '#000' })])
    );
    expect(calls.find((call) => call.name === 'fillText')?.args).toEqual(['Revenue', 4, 8]);
  });

  it('applies group transforms inside a save and restore pair', () => {
    const { context, calls } = recordingContext();
    createCanvasRenderer(context, options).render(
      group({ key: 'root' }, [
        group({ key: 'plot', transform: { x: 40, y: 10, k: 2 } }, [
          rect('a', { width: 1, height: 1, fill: '#000' }),
        ]),
      ])
    );
    const names = calls.map((call) => call.name);
    expect(calls.find((call) => call.name === 'translate')?.args).toEqual([40, 10]);
    expect(calls.find((call) => call.name === 'scale')?.args).toEqual([2, 2]);
    expect(names.filter((name) => name === 'save').length).toBe(
      names.filter((name) => name === 'restore').length
    );
  });

  it('renders the same scene the svg renderer accepts', () => {
    const { context, calls } = recordingContext();
    const renderer = createCanvasRenderer(context, options);
    const scene = group({ key: 'root' }, [
      rect('bar-0', { x: 0, y: 0, width: 10, height: 20, fill: '#2a78d6' }),
      rect('bar-1', { x: 12, y: 0, width: 10, height: 30, fill: '#eb6834' }),
    ]);
    renderer.render(scene);
    expect(calls.filter((call) => call.name === 'fillRect')).toHaveLength(2);
    expect(renderer.stats.frames).toBe(1);
  });

  it('resets stats on request', () => {
    const { context } = recordingContext();
    const renderer = createCanvasRenderer(context, options);
    renderer.render(group({ key: 'root' }, [rect('a', { fill: '#000' })]));
    expect(renderer.stats.updated).toBe(1);
    renderer.resetStats();
    expect(renderer.stats.updated).toBe(0);
  });
});
