export interface PathSink {
  moveTo(x: number, y: number): void;
  lineTo(x: number, y: number): void;
  bezierCurveTo(x1: number, y1: number, x2: number, y2: number, x: number, y: number): void;
  closePath(): void;
}

export class PathBuilder implements PathSink {
  private parts: string[] = [];
  private readonly precision: number;

  constructor(precision = 2) {
    this.precision = precision;
  }

  private n(value: number): string {
    const rounded = Number(value.toFixed(this.precision));
    return Object.is(rounded, -0) ? '0' : String(rounded);
  }

  moveTo(x: number, y: number): void {
    this.parts.push(`M${this.n(x)},${this.n(y)}`);
  }

  lineTo(x: number, y: number): void {
    this.parts.push(`L${this.n(x)},${this.n(y)}`);
  }

  bezierCurveTo(x1: number, y1: number, x2: number, y2: number, x: number, y: number): void {
    this.parts.push(
      `C${this.n(x1)},${this.n(y1)} ${this.n(x2)},${this.n(y2)} ${this.n(x)},${this.n(y)}`
    );
  }

  rect(x: number, y: number, width: number, height: number): void {
    this.parts.push(
      `M${this.n(x)},${this.n(y)}h${this.n(width)}v${this.n(height)}h${this.n(-width)}Z`
    );
  }

  closePath(): void {
    this.parts.push('Z');
  }

  isEmpty(): boolean {
    return this.parts.length === 0;
  }

  clear(): void {
    this.parts = [];
  }

  toString(): string {
    return this.parts.join('');
  }
}

export function roundedRectPath(
  x: number,
  y: number,
  width: number,
  height: number,
  radii: readonly [number, number, number, number],
  precision = 2
): string {
  const w = Math.max(0, width);
  const h = Math.max(0, height);
  const limit = Math.min(w, h) / 2;
  const [tl, tr, br, bl] = radii.map((r) => Math.max(0, Math.min(r, limit))) as [
    number,
    number,
    number,
    number,
  ];
  const n = (value: number): string => {
    const rounded = Number(value.toFixed(precision));
    return Object.is(rounded, -0) ? '0' : String(rounded);
  };

  return [
    `M${n(x + tl)},${n(y)}`,
    `H${n(x + w - tr)}`,
    tr > 0 ? `A${n(tr)},${n(tr)} 0 0 1 ${n(x + w)},${n(y + tr)}` : '',
    `V${n(y + h - br)}`,
    br > 0 ? `A${n(br)},${n(br)} 0 0 1 ${n(x + w - br)},${n(y + h)}` : '',
    `H${n(x + bl)}`,
    bl > 0 ? `A${n(bl)},${n(bl)} 0 0 1 ${n(x)},${n(y + h - bl)}` : '',
    `V${n(y + tl)}`,
    tl > 0 ? `A${n(tl)},${n(tl)} 0 0 1 ${n(x + tl)},${n(y)}` : '',
    'Z',
  ].join('');
}
