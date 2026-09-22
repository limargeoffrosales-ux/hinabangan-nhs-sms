// Shared list-export helper for students/attendance/grades. Produces .xlsx via
// exceljs (lazily required like exchange.routes.js) or .csv with a UTF-8 BOM so
// Excel opens accented characters correctly.

function csvCell(v) {
  const s = v == null ? '' : String(v);
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

function slug(s) {
  return String(s == null ? '' : s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'export';
}

// columns: [{ key, header, width? }]; filename is the base name (no extension).
async function sendSpreadsheet(res, format, { columns, rows, sheetName, filename }) {
  const isCsv = String(format || 'xlsx').toLowerCase() === 'csv';
  const base = slug(filename);

  if (isCsv) {
    let csv = columns.map((c) => csvCell(c.header)).join(',') + '\n';
    for (const r of rows) {
      csv += columns.map((c) => csvCell(r[c.key])).join(',') + '\n';
    }
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${base}.csv"`);
    res.send(Buffer.from('\uFEFF' + csv, 'utf8'));
    return;
  }

  const ExcelJS = require('exceljs');
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(sheetName || 'Export');
  ws.addRow(columns.map((c) => c.header));
  const headRow = ws.getRow(1);
  headRow.font = { bold: true };
  headRow.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8EEF7' } };
  });
  for (const r of rows) {
    ws.addRow(columns.map((c) => (r[c.key] == null ? '' : r[c.key])));
  }
  columns.forEach((c, i) => { ws.getColumn(i + 1).width = c.width || 16; });
  ws.views = [{ state: 'frozen', ySplit: 1 }];
  const buf = await wb.xlsx.writeBuffer();
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${base}.xlsx"`);
  res.send(Buffer.from(buf));
}

module.exports = { sendSpreadsheet, slug };