import React from 'react';

// Official TARIK Icon Set Component (38 Vector Line Icons)
// Main stroke: #1F5D3A (green), Accent: #D9622B (orange)

export function TarikVectorIcon({ name, size = 20, strokeWidth = 1.75, style = {} }) {
  const icons = {
    mascot: <><path d="M4 10l8-7 8 7z"/><circle cx="10" cy="15" r="5"/><path stroke="var(--accent, #D9622B)" d="M14 14h7l-3 4h-4z"/><path d="M8.5 14.5h.01"/></>,
    dashboard: <><rect x="3" y="3" width="8" height="8" rx="2"/><rect stroke="var(--accent, #D9A834)" x="13" y="3" width="8" height="5" rx="2"/><rect x="13" y="11" width="8" height="10" rx="2"/><rect stroke="var(--accent, #D9A834)" x="3" y="14" width="8" height="7" rx="2"/></>,
    students: <><circle cx="12" cy="8" r="3.5"/><path stroke="var(--accent, #D9622B)" d="M5 20c0-4 3-6 7-6s7 2 7 6"/></>,
    teachers: <><circle cx="12" cy="9" r="3.5"/><path d="M5 20c0-4 3-6 7-6s7 2 7 6"/><path stroke="var(--accent, #D9622B)" d="M8 5l4-3 4 3"/></>,
    users: <><circle cx="9" cy="8" r="3"/><path d="M3 19c0-3 2.5-5 6-5s6 2 6 5"/><path stroke="var(--accent, #D9622B)" d="M17 4l3 1.2v3c0 2-1.3 3.4-3 4-1.7-.6-3-2-3-4v-3z"/></>,
    curriculum: <><path d="M4 5c3-1 6-1 8 1 2-2 5-2 8-1v13c-3-1-6-1-8 1-2-2-5-2-8-1z"/><path stroke="var(--accent, #D9622B)" d="M12 6v13"/></>,
    subjects: <><rect x="5" y="3" width="14" height="18" rx="2"/><path stroke="var(--accent, #D9622B)" d="M9 8h6M9 12h6M9 16h3"/></>,
    sections: <><rect x="3" y="4" width="18" height="12" rx="2"/><path stroke="var(--accent, #D9622B)" d="M8 20h8M12 16v4"/><path d="M7 9h4M7 12h7"/></>,
    enrollment: <><path d="M5 3h10l4 4v14H5z"/><path stroke="var(--accent, #D9622B)" d="M9 14l2 2 4-4"/></>,
    lessons: <><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 3v18"/><path stroke="var(--accent, #D9622B)" d="M12 8h5M12 12h5"/></>,
    competency: <><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path stroke="var(--accent, #D9622B)" d="M8.5 12l2.5 2.5 4.5-5"/></>,
    classRecords: <><rect x="5" y="4" width="14" height="17" rx="2"/><rect stroke="var(--accent, #D9622B)" x="9" y="2" width="6" height="4" rx="1"/><path d="M9 11h6M9 15h6"/></>,
    assignments: <><path d="M4 20l1-4L16 5l3 3L8 19z"/><path stroke="var(--accent, #D9622B)" d="M14 7l3 3"/></>,
    gradingScales: <><path d="M4 20h16"/><rect x="5" y="12" width="3" height="8"/><rect stroke="var(--accent, #D9622B)" x="10.5" y="8" width="3" height="12"/><rect x="16" y="4" width="3" height="16"/></>,
    rankings: <><path d="M8 4h8v5a4 4 0 01-8 0z"/><path stroke="var(--accent, #D9622B)" d="M8 6H5v1a3 3 0 003 3M16 6h3v1a3 3 0 01-3 3"/><path d="M12 13v4M8 20h8M9.5 17h5"/></>,
    attendance: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/><path stroke="var(--accent, #D9622B)" d="M9 15l2 2 4-4"/></>,
    gateCheck: <><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path stroke="var(--accent, #D9622B)" d="M14 14h3v3M21 14v7h-4M14 21v-3"/></>,
    aral: <><path d="M4 6c3-1 6-1 8 1v12c-2-2-5-2-8-1z"/><path d="M20 6c-3-1-6-1-8 1v12c2-2 5-2 8-1z"/><path stroke="var(--accent, #D9622B)" d="M12 2v2"/></>,
    immersion: <><path d="M12 21s7-6 7-11a7 7 0 10-14 0c0 5 7 11 7 11z"/><circle stroke="var(--accent, #D9622B)" cx="12" cy="10" r="2.5"/></>,
    career: <><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2"/><path stroke="var(--accent, #D9622B)" d="M3 13h18"/></>,
    certifications: <><circle cx="12" cy="9" r="5"/><path stroke="var(--accent, #D9622B)" d="M9 13.5L8 21l4-2 4 2-1-7.5"/></>,
    submissions: <><path d="M4 14v6h16v-6"/><path stroke="var(--accent, #D9622B)" d="M12 15V4M8 8l4-4 4 4"/></>,
    compliance: <><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 018 0v3"/><circle stroke="var(--accent, #D9622B)" cx="12" cy="16" r="1.5"/></>,
    interventions: <><circle cx="12" cy="12" r="9"/><circle stroke="var(--accent, #D9622B)" cx="12" cy="12" r="3.5"/><path d="M5.6 5.6l3.9 3.9M14.5 14.5l3.9 3.9M18.4 5.6l-3.9 3.9M9.5 14.5l-3.9 3.9"/></>,
    guidance: <><path d="M12 20s-8-5-8-11a4.5 4.5 0 018-2.5A4.5 4.5 0 0120 9c0 6-8 11-8 11z"/><path stroke="var(--accent, #D9622B)" d="M12 9v4M10 11h4"/></>,
    conduct: <><path d="M5 21V4"/><path stroke="var(--accent, #D9622B)" d="M5 5h13l-3 4 3 4H5"/></>,
    rooms: <><rect x="5" y="3" width="14" height="18" rx="1"/><path d="M3 21h18"/><circle stroke="var(--accent, #D9622B)" cx="15" cy="12" r="1"/></>,
    announcements: <><path d="M4 10v4h4l8 4V6l-8 4z"/><path stroke="var(--accent, #D9622B)" d="M19 9a4 4 0 010 6"/></>,
    notifications: <><path d="M6 17v-6a6 6 0 0112 0v6l2 2H4z"/><path stroke="var(--accent, #D9A834)" d="M10 21h4"/></>,
    consent: <><path d="M6 3h9l3 3v15H6z"/><path stroke="var(--accent, #D9622B)" d="M9 16c1-3 2 1 3-1s2 0 3-1"/></>,
    analytics: <><path d="M4 4v16h16"/><path stroke="var(--accent, #D9622B)" d="M7 15l4-4 3 3 5-6"/></>,
    depedForms: <><rect x="7" y="3" width="12" height="15" rx="2"/><path stroke="var(--accent, #D9622B)" d="M5 7v13h11"/><path d="M10 8h6M10 12h6"/></>,
    ai: <><rect x="5" y="8" width="14" height="11" rx="3"/><path stroke="var(--accent, #D9A834)" d="M12 4v4M9 13h.01M15 13h.01M9.5 16.5h5"/></>,
    messages: <><path d="M4 5h16v11H10l-5 4v-4H4z"/><path stroke="var(--accent, #D9622B)" d="M8 10h8"/></>,
    mfa: <><rect x="7" y="2" width="10" height="20" rx="2"/><path stroke="var(--accent, #D9622B)" d="M10 18h4"/><path d="M12 7l2 1v2c0 1.5-1 2.5-2 3-1-.5-2-1.5-2-3V8z"/></>,
    audit: <><circle cx="10" cy="10" r="6"/><path stroke="var(--accent, #D9622B)" d="M15 15l5 5"/><path d="M8 10h4"/></>,
    privacy: <><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><rect stroke="var(--accent, #D9622B)" x="9.5" y="10.5" width="5" height="4" rx="1"/></>,
    settings: <><path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle stroke="var(--accent, #D9622B)" cx="16" cy="7" r="2"/><circle stroke="var(--accent, #D9622B)" cx="8" cy="17" r="2"/></>,
  };

  const content = icons[name] || icons.dashboard;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="var(--primary, #1F5D3A)"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ display: 'inline-flex', flexShrink: 0, verticalAlign: 'middle', ...style }}
      aria-hidden="true"
    >
      {content}
    </svg>
  );
}
