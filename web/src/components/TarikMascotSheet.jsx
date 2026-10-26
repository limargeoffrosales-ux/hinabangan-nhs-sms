import React from 'react';
import TarikMascot from './TarikMascot';

// Complete Anime Mascot Character Sheet of "Tarik" — Samar Tarictic Hornbill
export default function TarikMascotSheet() {
  const TARIK_POSES = [
    { key: 'waving', label: 'Waving', desc: 'Greeting students and welcoming teachers' },
    { key: 'reading', label: 'Reading a Book', desc: 'Studying in the Learning Hub' },
    { key: 'cheering', label: 'Cheering with Trophy', desc: 'Celebrating academic achievements and awards' },
    { key: 'thinking', label: 'Thinking with Lightbulb', desc: 'Pondering AI prompts and lesson plans' },
    { key: 'clipboard', label: 'Checking Clipboard', desc: 'Auditing reports and attendance check-ins' },
    { key: 'surprised', label: 'Surprised', desc: 'Notice alerts and action required warnings' },
    { key: 'sleepy', label: 'Sleepy', desc: 'Late night study mode or system idle state' },
    { key: 'happy', label: 'Happy with Sparkles', desc: 'Success toasts, badges, and completed tasks' },
  ];

  return (
    <div style={{ background: '#FFFFFF', padding: '32px', borderRadius: '20px', border: '1px solid #DCE7E0', boxShadow: '0 4px 20px rgba(18,38,28,0.06)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, paddingBottom: 16, borderBottom: '1px solid #DCE7E0' }}>
        <div>
          <span className="badge badge-green" style={{ marginBottom: 6 }}>Official TARIK Mascot Character Sheet</span>
          <h2 style={{ margin: '4px 0 2px 0', fontSize: 24, fontWeight: 800, color: '#12261C', fontFamily: 'var(--font-display)' }}>
            Tarik — Samar Tarictic Hornbill <span style={{ fontSize: 16, fontWeight: 500, color: '#5B6F63' }}>(Penelopides samarensis)</span>
          </h2>
          <p style={{ margin: 0, color: '#5B6F63', fontSize: 13.5 }}>
            Anatomy: Cream-white head/chest, black eye stripe, curved reddish bill (#C0503C), amber ridged casque, dark blue-black wings, rufous tail, traditional Salakot hat &amp; DepEd green school ID lanyard.
          </p>
        </div>
        <TarikMascot pose="waving" size={64} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 20 }}>
        {TARIK_POSES.map((p) => (
          <div
            key={p.key}
            style={{
              background: '#F4F8F5',
              border: '1px solid #DCE7E0',
              borderRadius: '16px',
              padding: '20px 16px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              textAlign: 'center',
              transition: 'transform 0.2s ease, box-shadow 0.2s ease',
            }}
          >
            <div style={{ background: '#FFFFFF', padding: '16px', borderRadius: '50%', boxShadow: '0 4px 12px rgba(18,38,28,0.08)', marginBottom: 12 }}>
              <TarikMascot pose={p.key} size={100} />
            </div>
            <strong style={{ fontSize: 15, color: '#12261C', fontFamily: 'var(--font-display)' }}>{p.label}</strong>
            <span style={{ fontSize: 12, color: '#5B6F63', marginTop: 4 }}>{p.desc}</span>
            <code style={{ fontSize: 11, background: '#E6F2EC', color: '#1B6B4A', padding: '2px 8px', borderRadius: 4, marginTop: 10, fontWeight: 'bold' }}>
              pose="{p.key}"
            </code>
          </div>
        ))}
      </div>
    </div>
  );
}
