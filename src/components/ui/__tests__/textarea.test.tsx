// @ts-nocheck
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Textarea } from '../textarea';

describe('Textarea Component', () => {
  it('renders textarea element', () => {
    render(<Textarea data-testid="textarea" />);
    expect(screen.getByTestId('textarea')).toBeInTheDocument();
  });

  it('accepts and displays value', () => {
    render(<Textarea value="test content" data-testid="textarea" readOnly />);
    const textarea = screen.getByTestId('textarea') as HTMLTextAreaElement;
    expect(textarea.value).toBe('test content');
  });

  it('handles onChange events', () => {
    const handleChange = vi.fn();
    render(<Textarea onChange={handleChange} data-testid="textarea" />);
    const textarea = screen.getByTestId('textarea');

    fireEvent.change(textarea, { target: { value: 'new content' } });
    expect(handleChange).toHaveBeenCalledTimes(1);
  });

  it('applies custom className', () => {
    render(<Textarea className="custom-textarea" data-testid="textarea" />);
    const textarea = screen.getByTestId('textarea');
    expect(textarea).toHaveClass('custom-textarea');
  });

  it('can be disabled', () => {
    render(<Textarea disabled data-testid="textarea" />);
    const textarea = screen.getByTestId('textarea') as HTMLTextAreaElement;
    expect(textarea.disabled).toBe(true);
  });

  it('forwards ref to textarea element', () => {
    const ref = { current: null };
    render(<Textarea ref={ref} />);
    expect(ref.current).toBeInstanceOf(HTMLTextAreaElement);
  });

  it('supports placeholder', () => {
    render(<Textarea placeholder="Enter description..." data-testid="textarea" />);
    const textarea = screen.getByTestId('textarea') as HTMLTextAreaElement;
    expect(textarea.placeholder).toBe('Enter description...');
  });

  it('supports maxLength attribute', () => {
    render(<Textarea maxLength={100} data-testid="textarea" />);
    const textarea = screen.getByTestId('textarea') as HTMLTextAreaElement;
    expect(textarea.maxLength).toBe(100);
  });

  it('supports readonly attribute', () => {
    render(<Textarea readOnly data-testid="textarea" />);
    const textarea = screen.getByTestId('textarea') as HTMLTextAreaElement;
    expect(textarea.readOnly).toBe(true);
  });

  it('supports required attribute', () => {
    render(<Textarea required data-testid="textarea" />);
    const textarea = screen.getByTestId('textarea') as HTMLTextAreaElement;
    expect(textarea.required).toBe(true);
  });

  it('supports rows attribute', () => {
    render(<Textarea rows={5} data-testid="textarea" />);
    const textarea = screen.getByTestId('textarea');
    expect(textarea).toHaveAttribute('rows', '5');
  });

  it('handles onFocus events', () => {
    const handleFocus = vi.fn();
    render(<Textarea onFocus={handleFocus} data-testid="textarea" />);
    const textarea = screen.getByTestId('textarea');

    fireEvent.focus(textarea);
    expect(handleFocus).toHaveBeenCalledTimes(1);
  });

  it('handles onBlur events', () => {
    const handleBlur = vi.fn();
    render(<Textarea onBlur={handleBlur} data-testid="textarea" />);
    const textarea = screen.getByTestId('textarea');

    fireEvent.blur(textarea);
    expect(handleBlur).toHaveBeenCalledTimes(1);
  });

  it('supports aria-label for accessibility', () => {
    render(<Textarea aria-label="Description input" data-testid="textarea" />);
    const textarea = screen.getByTestId('textarea');
    expect(textarea).toHaveAttribute('aria-label', 'Description input');
  });
});
