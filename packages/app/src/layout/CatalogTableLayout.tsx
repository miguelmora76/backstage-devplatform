import { makeStyles } from '@material-ui/core/styles';

// Backstage's catalog table has 20px and 16px of sideways padding in each of
// its eight columns, which makes it wider than the content area at 1024 and
// 1308 pixels (it then scrolls sideways inside itself). Its cells get 4px on
// both sides instead, and nothing is ever broken inside a word. Its font is
// also a little smaller (13px): padding alone fitted on macOS, but on Linux
// (wider default fonts, seen in the pipeline: 776px of table in 760px) it
// still scrolled sideways at 1024px. The catalog
// list is the table the app names "Catalog entries" (see a11y/catalogA11y.ts);
// the tables of the Guardrails plugin are not touched.
const useStyles = makeStyles({
  '@global': {
    'table[aria-label="Catalog entries"] .MuiTableCell-root': {
      paddingLeft: 4,
      paddingRight: 4,
      fontSize: '0.8125rem',
      wordBreak: 'normal',
      overflowWrap: 'normal',
    },
    // The filter list beside the catalog ("Owned", "Starred", "All") keeps
    // 48px free on the right for a count, which left "Starred" one pixel too
    // narrow, so its last letter was cut off. 32px is enough for a count.
    '.MuiCard-root .MuiListItem-container > .MuiMenuItem-root': {
      paddingRight: 32,
    },
  },
});

/** An app root element that only adds the catalog table styles (FR3.1). */
export function CatalogTableLayout() {
  useStyles();
  return null;
}
