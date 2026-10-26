import React from 'react';

// Official TARIK Crest Emblem Logo matching user reference image
export default function TarikCrestLogo({ size = 80, className = '', style = {} }) {
  return (
    <svg width={size} height={size} viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} style={style}>
      {/* Outer Gold & Green Crest Border */}
      <circle cx="100" cy="100" r="94" fill="#0F4530" stroke="#D4A359" strokeWidth="5" />
      <circle cx="100" cy="100" r="86" fill="#153625" stroke="#D4A359" strokeWidth="2.5" />
      <circle cx="100" cy="100" r="78" fill="#1B6B4A" />

      {/* Laurel Leaves Wreath Bottom */}
      <path d="M 50 140 Q 100 175, 150 140 Q 100 155, 50 140 Z" fill="#2E9E5B" opacity="0.8" />

      {/* Tarik Mascot (Trophy Cheering Pose) */}
      <g transform="translate(18, 12) scale(1.4)">
        {/* Grey Plumage Body */}
        <circle cx="52" cy="58" r="26" fill="#4A5568" stroke="#12261C" strokeWidth="2.5" />
        <path d="M 38 68 Q 30 85, 42 90 Z" fill="#E2E8F0" stroke="#12261C" strokeWidth="2" />
        <path d="M 52 70 Q 52 92, 48 94 Z" fill="#CBD5E1" stroke="#12261C" strokeWidth="2" />

        {/* Salakot Hat */}
        <path d="M 32 24 Q 50 12, 68 24 L 72 28 Q 50 20, 28 28 Z" fill="#C69248" stroke="#8C6227" strokeWidth="2" />
        <polygon points="50,9 43,19 57,19" fill="#8C6227" />

        {/* Head & Face (Cream) */}
        <path d="M 36 28 C 36 18, 64 18, 64 28 C 64 42, 58 54, 50 56 C 42 54, 36 42, 36 28 Z" fill="#FFFDF7" stroke="#12261C" strokeWidth="2" />
        <path d="M 40 32 Q 32 40, 28 54 Q 32 56, 38 48 Z" fill="#12261C" />

        {/* Reddish Orange Curved Bill */}
        <path d="M 50 36 Q 84 34, 78 48 Q 60 52, 50 42 Z" fill="#E06D39" stroke="#12261C" strokeWidth="2" />

        {/* Eye */}
        <circle cx="42" cy="36" r="5" fill="#FFFFFF" stroke="#12261C" strokeWidth="1.5" />
        <circle cx="43" cy="36" r="3" fill="#12261C" />
        <circle cx="44" cy="35" r="1" fill="#FFFFFF" />

        {/* Green Lanyard & ID Badge */}
        <path d="M 42 54 L 50 64 L 58 54" stroke="#1B6B4A" strokeWidth="2.5" fill="none" />
        <rect x="45" y="62" width="10" height="12" rx="1.5" fill="#FFFFFF" stroke="#12261C" strokeWidth="1" />
        <circle cx="50" cy="66" r="3" fill="#E06D39" />

        {/* Golden Trophy in Wing */}
        <path d="M 62 42 L 78 42 L 75 60 Q 70 66, 65 60 Z" fill="#F5A623" stroke="#DB8F10" strokeWidth="1.5" />
        <rect x="66" y="60" width="8" height="6" fill="#DB8F10" />
        <rect x="63" y="66" width="14" height="3" rx="1" fill="#12261C" />
        <path d="M 62 46 Q 56 46, 56 52 Q 56 58, 62 58" fill="none" stroke="#F5A623" strokeWidth="2" />
        <path d="M 78 46 Q 84 46, 84 52 Q 84 58, 78 58" fill="none" stroke="#F5A623" strokeWidth="2" />
      </g>

      {/* Gold Star Accents */}
      <circle cx="100" cy="16" r="3" fill="#F5A623" />
      <circle cx="22" cy="100" r="2.5" fill="#F5A623" />
      <circle cx="178" cy="100" r="2.5" fill="#F5A623" />
    </svg>
  );
}
