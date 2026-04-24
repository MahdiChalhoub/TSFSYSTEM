/**
 * Excel export — writes a SpreadsheetML 2003 XML file saved as `.xls`. Opens
 * natively in Excel (and LibreOffice / Google Sheets import). Zero dependency,
 * zero build cost — just a handful of XML strings.
 *
 * Usage:
 *   exportExcel({
 *     filename: 'categories-2026-04-24.xls',
 *     sheetName: 'Categories',
 *     columns: ['Name', 'Code', 'Products'],
 *     rows: [['Beverages', 'BEV', 42], ...],
 *   });
 */

export type CellValue = string | number | boolean | null | undefined;

export interface ExcelExportOptions {
    filename: string;
    sheetName?: string;
    columns: string[];
    rows: CellValue[][];
}

const xmlEscape = (s: string) =>
    s.replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');

function cellXml(v: CellValue): string {
    if (v === null || v === undefined || v === '') {
        return '<Cell><Data ss:Type="String"></Data></Cell>';
    }
    if (typeof v === 'number' && Number.isFinite(v)) {
        return `<Cell><Data ss:Type="Number">${v}</Data></Cell>`;
    }
    if (typeof v === 'boolean') {
        return `<Cell><Data ss:Type="Boolean">${v ? 1 : 0}</Data></Cell>`;
    }
    return `<Cell><Data ss:Type="String">${xmlEscape(String(v))}</Data></Cell>`;
}

export function exportExcel({ filename, sheetName = 'Sheet1', columns, rows }: ExcelExportOptions) {
    const safeSheetName = xmlEscape(sheetName.slice(0, 31));

    const headerRow = `<Row ss:StyleID="Header">${columns.map(c => cellXml(c)).join('')}</Row>`;
    const bodyRows = rows.map(r => `<Row>${r.map(cellXml).join('')}</Row>`).join('');

    // SpreadsheetML 2003 — minimal, broadly compatible. Excel opens the file
    // natively (each Cell becomes a real cell); LibreOffice imports it cleanly.
    // Keep the structure minimal: extra `WorksheetOptions` / freeze-pane blocks
    // can make some Excel builds reject the file with "format mismatch".
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Styles>
  <Style ss:ID="Header">
   <Font ss:Bold="1" ss:Color="#374151"/>
   <Interior ss:Color="#F3F4F6" ss:Pattern="Solid"/>
  </Style>
 </Styles>
 <Worksheet ss:Name="${safeSheetName}">
  <Table>
   ${headerRow}
   ${bodyRows}
  </Table>
 </Worksheet>
</Workbook>`;

    // No BOM — SpreadsheetML already declares UTF-8 in the prolog, and some
    // Excel builds refuse files that start with a BOM before the XML prolog.
    const blob = new Blob([xml], { type: 'application/vnd.ms-excel;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}
