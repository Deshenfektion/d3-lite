const QUOTE = 34;
const CR = 13;
const LF = 10;

const CANDIDATE_DELIMITERS = [',', ';', '\t', '|'];

export interface TokenizeOptions {
  delimiter?: string;
  skipEmptyLines?: boolean;
  comment?: string;
  maxRows?: number;
}

export function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

export function detectDelimiter(text: string): string {
  const sample = text.slice(0, 65536);
  const firstBreak = sample.indexOf('\n');
  const line = firstBreak === -1 ? sample : sample.slice(0, firstBreak);

  let best = ',';
  let bestCount = 0;
  for (const candidate of CANDIDATE_DELIMITERS) {
    let count = 0;
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const code = line.charCodeAt(i);
      if (code === QUOTE) inQuotes = !inQuotes;
      else if (!inQuotes && line[i] === candidate) count++;
    }
    if (count > bestCount) {
      best = candidate;
      bestCount = count;
    }
  }
  return best;
}

export function tokenizeDelimited(text: string, options: TokenizeOptions = {}): string[][] {
  const source = stripBom(text);
  const delimiter = options.delimiter ?? detectDelimiter(source);
  const delimiterCode = delimiter.charCodeAt(0);
  const skipEmptyLines = options.skipEmptyLines ?? true;
  const comment = options.comment;
  const maxRows = options.maxRows ?? Number.POSITIVE_INFINITY;

  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  let fieldWasQuoted = false;
  let index = 0;
  const length = source.length;

  const pushField = (): void => {
    row.push(field);
    field = '';
    fieldWasQuoted = false;
  };

  const pushRow = (): boolean => {
    pushField();
    const isEmpty = row.length === 1 && row[0] === '';
    if (!(skipEmptyLines && isEmpty)) rows.push(row);
    row = [];
    return rows.length < maxRows;
  };

  while (index < length) {
    if (
      comment !== undefined &&
      !inQuotes &&
      field === '' &&
      row.length === 0 &&
      source.startsWith(comment, index)
    ) {
      while (index < length && source.charCodeAt(index) !== LF) index++;
      index++;
      continue;
    }

    const code = source.charCodeAt(index);

    if (inQuotes) {
      if (code === QUOTE) {
        if (source.charCodeAt(index + 1) === QUOTE) {
          field += '"';
          index += 2;
        } else {
          inQuotes = false;
          index++;
        }
      } else {
        field += source.charAt(index);
        index++;
      }
      continue;
    }

    if (code === QUOTE && field === '') {
      inQuotes = true;
      fieldWasQuoted = true;
      index++;
    } else if (code === delimiterCode) {
      pushField();
      index++;
    } else if (code === CR) {
      const hasMore = pushRow();
      index += source.charCodeAt(index + 1) === LF ? 2 : 1;
      if (!hasMore) return rows;
    } else if (code === LF) {
      const hasMore = pushRow();
      index++;
      if (!hasMore) return rows;
    } else {
      field += source.charAt(index);
      index++;
    }
  }

  if (field !== '' || fieldWasQuoted || row.length > 0) pushRow();

  return rows;
}
