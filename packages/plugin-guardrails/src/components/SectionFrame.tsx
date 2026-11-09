import { useId, type ReactNode } from 'react';
import Paper from '@material-ui/core/Paper';
import Typography from '@material-ui/core/Typography';

/** A named section of Screen B: an h2 and a region labelled by it (BR7.1). */
export function SectionFrame({
  title,
  children,
  testId,
}: {
  title: string;
  children: ReactNode;
  testId?: string;
}) {
  const id = useId();
  return (
    <Paper
      component="section"
      aria-labelledby={id}
      data-testid={testId}
      style={{ padding: 16, minWidth: 0 }}
    >
      <Typography variant="h5" component="h2" id={id} gutterBottom>
        {title}
      </Typography>
      {children}
    </Paper>
  );
}
