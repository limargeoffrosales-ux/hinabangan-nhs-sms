import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Palette, Layout, Type, Box, Bell, Circle, Hash, Sun, Moon, BarChart3 } from 'lucide-react';
import { PageHead } from '../components/ui';
import {
  Button, IconButton, Badge, StatusBadge, Card, CardHeader, CardBody, CardFooter,
  CardTitle, Alert, Skeleton, EmptyState, Divider, Progress, StatCard, SectionTitle,
  Container, Stack, Grid, PageHeader, Tabs, Breadcrumbs, Spacer,
  Input, Textarea, Select, FormField,
  Sparkline, ProgressRing, DonutChart, ModernBarChart, ModernLineChart,
  ModernPieChart, ModernComposedChart,
  useTheme, useIsDark,
} from '../design-system';
import TarikMascotSheet from '../components/TarikMascotSheet';
import UgopFeatureIconsGrid from '../components/UgopFeatureIcons';

function isColorLike(v) {
  return /^(#|var\(|linear-gradient|radial-gradient|rgba?\(|hsla?\(|color-mix)/.test(v);
}

function TokenSwatch({ name, value }) {
  const isEffect = !isColorLike(value) && /^(0|-?\d)/.test(value);
  return (
    <div className="card" style={{ padding: 12, minWidth: 140, textAlign: 'center' }}>
      <div
        style={{
          height: 44,
          borderRadius: 8,
          border: '1px solid var(--border)',
          marginBottom: 8,
          background: isEffect ? 'var(--card-solid)' : value,
          ...(isEffect ? { boxShadow: value } : {}),
        }}
      />
      <div style={{ fontSize: 12, color: 'var(--text)' }}>{name}</div>
      <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>{value}</div>
    </div>
  );
}

function ColorSection({ title, colors }) {
  return (
    <Stack spacing="sm">
      {title && <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-dim)' }}>{title}</div>}
      <Grid cols={2} colsSm={3} colsMd={4} gap="md">
        {Object.entries(colors).map(([name, value]) => (
          <TokenSwatch key={name} name={name} value={value} />
        ))}
      </Grid>
    </Stack>
  );
}

const SHADE_TABLE = [
  { name: '50', value: '#E8F1FF' },
  { name: '100', value: '#D0E2FF' },
  { name: '200', value: '#A8C8FF' },
  { name: '300', value: '#7AA6FF' },
  { name: '400', value: '#4D96FF' },
  { name: '500', value: '#2F7DF4' },
  { name: '600', value: '#1A63D8' },
  { name: '700', value: '#144BB8' },
  { name: '800', value: '#0E3590' },
  { name: '900', value: '#0A2468' },
];

const DEMO_BARS = [
  { name: 'Grade 7', Male: 96, Female: 104, rate: 88 },
  { name: 'Grade 8', Male: 88, Female: 97, rate: 91 },
  { name: 'Grade 9', Male: 101, Female: 92, rate: 90 },
  { name: 'Grade 10', Male: 79, Female: 86, rate: 93 },
  { name: 'Grade 11', Male: 64, Female: 71, rate: 95 },
  { name: 'Grade 12', Male: 58, Female: 66, rate: 94 },
];

const DEMO_LINE = [
  { m: 'Jun', rate: 92 },
  { m: 'Aug', rate: 94 },
  { m: 'Sep', rate: 91 },
  { m: 'Oct', rate: 96 },
  { m: 'Nov', rate: 93 },
  { m: 'Jan', rate: 97 },
  { m: 'Feb', rate: 95 },
];

const DEMO_DONUT = [
  { name: 'Passing', value: 78, color: 'var(--accent-2)' },
  { name: 'Failing', value: 22, color: 'var(--danger)' },
];

export default function DesignSystem() {
  const { t } = useTranslation();
  const { toggleTheme } = useTheme();
  const isDark = useIsDark();
  const [tab, setTab] = useState('tokens');
  const [tone, setTone] = useState('');
  const [submitted, setSubmitted] = useState(false);

  return (
    <div>
      <PageHead title={t('ds.title', 'Design System')} sub={t('ds.subtitle', 'Live tokens, components, and patterns — the visual foundation of the system.')} />

      <div style={{ marginBottom: 20 }}>
        <Button variant="outline" onClick={toggleTheme} leftIcon={isDark ? <Sun size={16} /> : <Moon size={16} />}>
          {isDark ? t('ds.useLight', 'Switch to light theme') : t('ds.useDark', 'Switch to dark theme')}
        </Button>
      </div>

      <Tabs
        variant="underline"
        active={tab}
        onChange={setTab}
        tabs={[
          { id: 'mascot', label: 'Tarik Mascot Sheet', icon: <Box size={15} /> },
          { id: 'tokens', label: t('ds.tokens', 'Tokens'), icon: <Palette size={15} /> },
          { id: 'layout', label: t('ds.layout', 'Layout'), icon: <Layout size={15} /> },
          { id: 'typography', label: t('ds.typography', 'Typography'), icon: <Type size={15} /> },
          { id: 'components', label: t('ds.components', 'Components'), icon: <Box size={15} /> },
          { id: 'feedback', label: t('ds.feedback', 'Feedback'), icon: <Bell size={15} /> },
          { id: 'forms', label: t('ds.forms', 'Forms'), icon: <Hash size={15} /> },
          { id: 'charts', label: t('ds.charts', 'Charts'), icon: <BarChart3 size={15} /> },
        ]}
      />

      <Spacer size="lg" />

      {tab === 'mascot' && (
        <Stack spacing="xl">
          <TarikMascotSheet />
          <UgopFeatureIconsGrid />
        </Stack>
      )}

      {tab === 'tokens' && (
        <Stack spacing="lg">
          <SectionTitle>{t('ds.themeColors', 'Theme semantic colors')}</SectionTitle>
          <Card>
            <CardBody>
              <ColorSection
                title={t('ds.semantic', 'Semantic')}
                colors={{
                  '--bg': 'var(--bg)',
                  '--bg-soft': 'var(--bg-soft)',
                  '--card': 'var(--card)',
                  '--card-solid': 'var(--card-solid)',
                  '--border': 'var(--border)',
                  '--border-strong': 'var(--border-strong)',
                  '--text': 'var(--text)',
                  '--text-dim': 'var(--text-dim)',
                  '--accent': 'var(--accent)',
                  '--accent-2': 'var(--accent-2)',
                  '--accent-3': 'var(--accent-3)',
                  '--success': 'var(--success)',
                  '--warn': 'var(--warn)',
                  '--danger': 'var(--danger)',
                }}
              />
            </CardBody>
          </Card>

          <SectionTitle>{t('ds.primaryScale', 'Primary color scale')}</SectionTitle>
          <Card>
            <CardBody>
              <Grid cols={2} colsSm={3} colsMd={5} gap="md">
                {SHADE_TABLE.map((s) => (
                  <TokenSwatch key={s.name} name={`primary.${s.name}`} value={s.value} />
                ))}
              </Grid>
            </CardBody>
          </Card>

          <SectionTitle>{t('ds.gradients', 'Gradients & effects')}</SectionTitle>
          <Card>
            <CardBody>
              <Stack direction="row" spacing="md" wrap>
                <TokenSwatch name="--grad" value="var(--grad)" />
                <TokenSwatch name="--grad-3" value="var(--grad-3)" />
                <TokenSwatch name="--glow" value="var(--glow)" />
                <TokenSwatch name="--glow-soft" value="var(--glow-soft)" />
                <TokenSwatch name="--shadow" value="var(--shadow)" />
              </Stack>
              <Spacer size="md" />
              <p style={{ fontSize: 13, color: 'var(--text-dim)' }}>
                {t('ds.tokensHint', 'Tokens are defined in src/design-system/tokens/*.ts and exposed as CSS custom properties in styles.css (:root + [data-theme]).')}
              </p>
            </CardBody>
          </Card>
        </Stack>
      )}

      {tab === 'layout' && (
        <Stack spacing="lg">
          <SectionTitle>{t('ds.container', 'Container')}</SectionTitle>
          <Card>
            <CardBody>
              <Container size="md" className="no-pad-hint" style={{ backgroundColor: 'rgba(var(--rgb-accent), 0.08)', border: '1px dashed var(--border-strong)', borderRadius: 8, padding: 16 }}>
                {t('ds.containerHint', 'Container sizes: xs (480px) · sm (640px) · md (768px) · lg (1024px) · xl (1280px) · full')}
              </Container>
            </CardBody>
          </Card>

          <SectionTitle>{t('ds.stackGrid', 'Stack & Grid')}</SectionTitle>
          <Card>
            <CardBody>
              <Stack spacing="sm">
                <div style={{ background: 'rgba(var(--rgb-accent), 0.1)', border: '1px solid var(--border)', borderRadius: 8, padding: 10 }}>Stack item 1</div>
                <div style={{ background: 'rgba(var(--rgb-accent), 0.1)', border: '1px solid var(--border)', borderRadius: 8, padding: 10 }}>Stack item 2</div>
                <div style={{ background: 'rgba(var(--rgb-accent), 0.1)', border: '1px solid var(--border)', borderRadius: 8, padding: 10 }}>Stack item 3</div>
              </Stack>
              <Spacer size="lg" />
              <Grid cols={3} gap="md">
                {['A', 'B', 'C', 'D', 'E', 'F'].map((letter) => (
                  <div key={letter} style={{ background: 'rgba(var(--rgb-green), 0.1)', border: '1px solid var(--border)', borderRadius: 8, padding: 14, textAlign: 'center', fontWeight: 700 }}>{letter}</div>
                ))}
              </Grid>
            </CardBody>
          </Card>

          <SectionTitle>{t('ds.pageHeader', 'Page header pattern')}</SectionTitle>
          <PageHeader
            title={t('ds.pageHeaderTitle', 'Academic Records')}
            subtitle={t('ds.pageHeaderSub', 'Manage student records across grade levels and sections.')}
            icon={<Palette size={22} />}
            actions={<Button size="sm">{t('ds.export', 'Export')}</Button>}
            breadcrumbs={<Breadcrumbs items={[{ label: t('ds.home', 'Home'), to: '/' }, { label: t('ds.academics', 'Academics') }, { label: t('ds.records', 'Records') }]} />}
          />
        </Stack>
      )}

      {tab === 'typography' && (
        <Stack spacing="lg">
          <Card>
            <CardBody>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 44, letterSpacing: '-0.03em' }}>{t('ds.displaySample', 'Display')}</div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 30, fontWeight: 700, marginTop: 8 }}>{t('ds.headingSample', 'Headings')}</div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 600, marginTop: 8, color: 'var(--text)' }}>{t('ds.subheadingSample', 'Subheadings')}</div>
              <div style={{ fontSize: 16, lineHeight: 1.65, marginTop: 12, color: 'var(--text)' }}>
                {t('ds.bodySample', 'Body text — the working set for paragraphs, tables, and cards. Comfortable at 15 px with relaxed line height.')}
              </div>
              <div style={{ fontSize: 13.5, color: 'var(--text-dim)', marginTop: 12 }}>{t('ds.smallSample', 'Small / muted text for metadata, footnotes, and helper copy.')}</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, marginTop: 12, color: 'var(--accent)' }}>{t('ds.monoSample', 'mono — IDs, LRNs, codes: 144-331-0821')}</div>
            </CardBody>
          </Card>
          <p style={{ fontSize: 13, color: 'var(--text-dim)' }}>
            {t('ds.typeHint', 'Fonts: --font-ui (Inter), --font-display (Outfit), --font-mono. Type scale and weights live in src/design-system/tokens/typography.ts.')}
          </p>
        </Stack>
      )}

      {tab === 'components' && (
        <Stack spacing="lg">
          <SectionTitle>{t('ds.buttons', 'Buttons')}</SectionTitle>
          <Card>
            <CardBody>
              <Stack direction="row" spacing="md" wrap align="center">
                <Button>{t('ds.primary', 'Primary')}</Button>
                <Button variant="secondary">{t('ds.secondary', 'Secondary')}</Button>
                <Button variant="outline">{t('ds.outline', 'Outline')}</Button>
                <Button variant="ghost">{t('ds.ghost', 'Ghost')}</Button>
                <Button variant="danger">{t('ds.danger', 'Danger')}</Button>
                <Button variant="success">{t('ds.success', 'Success')}</Button>
                <Button loading>{t('ds.loading', 'Loading')}</Button>
                <Button size="xs">{t('ds.xs', 'XS')}</Button>
                <Button size="sm">{t('ds.sm', 'SM')}</Button>
                <Button size="lg">{t('ds.lg', 'LG')}</Button>
              </Stack>
            </CardBody>
          </Card>

          <SectionTitle>{t('ds.iconButtons', 'Icon buttons')}</SectionTitle>
          <Card>
            <CardBody>
              <Stack direction="row" spacing="md" align="center">
                <IconButton aria-label="default"><Bell size={18} /></IconButton>
                <IconButton variant="ghost" aria-label="ghost"><Circle size={18} /></IconButton>
                <IconButton variant="danger" aria-label="danger"><Bell size={18} /></IconButton>
              </Stack>
            </CardBody>
          </Card>

          <SectionTitle>{t('ds.badges', 'Badges')}</SectionTitle>
          <Card>
            <CardBody>
              <Stack direction="row" spacing="md" wrap align="center">
                <Badge variant="primary" dot>Primary</Badge>
                <Badge variant="secondary">Secondary</Badge>
                <Badge variant="success" dot pulse>Success</Badge>
                <Badge variant="warning" dot>Warning</Badge>
                <Badge variant="danger" dot>Danger</Badge>
                <Badge variant="info">Info</Badge>
                <Badge variant="neutral">Neutral</Badge>
                <Badge variant="outline">Outline</Badge>
              </Stack>
              <Spacer size="md" />
              <Stack direction="row" spacing="sm" wrap align="center">
                <StatusBadge status="Enrolled" />
                <StatusBadge status="Pending" />
                <StatusBadge status="Rejected" />
                <StatusBadge status="Archived" />
                <StatusBadge status="Processing" />
              </Stack>
            </CardBody>
          </Card>

          <SectionTitle>{t('ds.cards', 'Cards')}</SectionTitle>
          <Grid cols={2} colsLg={3} gap="md">
            <Card hoverable>
              <CardHeader>
                <CardTitle>{t('ds.cardOne', 'Card one')}</CardTitle>
                <Badge variant="info">v2</Badge>
              </CardHeader>
              <CardBody>
                <p style={{ margin: 0, fontSize: 14, color: 'var(--text-dim)', lineHeight: 1.6 }}>
                  {t('ds.cardBody', 'Cards contain related information in a framed, elevated surface. Use CardHeader, CardBody, and CardFooter to structure content.')}
                </p>
              </CardBody>
              <CardFooter>
                <Button size="sm" variant="outline">{t('ds.learnMore', 'Learn more')}</Button>
                <Button size="sm">{t('ds.open', 'Open')}</Button>
              </CardFooter>
            </Card>
            <Card hoverable>
              <CardBody>
                <Stack direction="row" spacing="sm" align="center">
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--bg-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)' }}><Bell size={18} /></div>
                  <div>
                    <div style={{ fontWeight: 600 }}>{t('ds.titleOnlyCard', 'Title-only card')}</div>
                    <div style={{ fontSize: 12.5, color: 'var(--text-dim)' }}>{t('ds.noHeader', 'Card without headers for density')}</div>
                  </div>
                </Stack>
                <Spacer size="md" />
                <Progress value={62} variant="primary" showLabel />
              </CardBody>
            </Card>
            <Card interactive>
              <CardBody>
                <StatCard label={t('ds.interactive', 'Interactive card')} value="1,284" trend={8.4} trendLabel={t('ds.vsLastTerm', 'vs last term')} />
              </CardBody>
            </Card>
          </Grid>

          <SectionTitle>{t('ds.tabs', 'Tabs')}</SectionTitle>
          <Card>
            <CardBody>
              <Tabs variant="pills" active="all" onChange={() => {}} tabs={[
                { id: 'all', label: 'All' },
                { id: 'active', label: 'Active' },
                { id: 'archived', label: 'Archived' },
              ]} />
              <Spacer size="md" />
              <Tabs variant="boxed" active="week" onChange={() => {}} tabs={[
                { id: 'day', label: 'Day' },
                { id: 'week', label: 'Week' },
                { id: 'month', label: 'Month' },
              ]} />
            </CardBody>
          </Card>
        </Stack>
      )}

      {tab === 'feedback' && (
        <Stack spacing="lg">
          <SectionTitle>{t('ds.alerts', 'Alerts')}</SectionTitle>
          <Stack spacing="sm">
            <Alert variant="info" title={t('ds.alertInfo', 'Information')}>{t('ds.alertInfoBody', 'Something notable is happening in the module.')}</Alert>
            <Alert variant="success" title={t('ds.alertSuccess', 'Success')}>{t('ds.alertSuccessBody', 'The operation completed without errors.')}</Alert>
            <Alert variant="warning" title={t('ds.alertWarn', 'Warning')}>{t('ds.alertWarnBody', 'Review before submitting — this may have consequences.')}</Alert>
            <Alert variant="danger" title={t('ds.alertDanger', 'Danger')}>{t('ds.alertDangerBody', 'An error occurred. Details here.')}</Alert>
          </Stack>

          <SectionTitle>{t('ds.stats', 'Stat cards')}</SectionTitle>
          <Grid cols={2} colsLg={4} gap="md">
            <StatCard label={t('ds.students', 'Students')} value="1,284" icon={<Palette size={20} />} trend={8.4} trendLabel={t('ds.vsLastTerm', 'vs last term')} />
            <StatCard label={t('ds.teachers', 'Teachers')} value="42" icon={<Palette size={20} />} trend={2.1} trendLabel={t('ds.vsLastTerm', 'vs last term')} />
            <StatCard label={t('ds.sections', 'Sections')} value="18" icon={<Palette size={20} />} />
            <StatCard label={t('ds.sections', 'Attendance')} value="96%" icon={<Palette size={20} />} trend={-1.2} trendLabel={t('ds.vsLastTerm', 'vs last term')} />
          </Grid>

          <SectionTitle>{t('ds.skeletons', 'Skeleton loaders')}</SectionTitle>
          <Card>
            <CardBody>
              <Skeleton lines={3} />
              <Spacer size="md" />
              <Stack direction="row" spacing="md" align="center">
                <Skeleton circle width={40} height={40} />
                <div style={{ flex: 1 }}>
                  <Skeleton height="14px" width="60%" />
                  <Skeleton height="12px" width="40%" />
                </div>
              </Stack>
            </CardBody>
          </Card>

          <SectionTitle>{t('ds.dividers', 'Dividers & empty')}</SectionTitle>
          <Card>
            <CardBody>
              <Divider label={t('ds.sectionBreak', 'Section break')} />
              <Spacer size="lg" />
              <EmptyState
                icon={<Bell size={24} />}
                title={t('ds.emptyTitle', 'Nothing here yet')}
                description={t('ds.emptyDesc', 'No records match your current filters.')}
                action={<Button size="sm">{t('ds.clearFilters', 'Clear filters')}</Button>}
              />
            </CardBody>
          </Card>
        </Stack>
      )}

      {tab === 'forms' && (
        <Stack spacing="lg">
          <SectionTitle>{t('ds.inputs', 'Inputs')}</SectionTitle>
          <Card>
            <CardBody>
              <Grid cols={1} colsMd={2} gap="lg">
                <Input label={t('ds.fullName', 'Full name')} placeholder={t('ds.namePlaceholder', 'Juan B. Dela Cruz')} hint={t('ds.nameHint', 'As it appears on official records.')} />
                <Input label={t('ds.lrn', 'LRN')} placeholder="1443310811" error={t('ds.lrnError', 'LRN must be exactly 12 digits.')} />
                <Select
                  label={t('ds.gradeLevel', 'Grade level')}
                  placeholder={t('ds.selectLevel', 'Select grade level…')}
                  value={tone}
                  onChange={(e) => setTone(e.target.value)}
                  options={[
                    { value: '7', label: 'Grade 7' },
                    { value: '8', label: 'Grade 8' },
                    { value: '9', label: 'Grade 9' },
                    { value: '10', label: 'Grade 10' },
                  ]}
                />
                <Input label={t('ds.contactNumber', 'Contact number')} placeholder="09XX XXX XXXX" />
                <div style={{ gridColumn: '1 / -1' }}>
                  <Textarea label={t('ds.remarks', 'Remarks')} placeholder={t('ds.remarksPlaceholder', 'Notes, recommendations…')} minRows={4} />
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <FormField label={t('ds.required', 'Required field')} required>
                    <Input placeholder={t('ds.requiredPlaceholder', 'This input is required')} />
                  </FormField>
                </div>
              </Grid>
              <Spacer size="lg" />
              <Divider />
              <Spacer size="lg" />
              <Button onClick={() => setSubmitted((s) => !s)}>
                {submitted ? t('ds.submitted', 'Submit another') : t('ds.submit', 'Submit form')}
              </Button>
              {submitted && (
                <Spacer size="md" />
              )}
              {submitted && (
                <Alert variant="success" title={t('ds.saved', 'Saved')}>{t('ds.savedBody', 'The form data was captured — the design system is wired and working.')}</Alert>
              )}
            </CardBody>
          </Card>
        </Stack>
      )}

      {tab === 'charts' && (
        <Stack spacing="lg">
          <SectionTitle>{t('ds.charts', 'Charts')}</SectionTitle>
          <div className="ds-chart-grid cols-2">
            <Card>
              <CardBody>
                <SectionTitle>ModernBarChart</SectionTitle>
                <ModernBarChart
                  data={DEMO_BARS}
                  categoryKey="name"
                  series={[
                    { key: 'Male', name: 'Male', color: '#4D96FF' },
                    { key: 'Female', name: 'Female', color: '#F5B942' },
                  ]}
                  height={240}
                />
              </CardBody>
            </Card>
            <Card>
              <CardBody>
                <SectionTitle>ModernLineChart</SectionTitle>
                <ModernLineChart
                  data={DEMO_LINE}
                  categoryKey="m"
                  series={[{ key: 'rate', name: 'Attendance', color: 'var(--accent)' }]}
                  area
                  yDomain={[0, 100]}
                  height={240}
                />
              </CardBody>
            </Card>
          </div>

          <div className="ds-chart-grid cols-2">
            <Card>
              <CardBody>
                <SectionTitle>DonutChart</SectionTitle>
                <DonutChart
                  data={DEMO_DONUT}
                  centerValue="78%"
                  centerLabel="Pass rate"
                  size={170}
                />
              </CardBody>
            </Card>
            <Card>
              <CardBody>
                <SectionTitle>Sparkline + ProgressRing</SectionTitle>
                <Stack direction="row" spacing="lg" align="center" wrap>
                  <Stack spacing="sm">
                    <Sparkline data={[12, 16, 9, 18, 14, 22, 19]} stroke="#4D96FF" ariaLabel="Sparkline demo" />
                    <Sparkline data={[20, 14, 17, 12, 8, 11, 6]} stroke="#FB7185" ariaLabel="Sparkline demo 2" />
                  </Stack>
                  <ProgressRing value={72} size={84} stroke={8} tone="success" />
                  <ProgressRing value={45} size={84} stroke={8} tone="warning" />
                </Stack>
              </CardBody>
            </Card>
          </div>

          <div className="ds-chart-grid cols-2">
            <Card>
              <CardBody>
                <SectionTitle>ModernPieChart</SectionTitle>
                <ModernPieChart
                  data={DEMO_DONUT}
                  height={240}
                  legend
                  valueFormatter={(v) => `${v}%`}
                />
              </CardBody>
            </Card>
            <Card>
              <CardBody>
                <SectionTitle>ModernComposedChart</SectionTitle>
                <ModernComposedChart
                  data={DEMO_BARS}
                  categoryKey="name"
                  series={[
                    { key: 'Male', name: 'Male', color: '#4D96FF', type: 'bar' },
                    { key: 'Female', name: 'Female', color: '#F5B942', type: 'bar' },
                    { key: 'rate', name: 'Pass %', color: 'var(--accent-2)', type: 'line' },
                  ]}
                  legend
                  yDomain={[0, 100]}
                  height={240}
                />
              </CardBody>
            </Card>
          </div>
        </Stack>
      )}
    </div>
  );
}
