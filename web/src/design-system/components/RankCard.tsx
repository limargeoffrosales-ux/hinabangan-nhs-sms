import { HTMLAttributes, ReactNode } from 'react';
import { cn } from '../../lib/cn';

export interface RankCardProps extends HTMLAttributes<HTMLDivElement> {
  rank: number;
  name: ReactNode;
  meta?: ReactNode;
  score?: ReactNode;
  avatar?: ReactNode;
  /** rank = ordinal medal colors (1 gold, 2 silver, 3 bronze). threshold = pass/fail tone. */
  colorBy?: 'rank' | 'threshold';
  passed?: boolean;
  compact?: boolean;
}

/**
 * Leaderboard row: circular avatar, name, score, ordinal badge. Color-coded by
 * rank (gold/silver/bronze) or by threshold (passed 75+ -> success).
 */
export function RankCard({
  rank,
  name,
  meta,
  score,
  avatar,
  colorBy = 'rank',
  passed,
  compact = false,
  className,
  ...props
}: RankCardProps) {
  const byRank = colorBy === 'rank';
  const medal = rank === 1 || rank === 2 || rank === 3;
  const toneClass = byRank
    ? (medal ? `is-medal-${rank}` : 'is-plain')
    : (passed ? 'is-passed' : 'is-at-risk');

  return (
    <div
      className={cn('ds-rank', toneClass, compact && 'is-compact', className)}
      {...props}
    >
      <span className="ds-rank__ordinal" aria-hidden="true">
        {medal ? `#${rank}` : rank}
      </span>
      <span className="ds-rank__avatar" aria-hidden="true">{avatar}</span>
      <span className="ds-rank__body">
        <span className="ds-rank__name">{name}</span>
        {meta && <span className="ds-rank__meta">{meta}</span>}
      </span>
      {score !== undefined && (
        <span className="ds-rank__score">{score}</span>
      )}
    </div>
  );
}

export default RankCard;