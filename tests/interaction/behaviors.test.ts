import { beforeEach, describe, expect, it, vi } from 'vitest';
import { attachHover } from '@/interaction/hover.ts';
import { attachPointer, localPoint } from '@/interaction/pointer.ts';
import { createTooltip } from '@/interaction/tooltip.ts';
import { attachZoom, zoomAtPoint } from '@/interaction/zoom.ts';
import { attachBrush, normalizeRect, selectionToDomain } from '@/interaction/brush.ts';
import { identityZoom } from '@/coords/transform.ts';
import { scaleLinear } from '@/scales/linear.ts';
import { lightTheme } from '@/color/schemes.ts';

let host: HTMLDivElement;

const BOUNDS = { x: 0, y: 0, width: 200, height: 100 };

beforeEach(() => {
  document.body.innerHTML = '';
  host = document.createElement('div');
  document.body.appendChild(host);
  host.getBoundingClientRect = () =>
    ({ left: 0, top: 0, width: 200, height: 100, right: 200, bottom: 100 }) as DOMRect;
});

function pointerEvent(type: string, x: number, y: number): Event {
  const event = new Event(type, { bubbles: true });
  Object.defineProperty(event, 'clientX', { value: x });
  Object.defineProperty(event, 'clientY', { value: y });
  return event;
}

describe('localPoint', () => {
  it('converts client coordinates into element space', () => {
    expect(localPoint(host, { clientX: 30, clientY: 40 })).toEqual({ x: 30, y: 40 });
  });
});

describe('attachPointer', () => {
  it('emits move events with local coordinates', () => {
    const pointer = attachPointer(host);
    const spy = vi.fn();
    pointer.on('move', spy);

    host.dispatchEvent(pointerEvent('pointermove', 20, 30));

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0]![0].point).toEqual({ x: 20, y: 30 });
  });

  it('subtracts a plot offset from local coordinates', () => {
    const pointer = attachPointer(host, { offset: { x: 10, y: 5 } });
    const spy = vi.fn();
    pointer.on('move', spy);

    host.dispatchEvent(pointerEvent('pointermove', 20, 30));

    expect(spy.mock.calls[0]![0].local).toEqual({ x: 10, y: 25 });
  });

  it('drops moves below the threshold', () => {
    const pointer = attachPointer(host, { moveThreshold: 10 });
    const spy = vi.fn();
    pointer.on('move', spy);

    host.dispatchEvent(pointerEvent('pointermove', 20, 20));
    host.dispatchEvent(pointerEvent('pointermove', 22, 22));
    host.dispatchEvent(pointerEvent('pointermove', 60, 60));

    expect(spy).toHaveBeenCalledTimes(2);
  });

  it('stops listening after detach', () => {
    const pointer = attachPointer(host);
    const spy = vi.fn();
    pointer.on('move', spy);
    pointer.detach();

    host.dispatchEvent(pointerEvent('pointermove', 20, 30));
    expect(spy).not.toHaveBeenCalled();
  });
});

describe('attachHover', () => {
  const points = [
    { x: 10, y: 10, datum: { id: 'a' } },
    { x: 100, y: 50, datum: { id: 'b' } },
  ];

  it('emits enter when the pointer nears a mark', () => {
    const hover = attachHover(host, {
      points,
      bounds: BOUNDS,
      identify: (datum) => datum.id,
    });
    const spy = vi.fn();
    hover.on('enter', spy);

    host.dispatchEvent(pointerEvent('pointermove', 12, 12));

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0]![0].datum).toEqual({ id: 'a' });
  });

  it('does not re-emit enter while staying on the same mark', () => {
    const hover = attachHover(host, {
      points,
      bounds: BOUNDS,
      identify: (datum) => datum.id,
    });
    const enter = vi.fn();
    const move = vi.fn();
    hover.on('enter', enter);
    hover.on('move', move);

    host.dispatchEvent(pointerEvent('pointermove', 12, 12));
    host.dispatchEvent(pointerEvent('pointermove', 14, 14));

    expect(enter).toHaveBeenCalledTimes(1);
    expect(move).toHaveBeenCalledTimes(2);
  });

  it('emits enter again when crossing to another mark', () => {
    const hover = attachHover(host, {
      points,
      bounds: BOUNDS,
      identify: (datum) => datum.id,
    });
    const spy = vi.fn();
    hover.on('enter', spy);

    host.dispatchEvent(pointerEvent('pointermove', 12, 12));
    host.dispatchEvent(pointerEvent('pointermove', 100, 50));

    expect(spy).toHaveBeenCalledTimes(2);
  });

  it('emits leave when moving beyond the radius', () => {
    const hover = attachHover(host, {
      points,
      bounds: BOUNDS,
      radius: 15,
      identify: (datum) => datum.id,
    });
    const spy = vi.fn();
    hover.on('leave', spy);

    host.dispatchEvent(pointerEvent('pointermove', 12, 12));
    host.dispatchEvent(pointerEvent('pointermove', 60, 90));

    expect(spy).toHaveBeenCalledTimes(1);
    expect(hover.current()).toBeUndefined();
  });

  it('emits select on click', () => {
    const hover = attachHover(host, {
      points,
      bounds: BOUNDS,
      identify: (datum) => datum.id,
    });
    const spy = vi.fn();
    hover.on('select', spy);

    host.dispatchEvent(pointerEvent('click', 10, 10));

    expect(spy.mock.calls[0]![0].datum).toEqual({ id: 'a' });
  });

  it('rebuilds its index when points change', () => {
    const hover = attachHover(host, {
      points,
      bounds: BOUNDS,
      identify: (datum) => datum.id,
    });
    hover.update([{ x: 150, y: 80, datum: { id: 'c' } }]);
    expect(hover.tree().size()).toBe(1);

    const spy = vi.fn();
    hover.on('enter', spy);
    host.dispatchEvent(pointerEvent('pointermove', 150, 80));
    expect(spy.mock.calls[0]![0].datum).toEqual({ id: 'c' });
  });
});

describe('createTooltip', () => {
  it('mounts hidden and shows content on demand', () => {
    const tooltip = createTooltip(host, { theme: lightTheme });
    expect(tooltip.visible()).toBe(false);
    expect(tooltip.element.style.opacity).toBe('0');

    tooltip.show(
      { title: 'North', rows: [{ label: 'Revenue', value: '120' }] },
      { x: 10, y: 10 }
    );

    expect(tooltip.visible()).toBe(true);
    expect(tooltip.element.textContent).toContain('North');
    expect(tooltip.element.textContent).toContain('120');
  });

  it('replaces content between shows', () => {
    const tooltip = createTooltip(host, { theme: lightTheme });
    tooltip.show({ title: 'A', rows: [] }, { x: 0, y: 0 });
    tooltip.show({ title: 'B', rows: [] }, { x: 0, y: 0 });
    expect(tooltip.element.textContent).toBe('B');
  });

  it('flips away from the right edge', () => {
    const tooltip = createTooltip(host, { theme: lightTheme });
    Object.defineProperty(tooltip.element, 'offsetWidth', { value: 100, configurable: true });
    tooltip.show({ rows: [] }, { x: 190, y: 10 });
    expect(Number.parseFloat(tooltip.element.style.left)).toBeLessThan(190);
  });

  it('hides and destroys', () => {
    const tooltip = createTooltip(host, { theme: lightTheme });
    tooltip.show({ rows: [] }, { x: 0, y: 0 });
    tooltip.hide();
    expect(tooltip.visible()).toBe(false);

    tooltip.destroy();
    expect(host.querySelector('.d3l-tooltip')).toBeNull();
  });

  it('never paints tooltip text in the series color', () => {
    const tooltip = createTooltip(host, { theme: lightTheme });
    tooltip.show(
      { title: 'North', rows: [{ label: 'Revenue', value: '120', color: '#eb6834' }] },
      { x: 0, y: 0 }
    );
    const spans = [...tooltip.element.querySelectorAll('span')];
    const labelSpan = spans.find((span) => span.textContent === 'Revenue')!;
    expect(labelSpan.style.color).not.toContain('235');
  });
});

describe('zoom', () => {
  it('keeps the focus point stationary while scaling', () => {
    const focus = { x: 100, y: 50 };
    const next = zoomAtPoint(identityZoom, focus, 2, { width: 200, height: 100 });
    const projected = focus.x * next.k + next.x;
    expect(projected).toBeCloseTo(focus.x, 6);
  });

  it('clamps the scale factor to the extent', () => {
    const options = { width: 200, height: 100, scaleExtent: [1, 4] as const };
    expect(zoomAtPoint(identityZoom, { x: 0, y: 0 }, 100, options).k).toBe(4);
    expect(zoomAtPoint(identityZoom, { x: 0, y: 0 }, 0.001, options).k).toBe(1);
  });

  it('emits zoom transforms on wheel input', () => {
    const zoom = attachZoom(host, { width: 200, height: 100 });
    const spy = vi.fn();
    zoom.on('zoom', spy);

    const wheel = new Event('wheel', { bubbles: true, cancelable: true });
    Object.defineProperty(wheel, 'deltaY', { value: -100 });
    Object.defineProperty(wheel, 'clientX', { value: 100 });
    Object.defineProperty(wheel, 'clientY', { value: 50 });
    host.dispatchEvent(wheel);

    expect(spy).toHaveBeenCalledTimes(1);
    expect(zoom.transform().k).toBeGreaterThan(1);
  });

  it('pans on drag between pointer down and up', () => {
    const zoom = attachZoom(host, {
      width: 200,
      height: 100,
      constrainToExtent: false,
    });
    zoom.setTransform({ k: 2, x: 0, y: 0 });

    host.dispatchEvent(pointerEvent('pointerdown', 50, 50));
    host.dispatchEvent(pointerEvent('pointermove', 70, 50));

    expect(zoom.transform().x).toBe(20);

    host.dispatchEvent(pointerEvent('pointerup', 70, 50));
    host.dispatchEvent(pointerEvent('pointermove', 90, 50));
    expect(zoom.transform().x).toBe(20);
  });

  it('locks the off-axis when constrained to one axis', () => {
    const zoom = attachZoom(host, {
      width: 200,
      height: 100,
      axis: 'x',
      constrainToExtent: false,
    });
    host.dispatchEvent(pointerEvent('pointerdown', 50, 50));
    host.dispatchEvent(pointerEvent('pointermove', 70, 80));
    expect(zoom.transform().y).toBe(0);
  });

  it('resets to identity', () => {
    const zoom = attachZoom(host, { width: 200, height: 100 });
    zoom.setTransform({ k: 3, x: -20, y: 0 });
    zoom.reset();
    expect(zoom.transform()).toEqual(identityZoom);
  });
});

describe('brush', () => {
  it('normalizes a rect regardless of drag direction', () => {
    expect(normalizeRect({ x: 30, y: 40 }, { x: 10, y: 10 })).toEqual({
      x: 10,
      y: 10,
      width: 20,
      height: 30,
    });
  });

  it('converts a selection back into domain values', () => {
    const scale = scaleLinear({ domain: [0, 100], range: [0, 200] });
    expect(selectionToDomain({ x: 20, y: 0, width: 80, height: 10 }, scale, 'x')).toEqual([
      10, 50,
    ]);
  });

  it('emits brush events while dragging', () => {
    const brush = attachBrush(host, { extent: BOUNDS });
    const spy = vi.fn();
    brush.on('brush', spy);

    host.dispatchEvent(pointerEvent('pointerdown', 20, 10));
    host.dispatchEvent(pointerEvent('pointermove', 80, 60));

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0]![0].rect.width).toBe(60);
  });

  it('spans the full height for an x brush', () => {
    const brush = attachBrush(host, { extent: BOUNDS, axis: 'x' });
    host.dispatchEvent(pointerEvent('pointerdown', 20, 10));
    host.dispatchEvent(pointerEvent('pointermove', 80, 60));
    expect(brush.selection()!.rect.height).toBe(100);
  });

  it('clamps the selection to the extent', () => {
    const brush = attachBrush(host, { extent: BOUNDS });
    host.dispatchEvent(pointerEvent('pointerdown', 20, 10));
    host.dispatchEvent(pointerEvent('pointermove', 900, 900));
    expect(brush.selection()!.rect.x + brush.selection()!.rect.width).toBe(200);
  });

  it('treats a tiny drag as a clear', () => {
    const brush = attachBrush(host, { extent: BOUNDS, minSize: 10 });
    const cleared = vi.fn();
    const ended = vi.fn();
    brush.on('clear', cleared);
    brush.on('end', ended);

    host.dispatchEvent(pointerEvent('pointerdown', 20, 10));
    host.dispatchEvent(pointerEvent('pointermove', 22, 12));
    host.dispatchEvent(pointerEvent('pointerup', 22, 12));

    expect(cleared).toHaveBeenCalledTimes(1);
    expect(ended).not.toHaveBeenCalled();
    expect(brush.selection()).toBeUndefined();
  });

  it('emits end for a real selection', () => {
    const brush = attachBrush(host, { extent: BOUNDS });
    const spy = vi.fn();
    brush.on('end', spy);

    host.dispatchEvent(pointerEvent('pointerdown', 20, 10));
    host.dispatchEvent(pointerEvent('pointermove', 120, 60));
    host.dispatchEvent(pointerEvent('pointerup', 120, 60));

    expect(spy).toHaveBeenCalledTimes(1);
  });
});
