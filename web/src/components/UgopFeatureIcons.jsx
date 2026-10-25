import React from 'react';
import TarikMascot from './TarikMascot';

// Set of 24 App Feature Icons featuring Tarik (Samar Tarictic Hornbill)
// 6x4 Grid on rounded-square pale-green (#E6F2EC) tiles.

export const FEATURE_ICONS = [
  { id: 'sections', name: 'Sections', pose: 'happy', icon: '📦', color: '#1B6B4A', desc: 'Manage class sections & rosters' },
  { id: 'students', name: 'Students', pose: 'waving', icon: '🎒', color: '#1E88B5', desc: 'Learner profile & DepEd LRNs' },
  { id: 'attendance', name: 'Attendance', pose: 'clipboard', icon: '📅', color: '#2E9E5B', desc: 'Daily attendance & SF2 logs' },
  { id: 'gate_check', name: 'Gate Check', pose: 'surprised', icon: '📲', color: '#1B6B4A', desc: 'QR ID scan gate check-in' },
  { id: 'advisory', name: 'Advisory Class', pose: 'happy', icon: '🏫', color: '#F5A623', desc: 'Advisory section management' },
  { id: 'schedule', name: 'Schedule', pose: 'thinking', icon: '⏰', color: '#1E88B5', desc: 'Class timetables & programs' },
  { id: 'rewards', name: 'Rewards', pose: 'cheering', icon: '🏅', color: '#F5A623', desc: 'Student achievements & badges' },
  { id: 'exams', name: 'Exams', pose: 'reading', icon: '📝', color: '#D64545', desc: 'Quarterly exam management' },
  { id: 'test_maker', name: 'Test Maker', pose: 'ai', icon: '🪄', color: '#2E9E5B', desc: 'AI test & quiz generator' },
  { id: 'competencies', name: 'Competencies', pose: 'happy', icon: '🎯', color: '#1B6B4A', desc: 'DepEd MELCs tracker' },
  { id: 'results', name: 'Assessment Results', pose: 'cheering', icon: '⭐', color: '#F5A623', desc: 'Learner score reports' },
  { id: 'item_analysis', name: 'Item Analysis', pose: 'thinking', icon: '🔍', color: '#1E88B5', desc: 'Test question discrimination' },
  { id: 'reading', name: 'Reading Assessment', pose: 'reading', icon: '📖', color: '#1B6B4A', desc: 'PHIL-IRI & EGRA reading' },
  { id: 'class_record', name: 'Class Record', pose: 'clipboard', icon: '📊', color: '#2E9E5B', desc: 'Term 1-3 E-Class Records' },
  { id: 'grade_portal', name: 'Grade Portal', pose: 'happy', icon: '💻', color: '#1E88B5', desc: 'Digital grade reporting' },
  { id: 'remarks', name: 'Report Card Remarks', pose: 'reading', icon: '✍️', color: '#F5A623', desc: 'SF9 comments & conduct' },
  { id: 'lesson_planner', name: 'Lesson Planner', pose: 'ai', icon: '📑', color: '#1B6B4A', desc: 'Master teacher lesson plans' },
  { id: 'rubric_maker', name: 'Rubric Maker', pose: 'thinking', icon: '📐', color: '#1E88B5', desc: 'Performance task rubrics' },
  { id: 'sf_forms', name: 'SF Forms', pose: 'clipboard', icon: '📁', color: '#1B6B4A', desc: 'DepEd Forms SF1 to SF10' },
  { id: 'career_map', name: 'Career Map', pose: 'waving', icon: '🗺️', color: '#2E9E5B', desc: 'Work immersion & TVL map' },
  { id: 'messages', name: 'Messages', pose: 'happy', icon: '💬', color: '#1E88B5', desc: 'Parent & teacher chat' },
  { id: 'ask_ugop', name: 'Ask UGOP AI', pose: 'ai', icon: '✨', color: '#F5A623', desc: 'AI virtual assistant' },
  { id: 'audit_logs', name: 'Audit Logs', pose: 'thinking', icon: '🛡️', color: '#1B6B4A', desc: 'Security & system history' },
  { id: 'privacy_shield', name: 'Privacy Shield', pose: 'happy', icon: '🔒', color: '#2E9E5B', desc: 'RA 10173 data protection' },
];

export function UgopTileIcon({ item, size = 110 }) {
  return (
    <div
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

export default function UgopFeatureIconsGrid() {
  return (
    <div style={{ background: '#FFFFFF', padding: '32px', borderRadius: '24px', border: '1px solid #DCE7E0', boxShadow: '0 8px 30px rgba(18,38,28,0.06)' }}>
      <div style={{ marginBottom: 24, borderBottom: '1px solid #DCE7E0', paddingBottom: 16 }}>
        <span className="badge badge-green" style={{ marginBottom: 6 }}>24 Square App-Feature Tiles</span>
        <h2 style={{ margin: '4px 0 2px 0', fontSize: 24, fontWeight: 800, color: '#12261C', fontFamily: 'var(--font-display)' }}>
          UGOP Tarik Feature Icon Set (6x4 Grid)
        </h2>
        <p style={{ margin: 0, color: '#5B6F63', fontSize: 13.5 }}>
          Pale-green (#E6F2EC) tiles featuring Tarik mascot in kawaii anime poses interacting with school feature objects.
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
            <UgopTileIcon item={item} size={110} />
            <strong style={{ fontSize: 12.5, color: '#12261C', marginTop: 8, fontFamily: 'var(--font-display)' }}>{item.name}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}
