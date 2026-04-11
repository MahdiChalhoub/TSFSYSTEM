import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Badge } from '../badge';

describe('Badge Component', () => {
  it('renders with default variant', () => {
    render(<Badge data-testid="badge">Default Badge</Badge>);
    const badge = screen.getByTestId('badge');
    expect(badge).toBeInTheDocument();
    expect(screen.getByText('Default Badge')).toBeInTheDocument();
  });

  it('renders with secondary variant', () => {
    render(
      <Badge variant="secondary" data-testid="badge">
        Secondary Badge
      </Badge>
    );
    const badge = screen.getByTestId('badge');
    expect(badge).toBeInTheDocument();
    expect(screen.getByText('Secondary Badge')).toBeInTheDocument();
  });

  it('renders with destructive variant', () => {
    render(
      <Badge variant="destructive" data-testid="badge">
        Destructive Badge
      </Badge>
    );
    const badge = screen.getByTestId('badge');
    expect(badge).toBeInTheDocument();
    expect(screen.getByText('Destructive Badge')).toBeInTheDocument();
  });

  it('renders with outline variant', () => {
    render(
      <Badge variant="outline" data-testid="badge">
        Outline Badge
      </Badge>
    );
    const badge = screen.getByTestId('badge');
    expect(badge).toBeInTheDocument();
    expect(screen.getByText('Outline Badge')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    render(
      <Badge className="custom-badge" data-testid="badge">
        Custom Badge
      </Badge>
    );
    const badge = screen.getByTestId('badge');
    expect(badge).toHaveClass('custom-badge');
  });

  it('supports arbitrary HTML attributes', () => {
    render(
      <Badge data-testid="badge" aria-label="status-badge" role="status">
        Status
      </Badge>
    );
    const badge = screen.getByTestId('badge');
    expect(badge).toHaveAttribute('aria-label', 'status-badge');
    expect(badge).toHaveAttribute('role', 'status');
  });

  it('renders children correctly', () => {
    render(
      <Badge data-testid="badge">
        <span>Child 1</span>
        <span>Child 2</span>
      </Badge>
    );
    expect(screen.getByText('Child 1')).toBeInTheDocument();
    expect(screen.getByText('Child 2')).toBeInTheDocument();
  });

  it('renders as div element', () => {
    render(<Badge data-testid="badge">Badge</Badge>);
    const badge = screen.getByTestId('badge');
    expect(badge.tagName).toBe('DIV');
  });

  it('handles onClick events', () => {
    const handleClick = vi.fn();
    render(
      <Badge onClick={handleClick} data-testid="badge">
        Clickable Badge
      </Badge>
    );
    const badge = screen.getByTestId('badge');
    badge.click();
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('can display numeric content', () => {
    render(<Badge data-testid="badge">{99}</Badge>);
    expect(screen.getByText('99')).toBeInTheDocument();
  });

  it('can display mixed content', () => {
    render(
      <Badge data-testid="badge">
        New <strong>5</strong>
      </Badge>
    );
    expect(screen.getByText('New')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
  });
});
