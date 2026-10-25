import React from 'react';

// "Tarik" — Samar Tarictic Hornbill (Penelopides samarensis)
// Kawaii Anime Mascot Character Sheet Component for UGOP (DepEd Philippine Public Schools)
// Anatomy: Cream-white head/chest, black eye stripe, reddish bill (#C0503C) with ridged casque & amber ridges,
// dark blue-black wings (#1F2A3A), rufous tail (#C97B3E), Salakot hat, and green DepEd school ID lanyard.

export default function TarikMascot({ pose = 'happy', size = 120, className = '', style = {} }) {
  // Shared Anatomy Elements
  const BaseHeadAndHat = () => (
    <>
      {/* Salakot Hat (Traditional Woven Bamboo Hat) */}
      <path d="M30 22 Q 50 10, 70 22 L 76 26 Q 50 18, 24 26 Z" fill="#D4A359" stroke="#8C6227" strokeWidth="2" />
      <polygon points="50,8 44,18 56,18" fill="#8C6227" />

      {/* Head & Chest (Cream-White #FFFDF7) */}
      <path d="M32 30 C 32 18, 68 18, 68 30 C 68 50, 62 70, 50 72 C 38 70, 32 50, 32 30 Z" fill="#FFFDF7" stroke="#12261C" strokeWidth="2.5" />

      {/* Bold Black Eye Stripe down neck */}
      <path d="M38 34 Q 30 42, 28 58 Q 33 60, 36 50 Q 36 40, 42 36 Z" fill="#12261C" />

      {/* Reddish Curved Bill (#C0503C) + Amber Ridges (#F5A623) */}
      <path d="M52 38 Q 88 36, 82 52 Q 62 55, 52 46 Z" fill="#C0503C" stroke="#12261C" strokeWidth="2.5" />
      {/* Ridged Casque (Hornbill Helmet) */}
      <path d="M50 32 Q 74 28, 70 38 Q 54 40, 50 32 Z" fill="#A03828" stroke="#12261C" strokeWidth="1.5" />
      <path d="M54 36 Q 66 34, 64 39" stroke="#F5A623" strokeWidth="2" strokeLinecap="round" />

      {/* DepEd Green School ID Lanyard & Badge */}
      <path d="M42 66 L 50 78 L 58 66" stroke="#1B6B4A" strokeWidth="3" fill="none" />
      <rect x="44" y="76" width="12" height="15" rx="2" fill="#FFFFFF" stroke="#12261C" strokeWidth="1.5" />
      <rect x="46" y="78" width="8" height="3" fill="#1B6B4A" />
    </>
  );

  const DarkWingsAndTail = () => (
    <>
      {/* Rufous Orange-Brown Tail Base (#C97B3E) with Black Tip */}
      <path d="M46 70 L 42 92 L 58 92 L 54 70 Z" fill="#C97B3E" stroke="#12261C" strokeWidth="2" />
      <rect x="42" y="88" width="16" height="4" fill="#12261C" />
      {/* Feet */}
      <path d="M42 92 L 40 96 M 44 92 L 44 97 M 56 92 L 56 97 M 58 92 L 60 96" stroke="#F5A623" strokeWidth="2.5" strokeLinecap="round" />
    </>
  );

  const AnimeEyes = ({ expression = 'normal' }) => (
    <>
      {expression === 'happy' ? (
        <path d="M38 38 Q 44 32, 48 38" stroke="#12261C" strokeWidth="3" strokeLinecap="round" fill="none" />
      ) : expression === 'sleepy' ? (
        <path d="M38 40 Q 43 43, 48 40" stroke="#12261C" strokeWidth="2.5" strokeLinecap="round" fill="none" />
      ) : expression === 'surprised' ? (
        <>
          <circle cx="43" cy="38" r="7" fill="#FFFFFF" stroke="#12261C" strokeWidth="2" />
          <circle cx="43" cy="38" r="4" fill="#8B1E22" />
          <circle cx="45" cy="36" r="1.5" fill="#FFFFFF" />
        </>
      ) : (
        <>
          {/* Glossy Dark Red Anime Eye */}
          <circle cx="43" cy="38" r="6" fill="#FFFFFF" stroke="#12261C" strokeWidth="2" />
          <circle cx="44" cy="38" r="3.5" fill="#8B1E22" />
          <circle cx="45" cy="36" r="1.5" fill="#FFFFFF" />
        </>
      )}
      {/* Cute Pink Blush */}
      <ellipse cx="38" cy="45" rx="3.5" ry="2" fill="#FF8A9E" opacity="0.65" />
    </>
  );

  const renderPose = () => {
    switch (pose) {
      case 'waving':
        return (
          <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} style={style}>
            <DarkWingsAndTail />
            {/* Left Waving Wing */}
            <path d="M34 50 C 18 35, 12 20, 24 15 C 30 25, 34 40, 34 50 Z" fill="#1F2A3A" stroke="#12261C" strokeWidth="2" />
            {/* Right Rest Wing */}
            <path d="M66 50 C 78 54, 80 68, 68 66 Z" fill="#1F2A3A" stroke="#12261C" strokeWidth="2" />
            <BaseHeadAndHat />
            <AnimeEyes expression="normal" />
            {/* Sparkle Wave */}
            <path d="M14 12 L 16 16 L 20 18 L 16 20 L 14 24 L 12 20 L 8 18 L 12 16 Z" fill="#F5A623" />
          </svg>
        );

      case 'reading':
        return (
          <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} style={style}>
            <DarkWingsAndTail />
            <path d="M34 50 C 24 55, 24 68, 36 66 Z" fill="#1F2A3A" stroke="#12261C" strokeWidth="2" />
            <path d="M66 50 C 76 55, 76 68, 64 66 Z" fill="#1F2A3A" stroke="#12261C" strokeWidth="2" />
            <BaseHeadAndHat />
            <AnimeEyes expression="normal" />
            {/* Open Book in Wings */}
            <path d="M30 65 L 50 68 L 70 65 L 68 84 L 50 86 L 32 84 Z" fill="#FFFFFF" stroke="#12261C" strokeWidth="2" />
            <path d="M50 68 L 50 86" stroke="#12261C" strokeWidth="1.5" />
            <path d="M36 72 H 46 M 36 76 H 44 M 54 72 H 64 M 54 76 H 62" stroke="#1E88B5" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        );

      case 'cheering':
        return (
          <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} style={style}>
            <DarkWingsAndTail />
            {/* Both Wings Raised */}
            <path d="M34 50 C 18 35, 12 15, 26 22 Z" fill="#1F2A3A" stroke="#12261C" strokeWidth="2" />
            <path d="M66 50 C 82 35, 88 15, 74 22 Z" fill="#1F2A3A" stroke="#12261C" strokeWidth="2" />
            <BaseHeadAndHat />
            <AnimeEyes expression="happy" />
            {/* Golden Trophy Overhead */}
            <path d="M42 6 L 58 6 L 56 18 Q 50 24, 44 18 Z" fill="#F5A623" stroke="#DB8F10" strokeWidth="1.5" />
            <rect x="47" y="20" width="6" height="6" fill="#DB8F10" />
            <rect x="43" y="26" width="14" height="4" rx="1" fill="#12261C" />
            {/* Victory Sparkles */}
            <circle cx="28" cy="12" r="2" fill="#F5A623" />
            <circle cx="72" cy="12" r="2" fill="#F5A623" />
          </svg>
        );

      case 'thinking':
        return (
          <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} style={style}>
            <DarkWingsAndTail />
            {/* Wing at Beak / Pensive */}
            <path d="M34 52 Q 48 48, 52 44" stroke="#1F2A3A" strokeWidth="5" strokeLinecap="round" fill="none" />
            <path d="M66 50 C 78 54, 80 68, 68 66 Z" fill="#1F2A3A" stroke="#12261C" strokeWidth="2" />
            <BaseHeadAndHat />
            <AnimeEyes expression="normal" />
            {/* Glowing Lightbulb */}
            <circle cx="78" cy="22" r="8" fill="#F5A623" stroke="#DB8F10" strokeWidth="1.5" />
            <path d="M75 30 H 81" stroke="#12261C" strokeWidth="2" />
            <path d="M72 12 L 70 8 M 84 12 L 86 8 M 88 22 L 92 22 M 68 22 L 64 22" stroke="#F5A623" strokeWidth="2" strokeLinecap="round" />
          </svg>
        );

      case 'clipboard':
        return (
          <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} style={style}>
            <DarkWingsAndTail />
            <BaseHeadAndHat />
            <AnimeEyes expression="normal" />
            {/* Clipboard */}
            <rect x="24" y="58" width="22" height="28" rx="2" fill="#C97B3E" stroke="#12261C" strokeWidth="2" />
            <rect x="28" y="62" width="14" height="20" fill="#FFFFFF" />
            <rect x="31" y="56" width="8" height="4" fill="#12261C" />
            <path d="M31 66 L 34 69 L 40 63 M 31 74 L 34 77 L 40 71" stroke="#2E9E5B" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          </svg>
        );

      case 'surprised':
        return (
          <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} style={style}>
            <DarkWingsAndTail />
            <path d="M34 50 C 20 52, 20 68, 34 64 Z" fill="#1F2A3A" stroke="#12261C" strokeWidth="2" />
            <path d="M66 50 C 80 52, 80 68, 66 64 Z" fill="#1F2A3A" stroke="#12261C" strokeWidth="2" />
            <BaseHeadAndHat />
            <AnimeEyes expression="surprised" />
            {/* Shock Marks */}
            <path d="M22 28 L 16 22 M 26 22 L 22 14 M 78 28 L 84 22 M 74 22 L 78 14" stroke="#F5A623" strokeWidth="2.5" strokeLinecap="round" />
          </svg>
        );

      case 'sleepy':
        return (
          <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} style={style}>
            <DarkWingsAndTail />
            <path d="M34 50 C 24 55, 24 68, 36 66 Z" fill="#1F2A3A" stroke="#12261C" strokeWidth="2" />
            <path d="M66 50 C 76 55, 76 68, 64 66 Z" fill="#1F2A3A" stroke="#12261C" strokeWidth="2" />
            <BaseHeadAndHat />
            <AnimeEyes expression="sleepy" />
            {/* ZZZ Bubbles */}
            <text x="70" y="24" fill="#1E88B5" fontFamily="var(--font-display)" fontWeight="800" fontSize="14">Z</text>
            <text x="78" y="16" fill="#1E88B5" fontFamily="var(--font-display)" fontWeight="800" fontSize="11">z</text>
            <text x="84" y="10" fill="#1E88B5" fontFamily="var(--font-display)" fontWeight="800" fontSize="8">z</text>
          </svg>
        );

      case 'happy':
      default:
        return (
          <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} style={style}>
            <DarkWingsAndTail />
            <path d="M34 50 C 24 55, 24 68, 36 66 Z" fill="#1F2A3A" stroke="#12261C" strokeWidth="2" />
            <path d="M66 50 C 76 55, 76 68, 64 66 Z" fill="#1F2A3A" stroke="#12261C" strokeWidth="2" />
            <BaseHeadAndHat />
            <AnimeEyes expression="happy" />
            {/* Floating Sparkles */}
            <path d="M22 28 L 24 32 L 28 34 L 24 36 L 22 40 L 20 36 L 16 34 L 20 32 Z" fill="#F5A623" />
            <path d="M78 24 L 79 27 L 82 28 L 79 29 L 78 32 L 77 29 L 74 28 L 77 27 Z" fill="#2E9E5B" />
          </svg>
        );
    }
  };

  return renderPose();
}
