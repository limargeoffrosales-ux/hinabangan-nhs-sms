import React from 'react';

// Official TARIK Crest Emblem Logo using the user's exact uploaded image asset (/logo.jpg)
export default function TarikCrestLogo({ size = 80, className = '', style = {} }) {
  return (
    <img
      src="/logo.jpg"
      alt="TARIK Crest Emblem"
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        objectFit: 'cover',
        border: '3px solid #D4A359',
        boxShadow: '0 6px 20px rgba(18,38,28,0.22)',
        background: '#0F4530',
        flexShrink: 0,
        ...style,
      }}
      className={className}
    />
  );
}
