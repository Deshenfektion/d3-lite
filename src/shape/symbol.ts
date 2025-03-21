import { PathBuilder } from './path.ts';

export type SymbolKind = 'circle' | 'square' | 'triangle' | 'diamond' | 'cross';

export function symbolPath(kind: SymbolKind, size: number, precision = 2): string {
  const builder = new PathBuilder(precision);
  const r = Math.sqrt(size / Math.PI);

  switch (kind) {
    case 'circle': {
      const k = r * 0.5522847498;
      builder.moveTo(0, -r);
      builder.bezierCurveTo(k, -r, r, -k, r, 0);
      builder.bezierCurveTo(r, k, k, r, 0, r);
      builder.bezierCurveTo(-k, r, -r, k, -r, 0);
      builder.bezierCurveTo(-r, -k, -k, -r, 0, -r);
      builder.closePath();
      break;
    }
    case 'square': {
      const half = Math.sqrt(size) / 2;
      builder.rect(-half, -half, half * 2, half * 2);
      break;
    }
    case 'triangle': {
      const side = Math.sqrt(size / (Math.sqrt(3) / 4));
      const height = (Math.sqrt(3) / 2) * side;
      builder.moveTo(0, (-2 / 3) * height);
      builder.lineTo(side / 2, height / 3);
      builder.lineTo(-side / 2, height / 3);
      builder.closePath();
      break;
    }
    case 'diamond': {
      const half = Math.sqrt(size / 2);
      builder.moveTo(0, -half);
      builder.lineTo(half, 0);
      builder.lineTo(0, half);
      builder.lineTo(-half, 0);
      builder.closePath();
      break;
    }
    case 'cross': {
      const arm = Math.sqrt(size / 5) / 2;
      const reach = arm * 3;
      builder.moveTo(-arm, -reach);
      builder.lineTo(arm, -reach);
      builder.lineTo(arm, -arm);
      builder.lineTo(reach, -arm);
      builder.lineTo(reach, arm);
      builder.lineTo(arm, arm);
      builder.lineTo(arm, reach);
      builder.lineTo(-arm, reach);
      builder.lineTo(-arm, arm);
      builder.lineTo(-reach, arm);
      builder.lineTo(-reach, -arm);
      builder.lineTo(-arm, -arm);
      builder.closePath();
      break;
    }
  }

  return builder.toString();
}
