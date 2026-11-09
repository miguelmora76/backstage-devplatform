import Button from '@material-ui/core/Button';
import { Link as RouterLink } from 'react-router-dom';
import { useGuardrails, useSessionVersion } from '../context';
import { useSection } from '../hooks/useSection';
import { changeTitle, sortOpenChanges } from '../rules/derive';
import { t } from '../texts/texts';
import { PagedTable } from './PagedTable';
import { SectionFrame } from './SectionFrame';
import { SectionState } from './SectionState';
import { StatusLabel } from './StatusLabel';

/** Pending and failed changes, failed first, each newest first (BR3.1, D6). */
export function OpenChangesSection({
  service,
  version,
}: {
  service: string;
  version: number;
}) {
  const { api } = useGuardrails();
  const sessionVersion = useSessionVersion();
  const section = useSection(
    signal => api.changes(service, { signal }),
    [api, service, version, sessionVersion],
  );

  return (
    <SectionFrame title={t('section.open')} testId="section-open">
      <SectionState
        state={section.state}
        failure={section.failure}
        name={t('section.open')}
        emptyKey="empty.open"
        onRetry={section.reload}
      >
        {items => (
          <PagedTable
            caption={t('section.open')}
            paging={false}
            columns={[
              {
                key: 'change',
                header: t('column.change'),
                render: c => changeTitle(c),
              },
              {
                key: 'by',
                header: t('column.proposedBy'),
                render: c => c.proposedBy.name,
              },
              {
                key: 'status',
                header: t('column.status'),
                render: c => <StatusLabel status={c.status} />,
              },
              {
                key: 'action',
                header: t('column.action'),
                render: c => (
                  <Button
                    component={RouterLink}
                    to={`changes/${encodeURIComponent(c.changeId)}`}
                    size="small"
                    variant="outlined"
                    color="primary"
                    role="link"
                    aria-label={t('label.viewFor', { title: changeTitle(c) })}
                    data-testid={`view-${c.changeId}`}
                  >
                    {t('label.view')}
                  </Button>
                ),
              },
            ]}
            rows={sortOpenChanges(items)}
            rowKey={c => c.changeId}
            page={1}
            pageCount={1}
            onPage={() => {}}
            testId="table-open"
          />
        )}
      </SectionState>
    </SectionFrame>
  );
}
