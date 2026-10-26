import React, { useRef } from 'react';
import { Printer, QrCode, ShieldCheck } from 'lucide-react';
import TarikCrestLogo from './TarikCrestLogo';
import { printElementHtml } from '../lib/export';

export default function DigitalStudentIdCard({ student }) {
  const cardRef = useRef(null);

  if (!student) return null;

  const lrn = student.lrn || '303606120001';
  const name = `${student.first_name} ${student.middle_name || ''} ${student.last_name}`.toUpperCase();
  const grade = student.grade_level || 'Grade 11';
  const strand = student.track_strand || 'TVL-ICT';

  // Generate scannable QR code API URL
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=110x110&data=${encodeURIComponent(lrn)}`;

  function printIdCard() {
    if (!cardRef.current) return;
    const html = cardRef.current.outerHTML;
    const css = `@page{size:3.375in 2.125in;margin:0}body{font-family:'Inter',sans-serif;margin:0;padding:0;-webkit-print-color-adjust:exact}`;
    const full = `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head><body>${html}</body></html>`;
    printElementHtml(`Student ID - ${lrn}`, full, { orientation: 'portrait', paper: 'letter' });
  }

  return (
    <div style={{ margin: '16px 0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8 }}>
          <QrCode size={18} style={{ color: 'var(--primary)' }} /> Digital Student QR ID Badge
        </h3>
        <button className="btn btn-primary btn-sm" onClick={printIdCard}>
          <Printer size={14} /> Print Student ID Card
        </button>
      </div>

      {/* ID Card Front Container */}
      <div
        ref={cardRef}
        style={{
          width: 340,
          background: 'linear-gradient(135deg, #0F5A36, #1E7A4B)',
          borderRadius: 18,
          border: '3px solid #D9A834',
          color: '#FFFFFF',
          padding: '16px 18px',
          boxShadow: '0 12px 30px rgba(15,90,54,0.3)',
          position: 'relative',
          overflow: 'hidden',
          margin: '0 auto',
        }}
      >
        {/* Top Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid rgba(255,255,255,0.25)', paddingBottom: 10, marginBottom: 12 }}>
          <TarikCrestLogo size={42} style={{ border: '2px solid #D9A834' }} />
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.5, opacity: 0.9 }}>REPUBLIC OF THE PHILIPPINES · DEPED</div>
            <div style={{ fontSize: 13, fontWeight: 800, fontFamily: 'var(--font-display)' }}>HINABANGAN NATIONAL HIGH SCHOOL</div>
            <div style={{ fontSize: 9.5, opacity: 0.8 }}>School ID: 303606 · Hinabangan, Samar</div>
          </div>
        </div>

        {/* Body Info & QR */}
        <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
          {/* Avatar Photo */}
          <div
            style={{
              width: 76,
              height: 90,
              background: '#F7EFD6',
              borderRadius: 12,
              border: '2px solid #D9A834',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              color: '#12261C',
            }}
          >
            <span style={{ fontSize: 32 }}>🎓</span>
            <span style={{ fontSize: 9, fontWeight: 800, marginTop: 2 }}>STUDENT</span>
          </div>

          {/* Student Details */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: '#F7EFD6', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {name}
            </div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#D9A834', marginTop: 2 }}>
              LRN: {lrn}
            </div>
            <div style={{ fontSize: 11, opacity: 0.9, marginTop: 4 }}>
              {grade} · {strand}
            </div>
            <div style={{ fontSize: 10, opacity: 0.8, marginTop: 2 }}>
              SY 2026–2027 · Validated
            </div>
          </div>

          {/* Scannable Gate QR Code */}
          <div style={{ background: '#FFFFFF', padding: 4, borderRadius: 8, flexShrink: 0 }}>
            <img src={qrUrl} alt="Gate QR" style={{ width: 60, height: 60, display: 'block' }} />
            <div style={{ fontSize: 7.5, color: '#12261C', textAlign: 'center', fontWeight: 800, marginTop: 2 }}>SCAN GATE</div>
          </div>
        </div>

        {/* Footer Security Badge */}
        <div style={{ marginTop: 12, paddingTop: 6, borderTop: '1px solid rgba(255,255,255,0.2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 9, opacity: 0.85 }}>
          <span><ShieldCheck size={11} style={{ verticalAlign: -1, marginRight: 3 }} /> RA 10173 Protected</span>
          <span>Official DepEd Learner Badge</span>
        </div>
      </div>
    </div>
  );
}
