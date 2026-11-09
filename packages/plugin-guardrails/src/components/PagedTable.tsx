import type { ReactNode } from 'react';
import Button from '@material-ui/core/Button';
import Table from '@material-ui/core/Table';
import TableBody from '@material-ui/core/TableBody';
import TableCell from '@material-ui/core/TableCell';
import TableContainer from '@material-ui/core/TableContainer';
import TableHead from '@material-ui/core/TableHead';
import TableRow from '@material-ui/core/TableRow';
import Typography from '@material-ui/core/Typography';
import { t } from '../texts/texts';

export interface Column<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
}

export interface PagedTableProps<T> {
  caption: string;
  columns: Column<T>[];
  /** The rows of the current page (at most 10). */
  rows: T[];
  rowKey: (row: T) => string;
  page: number;
  pageCount: number;
  onPage: (page: number) => void;
  /** False for a list that is not paged (the open changes). Default true. */
  paging?: boolean;
  testId?: string;
}

/**
 * A table with a caption and header cells, 10 rows per page, and Previous,
 * Next and "Page N of M" (BR4.4, BR7.1). The paging buttons use aria-disabled
 * at the ends, not the disabled attribute, so keyboard focus stays on the
 * controls after the last or first page is reached.
 */
export function PagedTable<T>({
  caption,
  columns,
  rows,
  rowKey,
  page,
  pageCount,
  onPage,
  paging = true,
  testId,
}: PagedTableProps<T>) {
  const atStart = page <= 1;
  const atEnd = page >= pageCount;
  return (
    <div data-testid={testId}>
      <TableContainer>
        <Table size="small">
          <caption style={{ position: 'absolute', left: -10000 }}>
            {caption}
          </caption>
          <TableHead>
            <TableRow>
              {columns.map(c => (
                <TableCell key={c.key} component="th" scope="col">
                  {c.header}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map(row => (
              <TableRow key={rowKey(row)}>
                {columns.map(c => (
                  <TableCell key={c.key}>{c.render(row)}</TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      {paging && (
        <nav
          aria-label={caption}
          style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 8 }}
        >
          <Button
            size="small"
            variant="outlined"
            aria-disabled={atStart ? 'true' : undefined}
            style={atStart ? { opacity: 0.6 } : undefined}
            onClick={() => {
              if (!atStart) onPage(page - 1);
            }}
          >
            {t('label.previous')}
          </Button>
          <Typography variant="body2" aria-live="polite" component="span">
            {t('label.pageOf', { n: page, m: pageCount })}
          </Typography>
          <Button
            size="small"
            variant="outlined"
            aria-disabled={atEnd ? 'true' : undefined}
            style={atEnd ? { opacity: 0.6 } : undefined}
            onClick={() => {
              if (!atEnd) onPage(page + 1);
            }}
          >
            {t('label.next')}
          </Button>
        </nav>
      )}
    </div>
  );
}
