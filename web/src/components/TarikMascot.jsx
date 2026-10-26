import React from 'react';

// Official TARIK Mascot Character Sheet Image Component using /tarik-poses.png
// Poses Grid (4 cols x 2 rows):
// Row 1: waving, reading, cheering, thinking
// Row 2: clipboard, surprised, sleepy, happy

const POSE_OFFSETS = {
  waving: '0% 0%',
  reading: '33.333% 0%',
  cheering: '66.666% 0%',
  thinking: '100% 0%',
  clipboard: '0% 100%',
  surprised: '33.333% 100%',
  sleepy: '66.666% 100%',
  happy: '100% 100%',
};

export default function TarikMascot({ pose = 'happy', size = 120, className = '', style = {} }) {
  const bgPos = POSE_OFFSETS[pose] || POSE_OFFSETS.happy;

  return (
    <div
      className={`tarik-mascot-hover ${className}`}
      style={{
        width: size,
        height: size,
        backgroundImage: 'url(/tarik-poses.png)',
        backgroundSize: '400% 200%',
        backgroundPosition: bgPos,
        backgroundRepeat: 'no-repeat',
        display: 'inline-block',
        flexShrink: 0,
        filter: 'contrast(160%) brightness(99%) saturate(120%)',
        mixBlendMode: 'darken',
        ...style,
      }}
      title={`TARIK - ${pose}`}
    />
  );
}
