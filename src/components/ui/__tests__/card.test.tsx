// @ts-nocheck
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '../card';

describe('Card Component', () => {
  it('renders card with all subcomponents', () => {
    render(
      <Card data-testid="card">
        <CardHeader>
          <CardTitle>Test Title</CardTitle>
          <CardDescription>Test Description</CardDescription>
        </CardHeader>
        <CardContent>Test Content</CardContent>
        <CardFooter>Test Footer</CardFooter>
      </Card>
    );

    expect(screen.getByTestId('card')).toBeInTheDocument();
    expect(screen.getByText('Test Title')).toBeInTheDocument();
    expect(screen.getByText('Test Description')).toBeInTheDocument();
    expect(screen.getByText('Test Content')).toBeInTheDocument();
    expect(screen.getByText('Test Footer')).toBeInTheDocument();
  });

  it('applies custom className to Card', () => {
    render(<Card className="custom-class" data-testid="card" />);
    const card = screen.getByTestId('card');
    expect(card).toHaveClass('custom-class');
  });

  it('applies custom className to CardHeader', () => {
    render(
      <Card>
        <CardHeader className="custom-header" data-testid="card-header">
          Header
        </CardHeader>
      </Card>
    );
    const header = screen.getByTestId('card-header');
    expect(header).toHaveClass('custom-header');
  });

  it('renders CardTitle as h3 element', () => {
    render(
      <Card>
        <CardHeader>
          <CardTitle>Title Text</CardTitle>
        </CardHeader>
      </Card>
    );
    const title = screen.getByText('Title Text');
    expect(title.tagName).toBe('H3');
  });

  it('renders CardDescription as p element', () => {
    render(
      <Card>
        <CardHeader>
          <CardDescription>Description Text</CardDescription>
        </CardHeader>
      </Card>
    );
    const description = screen.getByText('Description Text');
    expect(description.tagName).toBe('P');
  });

  it('forwards ref to Card element', () => {
    const ref = { current: null };
    render(<Card ref={ref} />);
    expect(ref.current).toBeInstanceOf(HTMLDivElement);
  });

  it('supports arbitrary HTML attributes', () => {
    render(
      <Card data-testid="card" aria-label="test-card" role="region">
        Content
      </Card>
    );
    const card = screen.getByTestId('card');
    expect(card).toHaveAttribute('aria-label', 'test-card');
    expect(card).toHaveAttribute('role', 'region');
  });

  it('renders nested content correctly', () => {
    render(
      <Card>
        <CardContent>
          <div data-testid="nested-div">
            <span>Nested Content</span>
          </div>
        </CardContent>
      </Card>
    );
    expect(screen.getByTestId('nested-div')).toBeInTheDocument();
    expect(screen.getByText('Nested Content')).toBeInTheDocument();
  });
});
