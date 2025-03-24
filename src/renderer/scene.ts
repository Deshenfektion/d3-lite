export type MarkType = 'group' | 'rect' | 'circle' | 'line' | 'path' | 'text';

export type AttrValue = string | number | boolean | null | undefined;

export type Attrs = Readonly<Record<string, AttrValue>>;

export interface SceneTransform {
  readonly x: number;
  readonly y: number;
  readonly k: number;
}

export interface SceneNode {
  readonly type: MarkType;
  readonly key: string;
  readonly attrs: Attrs;
  readonly text?: string;
  readonly transform?: SceneTransform;
  readonly children?: readonly SceneNode[];
  readonly datum?: unknown;
}

export const emptyAttrs: Attrs = Object.freeze({});

export interface GroupOptions {
  readonly key: string;
  readonly attrs?: Attrs;
  readonly transform?: SceneTransform;
  readonly datum?: unknown;
}

export function group(options: GroupOptions, children: readonly SceneNode[] = []): SceneNode {
  return {
    type: 'group',
    key: options.key,
    attrs: options.attrs ?? emptyAttrs,
    children,
    ...(options.transform === undefined ? {} : { transform: options.transform }),
    ...(options.datum === undefined ? {} : { datum: options.datum }),
  };
}

function leaf(type: MarkType, key: string, attrs: Attrs, datum?: unknown): SceneNode {
  return {
    type,
    key,
    attrs,
    ...(datum === undefined ? {} : { datum }),
  };
}

export function rect(key: string, attrs: Attrs, datum?: unknown): SceneNode {
  return leaf('rect', key, attrs, datum);
}

export function circle(key: string, attrs: Attrs, datum?: unknown): SceneNode {
  return leaf('circle', key, attrs, datum);
}

export function line(key: string, attrs: Attrs, datum?: unknown): SceneNode {
  return leaf('line', key, attrs, datum);
}

export function path(key: string, attrs: Attrs, datum?: unknown): SceneNode {
  return leaf('path', key, attrs, datum);
}

export function text(key: string, content: string, attrs: Attrs, datum?: unknown): SceneNode {
  return {
    type: 'text',
    key,
    attrs,
    text: content,
    ...(datum === undefined ? {} : { datum }),
  };
}

export function countNodes(node: SceneNode): number {
  let total = 1;
  if (node.children) {
    for (const child of node.children) total += countNodes(child);
  }
  return total;
}

export function findByKey(node: SceneNode, key: string): SceneNode | undefined {
  if (node.key === key) return node;
  if (!node.children) return undefined;
  for (const child of node.children) {
    const found = findByKey(child, key);
    if (found) return found;
  }
  return undefined;
}

export function transformToString(transform: SceneTransform): string {
  const parts: string[] = [];
  if (transform.x !== 0 || transform.y !== 0) {
    parts.push(`translate(${transform.x}, ${transform.y})`);
  }
  if (transform.k !== 1) parts.push(`scale(${transform.k})`);
  return parts.join(' ');
}
