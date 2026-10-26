import React from 'react';

// Official TARIK Crest Emblem Logo with multi-stop gold gradient ring and subtle vector drop shadow
export default function TarikCrestLogo({ size = 80, className = '', style = {} }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        padding: 3.5,
        background: 'linear-gradient(135deg, #F3D06C 0%, #D9A834 50%, #B8861F 100%)',
        boxShadow: '0 10px 30px rgba(15, 90, 54, 0.35), 0 0 0 3px rgba(217, 168, 52, 0.3)',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        transition: 'transform 0.3s cubic-bezier(0.2, 0, 0, 1), box-shadow 0.3s ease',
        cursor: 'pointer',
        ...style,
      }}
      className={`tarik-crest-wrap ${className}`}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'scale(1.06)';
        e.currentTarget.style.boxShadow = '0 14px 38px rgba(15, 90, 54, 0.45), 0 0 0 4px rgba(243, 208, 108, 0.5)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'scale(1)';
        e.currentTarget.style.boxShadow = '0 10px 30px rgba(15, 90, 54, 0.35), 0 0 0 3px rgba(217, 168, 52, 0.3)';
      }}
    >
      <img
        src="/logo.jpg"
        alt="TARIK Crest Emblem"
        style={{
          width: '100%',
          height: '100%',
          borderRadius: '50%',
          objectFit: 'cover',
          background: '#0F5A36',
          display: 'block',
        }}
      />
    </div>
  );
}
