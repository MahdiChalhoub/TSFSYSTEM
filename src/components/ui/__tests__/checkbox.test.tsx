// @ts-nocheck
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Checkbox } from '../checkbox';

describe('Checkbox Component', () => {
  it('renders checkbox element', () => {
    render(<Checkbox data-testid="checkbox" />);
    expect(screen.getByTestId('checkbox')).toBeInTheDocument();
  });

  it('can be checked', () => {
    render(<Checkbox data-testid="checkbox" checked={true} />);
    const checkbox = screen.getByTestId('checkbox');
    expect(checkbox).toHaveAttribute('data-state', 'checked');
  });

  it('can be unchecked', () => {
    render(<Checkbox data-testid="checkbox" checked={false} />);
    const checkbox = screen.getByTestId('checkbox');
    expect(checkbox).toHaveAttribute('data-state', 'unchecked');
  });

  it('handles click events', () => {
    const handleClick = vi.fn();
    render(<Checkbox data-testid="checkbox" onClick={handleClick} />);
    const checkbox = screen.getByTestId('checkbox');

    fireEvent.click(checkbox);
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('can be disabled', () => {
    render(<Checkbox disabled data-testid="checkbox" />);
    const checkbox = screen.getByTestId('checkbox');
    expect(checkbox).toHaveAttribute('disabled');
  });

  it('forwards ref to checkbox element', () => {
    const ref = { current: null };
    render(<Checkbox ref={ref} />);
    expect(ref.current).toBeTruthy();
  });

  it('applies custom className', () => {
    render(<Checkbox className="custom-checkbox" data-testid="checkbox" />);
    const checkbox = screen.getByTestId('checkbox');
    expect(checkbox).toHaveClass('custom-checkbox');
  });

  it('supports aria-label for accessibility', () => {
    render(<Checkbox aria-label="accept-terms" data-testid="checkbox" />);
    const checkbox = screen.getByTestId('checkbox');
    expect(checkbox).toHaveAttribute('aria-label', 'accept-terms');
  });

  it('handles onCheckedChange events', () => {
    const handleChange = vi.fn();
    render(<Checkbox onCheckedChange={handleChange} data-testid="checkbox" />);
    const checkbox = screen.getByTestId('checkbox');

    fireEvent.click(checkbox);
    expect(handleChange).toHaveBeenCalled();
  });
});
