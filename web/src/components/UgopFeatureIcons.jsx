import React from 'react';
import TarikMascot from './TarikMascot';

// Master Set of 30 App Feature Icons featuring Tarik (Samar Tarictic Hornbill)
// Integrated across all UGOP system pages.

export const FEATURE_ICONS = [
  { id: 'sections', name: 'Sections', pose: 'happy', icon: '📦', color: '#1B6B4A', desc: 'Manage class sections & rosters', to: '/sections' },
  { id: 'students', name: 'Students', pose: 'waving', icon: '🎒', color: '#1E88B5', desc: 'Learner profile & DepEd LRNs', to: '/students' },
  { id: 'teachers', name: 'Teachers', pose: 'happy', icon: '👨‍🏫', color: '#1B6B4A', desc: 'Faculty & teacher workloads', to: '/teachers' },
  { id: 'attendance', name: 'Attendance', pose: 'clipboard', icon: '📅', color: '#2E9E5B', desc: 'Daily attendance & SF2 logs', to: '/attendance' },
  { id: 'gate_check', name: 'Gate Check', pose: 'surprised', icon: '📲', color: '#1B6B4A', desc: 'QR ID scan gate check-in', to: '/attendance' },
  { id: 'advisory', name: 'Advisory Class', pose: 'happy', icon: '🏫', color: '#F5A623', desc: 'Advisory section management', to: '/sections' },
  { id: 'schedule', name: 'Schedule', pose: 'thinking', icon: '⏰', color: '#1E88B5', desc: 'Class timetables & programs', to: '/programs' },
  { id: 'rewards', name: 'Rewards', pose: 'cheering', icon: '🏅', color: '#F5A623', desc: 'Student achievements & badges', to: '/achievements' },
  { id: 'exams', name: 'Exams', pose: 'reading', icon: '📝', color: '#D64545', desc: 'Quarterly exam management', to: '/assessment' },
  { id: 'test_maker', name: 'Test Maker', pose: 'ai', icon: '🪄', color: '#2E9E5B', desc: 'AI test & quiz generator', to: '/ai' },
  { id: 'competencies', name: 'Competencies', pose: 'happy', icon: '🎯', color: '#1B6B4A', desc: 'DepEd MELCs tracker', to: '/competency-tracker' },
  { id: 'results', name: 'Assessment Results', pose: 'cheering', icon: '⭐', color: '#F5A623', desc: 'Learner score reports', to: '/rankings' },
  { id: 'item_analysis', name: 'Item Analysis', pose: 'thinking', icon: '🔍', color: '#1E88B5', desc: 'Test question discrimination', to: '/assessment' },
  { id: 'reading', name: 'Reading Assessment', pose: 'reading', icon: '📖', color: '#1B6B4A', desc: 'PHIL-IRI & EGRA reading', to: '/aral' },
  { id: 'class_record', name: 'Class Record', pose: 'clipboard', icon: '📊', color: '#2E9E5B', desc: 'Term 1-3 E-Class Records', to: '/grades' },
  { id: 'grade_portal', name: 'Grade Portal', pose: 'happy', icon: '💻', color: '#1E88B5', desc: 'Digital grade reporting', to: '/grades' },
  { id: 'remarks', name: 'Report Card Remarks', pose: 'reading', icon: '✍️', color: '#F5A623', desc: 'SF9 comments & conduct', to: '/discipline' },
  { id: 'lesson_planner', name: 'Lesson Planner', pose: 'ai', icon: '📑', color: '#1B6B4A', desc: 'Master teacher lesson plans', to: '/lessons' },
  { id: 'rubric_maker', name: 'Rubric Maker', pose: 'thinking', icon: '📐', color: '#1E88B5', desc: 'Performance task rubrics', to: '/assessment' },
  { id: 'sf_forms', name: 'SF Forms', pose: 'clipboard', icon: '📁', color: '#1B6B4A', desc: 'DepEd Forms SF1 to SF10', to: '/deped-forms' },
  { id: 'career_map', name: 'Career Map', pose: 'waving', icon: '🗺️', color: '#2E9E5B', desc: 'Work immersion & TVL map', to: '/career-tvl' },
  { id: 'announcements', name: 'Announcements', pose: 'surprised', icon: '📢', color: '#D64545', desc: 'School announcements & alerts', to: '/announcements' },
  { id: 'aral', name: 'ARAL Program', pose: 'reading', icon: '🎓', color: '#1B6B4A', desc: 'Reading & numeracy remediation', to: '/aral' },
  { id: 'immersion', name: 'Work Immersion', pose: 'happy', icon: '💼', color: '#F5A623', desc: 'SHS TVL Work Immersion & JDVP', to: '/immersion' },
  { id: 'messages', name: 'Messages', pose: 'happy', icon: '💬', color: '#1E88B5', desc: 'Parent & teacher chat', to: '/notifications' },
  { id: 'ask_ugop', name: 'Ask TARIK AI', pose: 'ai', icon: '✨', color: '#F5A623', desc: 'AI virtual assistant', to: '/ai' },
  { id: 'compliance', name: 'Compliance', pose: 'thinking', icon: '📜', color: '#1B6B4A', desc: 'RA 10173 & 5-year retention', to: '/compliance' },
  { id: 'audit_logs', name: 'Audit Logs', pose: 'thinking', icon: '🛡️', color: '#1B6B4A', desc: 'Security & system history', to: '/audit' },
  { id: 'privacy_shield', name: 'Privacy Shield', pose: 'happy', icon: '🔒', color: '#2E9E5B', desc: 'RA 10173 data protection', to: '/privacy' },
  { id: 'deped_forms', name: 'DepEd Forms Hub', pose: 'clipboard', icon: '📋', color: '#1E88B5', desc: 'Official SF1-SF10 documents', to: '/deped-forms' },
];

export function UgopTileIcon({ item, size = 110, onClick }) {
  return (
    <div
      onClick={onClick}
      style={{
        width: size,
        height: size,
        background: '#E6F2EC',
        borderRadius: '20px',
        border: '1.5px solid #DCE7E0',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        boxShadow: '0 4px 14px rgba(18, 38, 28, 0.05)',
        cursor: 'pointer',
        transition: 'transform 0.15s ease, box-shadow 0.15s ease',
      }}
      className="ugop-tile-icon"
      title={`${item.name} — ${item.desc}`}
    >
      <TarikMascot pose={item.pose} size={size * 0.62} />
      <span
        style={{
          position: 'absolute',
          bottom: 8,
          right: 8,
          fontSize: size * 0.2,
          lineHeight: 1,
          filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.15))',
        }}
      >
        {item.icon}
      </span>
    </div>
  );
}

export function TarikIcon({ pose = 'happy', emoji = '✨', size = 20 }) {
  return (
    <span
      style={{
        width: size + 8,
        height: size + 8,
        background: '#E6F2EC',
        borderRadius: 8,
        border: '1px solid #DCE7E0',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        verticalAlign: 'middle',
        flexShrink: 0,
        marginRight: 8,
      }}
    >
      <TarikMascot pose={pose} size={size * 0.85} />
      <span style={{ position: 'absolute', bottom: -2, right: -2, fontSize: size * 0.45, lineHeight: 1, filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.15))' }}>{emoji}</span>
    </span>
  );
}

export default function UgopFeatureIconsGrid() {
  return (
    <div style={{ background: '#FFFFFF', padding: '32px', borderRadius: '24px', border: '1px solid #DCE7E0', boxShadow: '0 8px 30px rgba(18,38,28,0.06)' }}>
      <div style={{ marginBottom: 24, borderBottom: '1px solid #DCE7E0', paddingBottom: 16 }}>
        <span className="badge badge-green" style={{ marginBottom: 6 }}>Master 30 App-Feature Tiles</span>
        <h2 style={{ margin: '4px 0 2px 0', fontSize: 24, fontWeight: 800, color: '#12261C', fontFamily: 'var(--font-display)' }}>
          TARIK System-Wide Feature Icons (6x5 Grid)
        </h2>
        <p style={{ margin: 0, color: '#5B6F63', fontSize: 13.5 }}>
          Integrated across all TARIK modules, quick actions, dashboards, and portals.
        </p>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(6, 1fr)',
          gap: 16,
          justifyItems: 'center',
        }}
      >
        {FEATURE_ICONS.map((item) => (
          <div key={item.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
            <UgopTileIcon item={item} size={130} />
            <strong style={{ fontSize: 13, color: '#12261C', marginTop: 10, fontFamily: 'var(--font-display)' }}>{item.name}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}
