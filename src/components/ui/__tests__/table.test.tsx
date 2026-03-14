import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '../table';

describe('Table Components', () => {
  it('renders complete table structure', () => {
    render(
      <Table data-testid="table">
        <TableHeader>
          <TableRow>
            <TableHead>Column 1</TableHead>
            <TableHead>Column 2</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell>Data 1</TableCell>
            <TableCell>Data 2</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    );

    expect(screen.getByText('Column 1')).toBeInTheDocument();
    expect(screen.getByText('Column 2')).toBeInTheDocument();
    expect(screen.getByText('Data 1')).toBeInTheDocument();
    expect(screen.getByText('Data 2')).toBeInTheDocument();
  });

  it('renders Table as table element', () => {
    const { container } = render(<Table data-testid="table" />);
    const tableElement = container.querySelector('table');
    expect(tableElement).toBeInTheDocument();
    expect(tableElement?.tagName).toBe('TABLE');
  });

  it('renders TableHeader as thead element', () => {
    render(
      <Table>
        <TableHeader data-testid="table-header" />
      </Table>
    );
    const header = screen.getByTestId('table-header');
    expect(header.tagName).toBe('THEAD');
  });

  it('renders TableBody as tbody element', () => {
    render(
      <Table>
        <TableBody data-testid="table-body" />
      </Table>
    );
    const body = screen.getByTestId('table-body');
    expect(body.tagName).toBe('TBODY');
  });

  it('renders TableRow as tr element', () => {
    render(
      <Table>
        <TableBody>
          <TableRow data-testid="table-row" />
        </TableBody>
      </Table>
    );
    const row = screen.getByTestId('table-row');
    expect(row.tagName).toBe('TR');
  });

  it('renders TableHead as th element', () => {
    render(
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead data-testid="table-head">Header</TableHead>
          </TableRow>
        </TableHeader>
      </Table>
    );
    const head = screen.getByTestId('table-head');
    expect(head.tagName).toBe('TH');
  });

  it('renders TableCell as td element', () => {
    render(
      <Table>
        <TableBody>
          <TableRow>
            <TableCell data-testid="table-cell">Data</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    );
    const cell = screen.getByTestId('table-cell');
    expect(cell.tagName).toBe('TD');
  });

  it('applies custom className to Table', () => {
    render(<Table className="custom-table" data-testid="table" />);
    const wrapper = screen.getByTestId('table');
    expect(wrapper).toHaveClass('custom-table');
  });

  it('applies custom className to TableRow', () => {
    render(
      <Table>
        <TableBody>
          <TableRow className="custom-row" data-testid="table-row" />
        </TableBody>
      </Table>
    );
    const row = screen.getByTestId('table-row');
    expect(row).toHaveClass('custom-row');
  });

  it('forwards ref to Table element', () => {
    const ref = { current: null };
    render(<Table ref={ref} />);
    expect(ref.current).toBeInstanceOf(HTMLTableElement);
  });

  it('forwards ref to TableRow element', () => {
    const ref = { current: null };
    render(
      <Table>
        <TableBody>
          <TableRow ref={ref} />
        </TableBody>
      </Table>
    );
    expect(ref.current).toBeInstanceOf(HTMLTableRowElement);
  });

  it('renders multiple rows correctly', () => {
    render(
      <Table>
        <TableBody>
          <TableRow>
            <TableCell>Row 1</TableCell>
          </TableRow>
          <TableRow>
            <TableCell>Row 2</TableCell>
          </TableRow>
          <TableRow>
            <TableCell>Row 3</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    );

    expect(screen.getByText('Row 1')).toBeInTheDocument();
    expect(screen.getByText('Row 2')).toBeInTheDocument();
    expect(screen.getByText('Row 3')).toBeInTheDocument();
  });

  it('supports data-state attribute on TableRow', () => {
    render(
      <Table>
        <TableBody>
          <TableRow data-state="selected" data-testid="table-row">
            <TableCell>Selected Row</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    );
    const row = screen.getByTestId('table-row');
    expect(row).toHaveAttribute('data-state', 'selected');
  });

  it('renders nested content in cells', () => {
    render(
      <Table>
        <TableBody>
          <TableRow>
            <TableCell>
              <div data-testid="nested-content">
                <span>Nested</span>
              </div>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    );
    expect(screen.getByTestId('nested-content')).toBeInTheDocument();
    expect(screen.getByText('Nested')).toBeInTheDocument();
  });
});
