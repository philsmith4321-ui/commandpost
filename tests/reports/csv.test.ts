import { describe, it, expect } from 'vitest';

describe('CSV generation', () => {
  it('generates CSV string from rows with headers', async () => {
    const { generateCsv } = await import('@/lib/reports/csv');
    const headers = ['Name', 'Amount', 'Date'];
    const rows = [
      ['Client A', '5000', '2026-05-01'],
      ['Client B', '3000', '2026-05-02'],
    ];
    const csv = generateCsv(headers, rows);
    expect(csv).toBe('Name,Amount,Date\r\nClient A,5000,2026-05-01\r\nClient B,3000,2026-05-02\r\n');
  });

  it('escapes fields containing commas', async () => {
    const { generateCsv } = await import('@/lib/reports/csv');
    const csv = generateCsv(['Desc'], [['Server, hosting']]);
    expect(csv).toBe('Desc\r\n"Server, hosting"\r\n');
  });

  it('escapes fields containing double quotes', async () => {
    const { generateCsv } = await import('@/lib/reports/csv');
    const csv = generateCsv(['Desc'], [['He said "hello"']]);
    expect(csv).toBe('Desc\r\n"He said ""hello"""\r\n');
  });

  it('escapes fields containing newlines', async () => {
    const { generateCsv } = await import('@/lib/reports/csv');
    const csv = generateCsv(['Desc'], [['Line1\nLine2']]);
    expect(csv).toBe('Desc\r\n"Line1\nLine2"\r\n');
  });

  it('handles empty rows', async () => {
    const { generateCsv } = await import('@/lib/reports/csv');
    const csv = generateCsv(['A', 'B'], []);
    expect(csv).toBe('A,B\r\n');
  });

  it('creates CSV response with correct headers', async () => {
    const { csvResponse } = await import('@/lib/reports/csv');
    const response = csvResponse('Name,Amount\r\nA,100\r\n', 'test-report');
    expect(response.headers.get('Content-Type')).toBe('text/csv; charset=utf-8');
    expect(response.headers.get('Content-Disposition')).toBe('attachment; filename="test-report.csv"');
  });
});
