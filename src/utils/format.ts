import { precisionFor } from './math.ts';

const SI_PREFIXES = [
  { value: 1e12, symbol: 'T' },
  { value: 1e9, symbol: 'G' },
  { value: 1e6, symbol: 'M' },
  { value: 1e3, symbol: 'k' },
];

export type Formatter = (value: number) => string;

export function formatFixed(decimals: number): Formatter {
  return (value) => value.toFixed(decimals);
}

export function formatPercent(decimals = 0): Formatter {
  return (value) => `${(value * 100).toFixed(decimals)}%`;
}

export function formatSI(decimals = 1): Formatter {
  return (value) => {
    if (!Number.isFinite(value)) return String(value);
    const abs = Math.abs(value);
    for (const prefix of SI_PREFIXES) {
      if (abs >= prefix.value) {
        const scaled = value / prefix.value;
        const text = scaled.toFixed(Number.isInteger(scaled) ? 0 : decimals);
        return `${text}${prefix.symbol}`;
      }
    }
    return Number.isInteger(value) ? String(value) : value.toFixed(decimals);
  };
}

export function formatCurrency(symbol = '$', decimals = 0): Formatter {
  const si = formatSI(1);
  return (value) => {
    const abs = Math.abs(value);
    const body = abs >= 1000 ? si(abs) : abs.toFixed(decimals);
    return `${value < 0 ? '-' : ''}${symbol}${body}`;
  };
}

export function formatAuto(step: number): Formatter {
  const decimals = precisionFor(step);
  return (value) => {
    if (!Number.isFinite(value)) return String(value);
    if (Math.abs(value) >= 1e6 || (value !== 0 && Math.abs(value) < 1e-4)) {
      return value.toExponential(2);
    }
    return decimals === 0 ? String(Math.round(value)) : value.toFixed(decimals);
  };
}

const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

function pad(value: number, width = 2): string {
  return String(value).padStart(width, '0');
}

export type TimeUnit = 'second' | 'minute' | 'hour' | 'day' | 'month' | 'year';

export function formatTime(unit: TimeUnit): (value: Date | number) => string {
  return (value) => {
    const date = value instanceof Date ? value : new Date(value);
    switch (unit) {
      case 'second':
        return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
      case 'minute':
        return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
      case 'hour':
        return `${pad(date.getHours())}:00`;
      case 'day':
        return `${MONTHS[date.getMonth()]} ${date.getDate()}`;
      case 'month':
        return `${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
      case 'year':
        return String(date.getFullYear());
    }
  };
}

export function truncate(text: string, maxLength: number): string {
  return text.length <= maxLength ? text : `${text.slice(0, Math.max(0, maxLength - 1))}…`;
}
