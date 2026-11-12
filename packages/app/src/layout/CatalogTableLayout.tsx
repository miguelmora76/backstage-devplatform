import { makeStyles } from '@material-ui/core/styles';

// Backstage's catalog table has 20px and 16px of sideways padding in each of
// its eight columns, which makes it wider than the content area at 1024 and
// 1308 pixels (it then scrolls sideways inside itself). Its cells get 4px on
// both sides instead, and nothing is ever broken inside a word. The catalog
// list is the table the app names "Catalog entries" (see a11y/catalogA11y.ts);
// the tables of the Guardrails plugin are not touched.
const useStyles = makeStyles({
  '@global': {
    'table[aria-label="Catalog entries"] .MuiTableCell-root': {
      paddingLeft: 4,
      paddingRight: 4,
      wordBreak: 'normal',
      overflowWrap: 'normal',
    },
  },
});

/** An app root element that only adds the catalog table styles (FR3.1). */
export function CatalogTableLayout() {
  useStyles();
  return null;
}
