/**
 * File parser — reads CSV / XLS / XLSX into flat `Record<string, string>` rows.
 *
 * xlsx (SheetJS) is lazy-loaded so the ~700KB library only hits the bundle
 * when the user actually drops a spreadsheet — CSV users pay nothing.
 *
 * Usage:
 *   const rows = await parseSpreadsheet(file);
 *   // rows: [{ name: "Beverages", code: "1000", ... }, ...]
 */

export type ParsedRow = Record<string, string>;

/** Split a CSV line respecting double-quoted fields (RFC 4180-ish). */
function splitCsvLine(line: string): string[] {
    const out: string[] = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (inQuotes) {
            if (ch === '"') {
                if (line[i + 1] === '"') { cur += '"'; i++; }
                else inQuotes = false;
            } else {
                cur += ch;
            }
        } else {
            if (ch === ',') { out.push(cur); cur = ''; }
            else if (ch === '"') inQuotes = true;
            else cur += ch;
        }
    }
    out.push(cur);
    return out.map(c => c.trim());
}

function parseCSVText(text: string): ParsedRow[] {
    const clean = text.replace(/^﻿/, '').replace(/\r\n?/g, '\n');
    const lines = clean.split('\n').filter(l => l.trim());
    if (lines.length === 0) return [];
    const headers = splitCsvLine(lines[0]).map(h => h.trim().toLowerCase());
    const rows: ParsedRow[] = [];
    for (let i = 1; i < lines.length; i++) {
        const cells = splitCsvLine(lines[i]);
        const obj: ParsedRow = {};
        headers.forEach((h, idx) => { obj[h] = cells[idx] || ''; });
        if (obj.name) rows.push(obj);
    }
    return rows;
}

/** Parse a File (CSV / XLS / XLSX) into header-keyed rows. Headers are
 *  lowercased so downstream lookup is case-insensitive. */
export async function parseSpreadsheet(file: File): Promise<ParsedRow[]> {
    const name = file.name.toLowerCase();
    const isExcel = name.endsWith('.xls') || name.endsWith('.xlsx') || name.endsWith('.xlsm');

    if (!isExcel) {
        // CSV — plain text.
        const text = await file.text();
        return parseCSVText(text);
    }

    // Excel — lazy-load SheetJS. Keeps CSV imports zero-cost.
    const XLSX = await import('xlsx');
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: 'array' });
    const sheetName = wb.SheetNames[0];
    if (!sheetName) return [];
    const sheet = wb.Sheets[sheetName];
    // `header: 1` returns a 2-D array of arrays — we re-apply our own header
    // normalization so the result matches the CSV path exactly.
    const matrix = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, defval: '', blankrows: false, raw: false });
    if (matrix.length === 0) return [];
    const headers = (matrix[0] || []).map(h => String(h ?? '').trim().toLowerCase());
    const rows: ParsedRow[] = [];
    for (let i = 1; i < matrix.length; i++) {
        const cells = matrix[i] || [];
        const obj: ParsedRow = {};
        headers.forEach((h, idx) => { obj[h] = String(cells[idx] ?? '').trim(); });
        if (obj.name) rows.push(obj);
    }
    return rows;
}

/** Accept string used by <input type="file">. Kept as a single source of
 *  truth so the upload dialog and the file picker stay in sync. */
export const SPREADSHEET_ACCEPT =
    '.csv,text/csv,.xls,.xlsx,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
