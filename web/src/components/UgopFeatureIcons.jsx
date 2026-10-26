import React from 'react';
import TarikMascot from './TarikMascot';

// Master Set of 30 App Feature Icons featuring the exact uploaded Tarik artwork (/tarik-grid-tiles.jpg)
export const FEATURE_ICONS = [
  { id: 'sections', name: 'Sections', col: 0, row: 0, pose: 'happy', icon: '📦', to: '/sections' },
  { id: 'students', name: 'Students', col: 1, row: 0, pose: 'waving', icon: '🎒', to: '/students' },
  { id: 'teachers', name: 'Teachers', col: 2, row: 0, pose: 'happy', icon: '👨‍🏫', to: '/teachers' },
  { id: 'attendance', name: 'Attendance', col: 2, row: 0, pose: 'clipboard', icon: '📅', to: '/attendance' },
  { id: 'gate_check', name: 'Gate Check', col: 3, row: 0, pose: 'surprised', icon: '📲', to: '/attendance' },
  { id: 'advisory', name: 'Advisory Class', col: 4, row: 0, pose: 'happy', icon: '🏫', to: '/sections' },
  { id: 'schedule', name: 'Schedule', col: 5, row: 0, pose: 'thinking', icon: '⏰', to: '/programs' },
  { id: 'rewards', name: 'Rewards', col: 6, row: 0, pose: 'cheering', icon: '🏅', to: '/achievements' },
  { id: 'results', name: 'Results', col: 7, row: 0, pose: 'happy', icon: '⭐', to: '/rankings' },

  { id: 'exams', name: 'Exams', col: 3, row: 1, pose: 'reading', icon: '📝', to: '/assessment' },
  { id: 'test_maker', name: 'Test Maker', col: 4, row: 1, pose: 'thinking', icon: '🪄', to: '/ai' },
  { id: 'competencies', name: 'Competencies', col: 5, row: 1, pose: 'happy', icon: '🎯', to: '/competency-tracker' },
  { id: 'assessment_results', name: 'Assessment Results', col: 6, row: 1, pose: 'cheering', icon: '📊', to: '/rankings' },
  { id: 'class_record', name: 'Class Record', col: 7, row: 1, pose: 'clipboard', icon: '📊', to: '/grades' },

  { id: 'item_analysis', name: 'Item Analysis', col: 1, row: 2, pose: 'thinking', icon: '🔍', to: '/assessment' },
  { id: 'reading', name: 'Reading Assessment', col: 2, row: 2, pose: 'reading', icon: '📖', to: '/aral' },
  { id: 'grade_portal', name: 'Grade Portal', col: 4, row: 2, pose: 'happy', icon: '💻', to: '/grades' },
  { id: 'remarks', name: 'Report Card Remarks', col: 5, row: 2, pose: 'reading', icon: '✍️', to: '/discipline' },
  { id: 'lesson_planner', name: 'Lesson Planner', col: 6, row: 2, pose: 'thinking', icon: '📑', to: '/lessons' },
  { id: 'rubric_maker', name: 'Rubric Maker', col: 7, row: 2, pose: 'clipboard', icon: '📐', to: '/assessment' },

  { id: 'sf_forms', name: 'SF Forms', col: 2, row: 3, pose: 'clipboard', icon: '📁', to: '/deped-forms' },
  { id: 'career_map', name: 'Career Map', col: 3, row: 3, pose: 'waving', icon: '🗺️', to: '/career-tvl' },
  { id: 'messages', name: 'Messages', col: 4, row: 3, pose: 'happy', icon: '💬', to: '/notifications' },
  { id: 'ask_ugop', name: 'Ask TARIK AI', col: 5, row: 3, pose: 'thinking', icon: '✨', to: '/ai' },
  { id: 'audit_logs', name: 'Audit Logs', col: 6, row: 3, pose: 'thinking', icon: '🛡️', to: '/audit' },
  { id: 'privacy_shield', name: 'Privacy Shield', col: 7, row: 3, pose: 'happy', icon: '🔒', to: '/privacy' },
];

export function UgopTileIcon({ item, size = 110, onClick }) {
  const col = item.col !== undefined ? item.col : 0;
  const row = item.row !== undefined ? item.row : 0;
  const posX = (col / 7) * 100;
  const posY = (row / 3) * 100;

  return (
    <div
      onClick={onClick}
      style={{
        width: size,
        height: size,
        background: 'transparent',
        backgroundImage: 'url(/tarik-grid-tiles.jpg)',
        backgroundSize: '800% 400%',
        backgroundPosition: `${posX}% ${posY}%`,
        backgroundRepeat: 'no-repeat',
        filter: 'contrast(160%) brightness(99%) saturate(120%)',
        mixBlendMode: 'darken',
        cursor: 'pointer',
        transition: 'transform 0.18s ease',
      }}
      className="ugop-tile-icon"
      title={item.name}
    />
  );
}

export function TarikIcon({ pose = 'happy', emoji = '✨', size = 32 }) {
  return (
    <TarikMascot pose={pose} size={size} />
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
