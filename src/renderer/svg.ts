import { diffChildren, nodeUnchanged } from './diff.ts';
import {
  transformToString,
  type Attrs,
  type MarkType,
  type SceneNode,
} from './scene.ts';
import { createStats, type RenderStats, type Renderer } from './types.ts';

const SVG_NS = 'http://www.w3.org/2000/svg';

const TAG_FOR: Record<MarkType, string> = {
  group: 'g',
  rect: 'rect',
  circle: 'circle',
  line: 'line',
  path: 'path',
  text: 'text',
};

interface Bound {
  element: SVGElement;
  node: SceneNode;
  children: Map<string, Bound>;
  order: string[];
}

export interface SvgRendererOptions {
  readonly width?: number;
  readonly height?: number;
  readonly className?: string;
  readonly ariaLabel?: string;
}

export interface SvgRenderer extends Renderer {
  readonly root: SVGSVGElement;
  elementFor(key: string): SVGElement | undefined;
  datumFor(element: Element): unknown;
  resize(width: number, height: number): void;
}

export function createSvgRenderer(
  container: Element,
  options: SvgRendererOptions = {}
): SvgRenderer {
  const stats = createStats();
  const root = document.createElementNS(SVG_NS, 'svg');
  const registry = new Map<string, Bound>();
  const data = new WeakMap<Element, unknown>();

  const width = options.width ?? 640;
  const height = options.height ?? 400;
  root.setAttribute('viewBox', `0 0 ${width} ${height}`);
  root.setAttribute('width', String(width));
  root.setAttribute('height', String(height));
  root.setAttribute('role', 'img');
  if (options.className) root.setAttribute('class', options.className);
  if (options.ariaLabel) root.setAttribute('aria-label', options.ariaLabel);
  container.appendChild(root);

  let rootBound: Bound | undefined;

  const applyAttrs = (element: SVGElement, previous: Attrs | undefined, next: Attrs): void => {
    for (const key of Object.keys(next)) {
      const value = next[key];
      if (previous && previous[key] === value) continue;
      if (value === null || value === undefined || value === false) {
        element.removeAttribute(key);
      } else {
        element.setAttribute(key, value === true ? '' : String(value));
      }
      stats.attributeWrites++;
    }

    if (!previous) return;
    for (const key of Object.keys(previous)) {
      if (key in next) continue;
      element.removeAttribute(key);
      stats.attributeWrites++;
    }
  };

  const applyNode = (bound: Bound, previous: SceneNode | undefined, next: SceneNode): void => {
    applyAttrs(bound.element, previous?.attrs, next.attrs);

    const nextTransform = next.transform;
    const previousTransform = previous?.transform;
    if (
      nextTransform?.x !== previousTransform?.x ||
      nextTransform?.y !== previousTransform?.y ||
      nextTransform?.k !== previousTransform?.k
    ) {
      if (nextTransform) {
        const serialized = transformToString(nextTransform);
        if (serialized) bound.element.setAttribute('transform', serialized);
        else bound.element.removeAttribute('transform');
      } else {
        bound.element.removeAttribute('transform');
      }
      stats.attributeWrites++;
    }

    if (next.text !== previous?.text) {
      bound.element.textContent = next.text ?? '';
      stats.textWrites++;
    }

    if (next.datum !== undefined) data.set(bound.element, next.datum);
  };

  const createBound = (node: SceneNode): Bound => {
    const element = document.createElementNS(SVG_NS, TAG_FOR[node.type]);
    const bound: Bound = { element, node, children: new Map(), order: [] };
    stats.created++;
    applyNode(bound, undefined, node);
    registry.set(node.key, bound);
    if (node.children) reconcile(bound, [], node.children);
    return bound;
  };

  const disposeBound = (bound: Bound): void => {
    registry.delete(bound.node.key);
    for (const child of bound.children.values()) disposeBound(child);
    stats.removed++;
  };

  function reconcile(
    parent: Bound,
    previousChildren: readonly SceneNode[],
    nextChildren: readonly SceneNode[]
  ): void {
    const patches = diffChildren(previousChildren, nextChildren);
    const nextOrder: string[] = nextChildren.map((child) => child.key);

    for (const patch of patches) {
      if (patch.op === 'create' && patch.next) {
        const bound = createBound(patch.next);
        parent.children.set(patch.key, bound);
        parent.element.appendChild(bound.element);
        continue;
      }

      if (patch.op === 'remove') {
        const bound = parent.children.get(patch.key);
        if (!bound) continue;
        bound.element.remove();
        parent.children.delete(patch.key);
        disposeBound(bound);
        continue;
      }

      if (patch.op === 'update' && patch.next && patch.previous) {
        const bound = parent.children.get(patch.key);
        if (!bound) continue;
        if (!nodeUnchanged(patch.previous, patch.next)) {
          applyNode(bound, patch.previous, patch.next);
          stats.updated++;
        }
        const previousGrandchildren = patch.previous.children ?? [];
        const nextGrandchildren = patch.next.children ?? [];
        if (previousGrandchildren.length > 0 || nextGrandchildren.length > 0) {
          reconcile(bound, previousGrandchildren, nextGrandchildren);
        }
        bound.node = patch.next;
        continue;
      }

      if (patch.op === 'move') {
        const bound = parent.children.get(patch.key);
        if (!bound) continue;
        const reference = parent.element.childNodes[patch.index] ?? null;
        if (reference !== bound.element) {
          parent.element.insertBefore(bound.element, reference);
          stats.moved++;
        }
      }
    }

    parent.order = nextOrder;
  }

  return {
    root,
    stats,

    render(scene: SceneNode): void {
      if (!rootBound) {
        rootBound = createBound(scene);
        root.appendChild(rootBound.element);
      } else {
        const previous = rootBound.node;
        if (!nodeUnchanged(previous, scene)) {
          applyNode(rootBound, previous, scene);
          stats.updated++;
        }
        reconcile(rootBound, previous.children ?? [], scene.children ?? []);
        rootBound.node = scene;
      }
      stats.frames++;
    },

    elementFor(key: string): SVGElement | undefined {
      return registry.get(key)?.element;
    },

    datumFor(element: Element): unknown {
      return data.get(element);
    },

    resize(nextWidth: number, nextHeight: number): void {
      root.setAttribute('viewBox', `0 0 ${nextWidth} ${nextHeight}`);
      root.setAttribute('width', String(nextWidth));
      root.setAttribute('height', String(nextHeight));
    },

    resetStats(): void {
      const fresh = createStats();
      for (const key of Object.keys(fresh) as (keyof RenderStats)[]) {
        stats[key] = fresh[key];
      }
    },

    destroy(): void {
      registry.clear();
      root.remove();
      rootBound = undefined;
    },
  };
}
