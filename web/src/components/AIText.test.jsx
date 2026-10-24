import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import AIText from './AIText';

describe('AIText', () => {
  it('renders dash bullets as a real list', () => {
    render(<AIText text="- one\n- two\n- three" />);
    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(3);
    expect(items.map((li) => li.textContent)).toEqual(['one', 'two', 'three']);
  });

  it('accepts star and dot bullets too', () => {
    render(<AIText text="* alpha\n- beta\n• gamma" />);
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
  });

  it('renders prose as paragraphs with preserved line breaks', () => {
    const { container } = render(<AIText text={'First line\nSecond line\n\nNew paragraph'} />);
    const paras = container.querySelectorAll('p.ai-p');
    expect(paras).toHaveLength(2);
    expect(paras[0].textContent).toBe('First line\nSecond line');
    expect(paras[1].textContent).toBe('New paragraph');
  });

  it('renders nothing for null/undefined and raw text passthrough', () => {
    const { container } = render(<AIText text={null} />);
    expect(container.textContent).toBe('');
    const live = render(<AIText text="no markers" />);
    expect(live.getByText('no markers')).toBeTruthy();
  });
});