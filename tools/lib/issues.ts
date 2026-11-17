// Collects errors and warnings. Every issue prints on one line:
//   ERROR content/steps/rear-shifting.yaml:42 | step check-low-limit | max-buttons | message
// so an agent can fix it without reading the build tool's code.

export type Severity = 'error' | 'warning';

export interface Issue {
  severity: Severity;
  file: string;
  line?: number;
  id: string;
  rule: string;
  message: string;
}

export class Issues {
  readonly list: Issue[] = [];
  private seen = new Set<string>();

  add(issue: Issue): void {
    const key = formatIssue(issue);
    if (this.seen.has(key)) return;
    this.seen.add(key);
    this.list.push(issue);
  }

  error(file: string, id: string, rule: string, message: string, line?: number): void {
    this.add({ severity: 'error', file, id, rule, message, line });
  }

  warn(file: string, id: string, rule: string, message: string, line?: number): void {
    this.add({ severity: 'warning', file, id, rule, message, line });
  }

  get errors(): Issue[] {
    return this.list.filter((i) => i.severity === 'error');
  }

  get warnings(): Issue[] {
    return this.list.filter((i) => i.severity === 'warning');
  }

  has(rule: string): boolean {
    return this.list.some((i) => i.rule === rule && i.severity === 'error');
  }
}

export function formatIssue(i: Issue): string {
  const where = i.line ? `${i.file}:${i.line}` : i.file;
  return `${i.severity.toUpperCase()} ${where} | ${i.id} | ${i.rule} | ${i.message}`;
}
