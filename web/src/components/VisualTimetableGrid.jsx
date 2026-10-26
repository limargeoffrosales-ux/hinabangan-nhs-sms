import React from 'react';
import { Calendar, Clock } from 'lucide-react';

const DAYS = [
  { id: 1, name: 'Monday', short: 'MON' },
  { id: 2, name: 'Tuesday', short: 'TUE' },
  { id: 3, name: 'Wednesday', short: 'WED' },
  { id: 4, name: 'Thursday', short: 'THU' },
  { id: 5, name: 'Friday', short: 'FRI' },
];

export default function VisualTimetableGrid({ weekly = [] }) {
  const currentDay = new Date().getDay(); // 1=Mon ... 5=Fri
  const nowHour = new Date().getHours();
  const nowMin = new Date().getMinutes();
  const currentTotalMin = nowHour * 60 + nowMin;

  const grouped = {};
  for (const item of weekly) {
    const dayId = item.day || 1;
    if (!grouped[dayId]) grouped[dayId] = [];
    grouped[dayId].push(item);
  }

  function isLiveClass(item, dayId) {
    if (currentDay !== dayId) return false;
    if (!item.start_time || !item.end_time) return false;
    const [sh, sm] = item.start_time.split(':').map(Number);
    const [eh, em] = item.end_time.split(':').map(Number);
    if (isNaN(sh) || isNaN(eh)) return false;
    const startMin = sh * 60 + (sm || 0);
    const endMin = eh * 60 + (em || 0);
    return currentTotalMin >= startMin && currentTotalMin <= endMin;
  }

  return (
    <div style={{ background: 'var(--card)', borderRadius: 20, border: '1px solid var(--border)', padding: 20, marginTop: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Calendar size={18} style={{ color: 'var(--primary)' }} /> Visual Weekly Timetable
        </h3>
        <span className="badge badge-green">SY 2026–2027</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, overflowX: 'auto' }}>
        {DAYS.map((day) => {
          const classes = grouped[day.id] || [];
          const isToday = currentDay === day.id;

          return (
            <div
              key={day.id}
              style={{
                background: isToday ? 'var(--primary-tint)' : 'var(--bg-soft)',
                border: isToday ? '2px solid var(--primary)' : '1px solid var(--border)',
                borderRadius: 14,
                padding: 12,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, paddingBottom: 6, borderBottom: '1px solid var(--border)' }}>
                <strong style={{ fontSize: 13, color: isToday ? 'var(--primary)' : 'var(--text)' }}>
                  {day.name}
                </strong>
                {isToday && <span className="badge badge-green" style={{ fontSize: 9 }}>TODAY</span>}
              </div>

              <div style={{ display: 'grid', gap: 8 }}>
                {classes.length === 0 ? (
                  <div className="sub" style={{ fontSize: 11, textAlign: 'center', padding: '12px 0' }}>No classes</div>
                ) : (
                  classes.map((cls, idx) => {
                    const live = isLiveClass(cls, day.id);
                    return (
                      <div
                        key={idx}
                        style={{
                          padding: 10,
                          borderRadius: 10,
                          background: live ? '#FFFDF7' : 'var(--card)',
                          border: live ? '2px solid #F5A623' : '1px solid var(--border)',
                          boxShadow: live ? '0 4px 14px rgba(245, 166, 35, 0.25)' : 'none',
                          position: 'relative',
                        }}
                      >
                        {live && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
                            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#F5A623' }} />
                            <span style={{ fontSize: 9, fontWeight: 800, color: '#DB8F10' }}>LIVE NOW</span>
                          </div>
                        )}
                        <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--primary)' }}>
                          {cls.subject_code || cls.subject_title || 'Subject'}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Clock size={10} /> {cls.start_time}–{cls.end_time}
                        </div>
                        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text)', marginTop: 4 }}>
                          📍 {cls.room || 'Room 101'}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
