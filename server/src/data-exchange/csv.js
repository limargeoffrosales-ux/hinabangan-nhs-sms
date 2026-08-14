const { stringify } = require('csv-stringify');
const { parse } = require('csv-parse');

// RFC4180-compliant CSV writer. Adds a UTF-8 BOM so Excel opens it correctly
// (OneRoster v1.2 requires a UTF-8 BOM).
function toCsv(columns, rows) {
  return new Promise((resolve, reject) => {
    stringify(rows, {
      header: true,
      columns: columns.map((c) => (typeof c === 'string' ? { key: c, header: c } : c)),
      bom: true,
      cast: {
        string: (v) => (v == null ? '' : v),
      },
    }, (err, output) => (err ? reject(err) : resolve(output)));
  });
}

function parseCsv(text) {
  return new Promise((resolve, reject) => {
    parse(text, {
      columns: true,
      skip_empty_lines: true,
      relax_column_count: true,
      trim: true,
      bom: true,
    }, (err, records) => (err ? reject(err) : resolve(records || [])));
  });
}

// Deterministic pseudo-id so import->export stays stable and humans can
// recognise which entity a sourcedId points at (s-12, course-8, ...).
function prefixedId(prefix, id) {
  return `${prefix}-${id}`;
}

module.exports = { toCsv, parseCsv, prefixedId };
