import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Alert, AlertTitle, AlertDescription } from '../alert';

describe('Alert Components', () => {
  it('renders alert with title and description', () => {
    render(
      <Alert data-testid="alert">
        <AlertTitle>Test Title</AlertTitle>
        <AlertDescription>Test Description</AlertDescription>
      </Alert>
    );

    expect(screen.getByTestId('alert')).toBeInTheDocument();
    expect(screen.getByText('Test Title')).toBeInTheDocument();
    expect(screen.getByText('Test Description')).toBeInTheDocument();
  });

  it('applies custom className to Alert', () => {
    render(<Alert className="custom-alert" data-testid="alert" />);
    const alert = screen.getByTestId('alert');
    expect(alert).toHaveClass('custom-alert');
  });

  it('renders AlertTitle as h5 element', () => {
    render(
      <Alert>
        <AlertTitle>Alert Title</AlertTitle>
      </Alert>
    );
    const title = screen.getByText('Alert Title');
    expect(title.tagName).toBe('H5');
  });

  it('renders AlertDescription as div element', () => {
    render(
      <Alert>
        <AlertDescription data-testid="description">Alert Description</AlertDescription>
      </Alert>
    );
    const description = screen.getByTestId('description');
    expect(description.tagName).toBe('DIV');
  });

  it('supports different variants through className', () => {
    render(
      <Alert className="destructive" data-testid="alert">
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>Something went wrong</AlertDescription>
      </Alert>
    );
    const alert = screen.getByTestId('alert');
    expect(alert).toHaveClass('destructive');
  });

  it('forwards ref to Alert element', () => {
    const ref = { current: null };
    render(<Alert ref={ref} />);
    expect(ref.current).toBeInstanceOf(HTMLDivElement);
  });

  it('renders nested content correctly', () => {
    render(
      <Alert>
        <AlertDescription>
          <p data-testid="nested">Nested content</p>
        </AlertDescription>
      </Alert>
    );
    expect(screen.getByTestId('nested')).toBeInTheDocument();
  });

  it('supports aria-label for accessibility', () => {
    render(<Alert aria-label="warning-alert" data-testid="alert" />);
    const alert = screen.getByTestId('alert');
    expect(alert).toHaveAttribute('aria-label', 'warning-alert');
  });
});
