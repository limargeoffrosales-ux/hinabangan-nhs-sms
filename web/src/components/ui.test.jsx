import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Badge } from './ui';

describe('Badge', () => {
  it('renders the status uppercase when no children are given', () => {
    render(<Badge status="present" />);
    expect(screen.getByRole('status')).toHaveTextContent('PRESENT');
    expect(screen.getByRole('status')).toHaveClass('badge-green');
  });

  it('renders children verbatim when provided', () => {
    render(<Badge status="absent">Away</Badge>);
    expect(screen.getByRole('status')).toHaveTextContent('Away');
  });

  it('maps unknown statuses to the gray badge', () => {
    render(<Badge status="weird">??</Badge>);
    expect(screen.getByRole('status')).toHaveClass('badge-gray');
  });
});