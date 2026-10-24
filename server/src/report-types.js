// Paperless submissions taxonomy — restricted to official school reports.
// Line format: group|frequency|code|name|is_deped_form|auto_generate|required
const RAW = `
Academic & Teaching|daily|daily_lesson_plan|Daily Lesson Plan|0|1|1
Human Resource|daily|dtr|DTR|0|0|1
Administrative|weekly|acr|ACR|0|1|1
Academic & Teaching|weekly|bol|BOL|0|0|1
Academic & Teaching|weekly|bow|BOW|0|0|1
Academic & Teaching|periodic|end_of_term_reports|End of Term Reports|0|0|1
Academic & Teaching|quarterly|list_of_honors|List of honors|0|0|1
Student Programs|periodic|list_of_jdvp_beneficiaries|List of JDVP Beneficiaries|0|0|1
Student Programs|periodic|list_for_work_immersion|List for Work Immersion|0|0|1
Human Resource|periodic|application_for_leave|Application for Leave|0|1|1
`;

function parse(raw) {
  return raw.trim().split('\n').map((line) => line.trim()).filter(Boolean).map((line) => {
    const [group, frequency, code, name, isDeped, autoGen, required] = line.split('|');
    return { group, frequency, code, name, isDeped: !!Number(isDeped), autoGen: !!Number(autoGen), required: !!Number(required) };
  });
}

const REPORT_TYPES = parse(RAW);

module.exports = { REPORT_TYPES };

if (require.main === module) {
  console.log(`taxonomy: ${REPORT_TYPES.length} report types`);
  const byGroup = {};
  for (const t of REPORT_TYPES) byGroup[t.group] = (byGroup[t.group] || 0) + 1;
  for (const g of Object.keys(byGroup)) console.log(`  ${g}: ${byGroup[g]}`);
}
