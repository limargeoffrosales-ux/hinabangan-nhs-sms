import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { FEATURE_ICONS } from './UgopFeatureIcons';
import TarikMascot from './TarikMascot';

// Teacher's Corner / Admin Corner Dashboard Cards matching the SURY style
export default function UgopTeacherCorner() {
  const navigate = useNavigate();

  const cards = [
    { id: 'lessons', name: 'Lesson Planner & DLL', desc: 'Master teacher lesson plans & guides', to: '/lessons', pose: 'ai', badge: 'NEW' },
    { id: 'class_record', name: 'Term Class Records', desc: 'Term 1-3 E-Class Records & Grade matrices', to: '/grades', pose: 'clipboard', badge: 'NEW' },
    { id: 'test_maker', name: 'AI Test & Quiz Maker', desc: 'Generate quizzes with table of specifications', to: '/ai', pose: 'ai', badge: 'NEW' },
    { id: 'sf_forms', name: 'DepEd School Forms Hub', desc: 'Generate official SF1 to SF10 reports', to: '/deped-forms', pose: 'clipboard' },
    { id: 'attendance', name: 'Daily Attendance & SF2', desc: 'Track student attendance & daily logs', to: '/attendance', pose: 'clipboard' },
    { id: 'aral', name: 'ARAL Remediation Program', desc: 'Reading & numeracy intervention tracking', to: '/aral', pose: 'reading', badge: 'NEW' },
    { id: 'immersion', name: 'Work Immersion & JDVP', desc: 'Placement maps and partner summaries', to: '/immersion', pose: 'happy' },
    { id: 'competencies', name: 'DepEd MELCs Tracker', desc: 'Monitor curriculum competency progress', to: '/competency-tracker', pose: 'happy' },
  ];

  return (
    <div style={{ background: '#FFFFFF', padding: '24px', borderRadius: '24px', border: '1px solid #DCE7E0', boxShadow: '0 8px 30px rgba(18,38,28,0.06)', marginBottom: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18, borderBottom: '1px solid #DCE7E0', paddingBottom: 12 }}>
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#12261C', fontFamily: 'var(--font-display)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>📚</span> TEACHER &amp; ADMIN CORNER
        </h3>
        <span className="badge badge-green">UGOP Platform</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 14 }}>
        {cards.map((c) => (
          <div
            key={c.id}
            onClick={() => navigate(c.to)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 16,
              padding: '16px 18px',
              background: '#F4F8F5',
              border: '1px solid #DCE7E0',
              borderRadius: '18px',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
            className="ugop-corner-card"
          >
            {/* Larger Pale-green tile thumbnail with Tarik */}
            <div
              style={{
                width: 72,
                height: 72,
                background: '#E6F2EC',
                borderRadius: '18px',
                border: '1.5px solid #DCE7E0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                boxShadow: '0 4px 12px rgba(18,38,28,0.06)',
              }}
            >
              <TarikMascot pose={c.pose} size={58} />
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <strong style={{ fontSize: 14.5, color: '#12261C', fontFamily: 'var(--font-display)' }}>{c.name}</strong>
                {c.badge && <span className="badge badge-green" style={{ fontSize: 10, padding: '1px 6px' }}>{c.badge}</span>}
              </div>
              <div style={{ fontSize: 12.5, color: '#5B6F63', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.desc}</div>
            </div>

            <ChevronRight size={18} style={{ color: '#5B6F63', flexShrink: 0 }} />
          </div>
        ))}
      </div>
    </div>
  );
}
