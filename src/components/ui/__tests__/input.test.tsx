import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Input } from '../input';

describe('Input Component', () => {
  it('renders input element', () => {
    render(<Input data-testid="input" />);
    expect(screen.getByTestId('input')).toBeInTheDocument();
  });

  it('renders with default type text', () => {
    render(<Input data-testid="input" />);
    const input = screen.getByTestId('input') as HTMLInputElement;
    expect(input.type).toBe('text');
  });

  it('renders with specified type', () => {
    render(<Input type="email" data-testid="input" />);
    const input = screen.getByTestId('input') as HTMLInputElement;
    expect(input.type).toBe('email');
  });

  it('accepts and displays value', () => {
    render(<Input value="test value" data-testid="input" readOnly />);
    const input = screen.getByTestId('input') as HTMLInputElement;
    expect(input.value).toBe('test value');
  });

  it('handles onChange events', () => {
    const handleChange = vi.fn();
    render(<Input onChange={handleChange} data-testid="input" />);
    const input = screen.getByTestId('input');

    fireEvent.change(input, { target: { value: 'new value' } });
    expect(handleChange).toHaveBeenCalledTimes(1);
  });

  it('applies custom className', () => {
    render(<Input className="custom-input" data-testid="input" />);
    const input = screen.getByTestId('input');
    expect(input).toHaveClass('custom-input');
  });

  it('can be disabled', () => {
    render(<Input disabled data-testid="input" />);
    const input = screen.getByTestId('input') as HTMLInputElement;
    expect(input.disabled).toBe(true);
  });

  it('forwards ref to input element', () => {
    const ref = { current: null };
    render(<Input ref={ref} />);
    expect(ref.current).toBeInstanceOf(HTMLInputElement);
  });

  it('supports placeholder', () => {
    render(<Input placeholder="Enter text..." data-testid="input" />);
    const input = screen.getByTestId('input') as HTMLInputElement;
    expect(input.placeholder).toBe('Enter text...');
  });

  it('supports password type', () => {
    render(<Input type="password" data-testid="input" />);
    const input = screen.getByTestId('input') as HTMLInputElement;
    expect(input.type).toBe('password');
  });

  it('supports number type', () => {
    render(<Input type="number" data-testid="input" />);
    const input = screen.getByTestId('input') as HTMLInputElement;
    expect(input.type).toBe('number');
  });

  it('supports maxLength attribute', () => {
    render(<Input maxLength={10} data-testid="input" />);
    const input = screen.getByTestId('input') as HTMLInputElement;
    expect(input.maxLength).toBe(10);
  });

  it('supports readonly attribute', () => {
    render(<Input readOnly data-testid="input" />);
    const input = screen.getByTestId('input') as HTMLInputElement;
    expect(input.readOnly).toBe(true);
  });

  it('supports required attribute', () => {
    render(<Input required data-testid="input" />);
    const input = screen.getByTestId('input') as HTMLInputElement;
    expect(input.required).toBe(true);
  });

  it('supports aria-label for accessibility', () => {
    render(<Input aria-label="Username input" data-testid="input" />);
    const input = screen.getByTestId('input');
    expect(input).toHaveAttribute('aria-label', 'Username input');
  });

  it('handles onFocus events', () => {
    const handleFocus = vi.fn();
    render(<Input onFocus={handleFocus} data-testid="input" />);
    const input = screen.getByTestId('input');

    fireEvent.focus(input);
    expect(handleFocus).toHaveBeenCalledTimes(1);
  });

  it('handles onBlur events', () => {
    const handleBlur = vi.fn();
    render(<Input onBlur={handleBlur} data-testid="input" />);
    const input = screen.getByTestId('input');

    fireEvent.blur(input);
    expect(handleBlur).toHaveBeenCalledTimes(1);
  });
});
