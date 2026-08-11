const PART1 = require('./report-types-1');
const PART2 = require('./report-types-2');
const PART3 = require('./report-types-3');

function parse(raw) {
  return raw.trim().split('\n').map((line) => line.trim()).filter(Boolean).map((line) => {
    const [group, frequency, code, name, isDeped, autoGen, required] = line.split('|');
    return { group, frequency, code, name, isDeped: Number(isDeped), autoGen: Number(autoGen), required: Number(required) };
  });
}

const REPORT_TYPES = [
  ...parse(PART1),
  ...parse(PART2),
  ...parse(PART3),
];

module.exports = { REPORT_TYPES };

if (require.main === module) {
  console.log(`taxonomy: ${REPORT_TYPES.length} report types`);
  const byGroup = {};
  for (const t of REPORT_TYPES) byGroup[t.group] = (byGroup[t.group] || 0) + 1;
  for (const g of Object.keys(byGroup)) console.log(`  ${g}: ${byGroup[g]}`);
}