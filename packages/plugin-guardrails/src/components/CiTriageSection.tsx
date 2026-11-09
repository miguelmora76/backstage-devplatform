import { useEffect, useState } from 'react';
import { useGuardrails, useSessionVersion } from '../context';
import { useSection } from '../hooks/useSection';
import { actionState, pageCount, slicePage } from '../rules/derive';
import { t } from '../texts/texts';
import type { CiRunItem } from '../api/types';
import { GuardedButton } from './GuardedButton';
import { PagedTable } from './PagedTable';
import { SectionFrame } from './SectionFrame';
import { SectionState } from './SectionState';
import type { ProposeSectionProps } from './sectionTypes';

/** The failed CI runs with a re-run action per row (BR1.3, BR2.1). */
export function CiTriageSection({
  service,
  version,
  writesDisabled,
  onServerDown,
  onProposed,
  onWriteFailed,
}: ProposeSectionProps) {
  const { api } = useGuardrails();
  const sessionVersion = useSessionVersion();
  const [page, setPage] = useState(1);
  const section = useSection(
    signal => api.ciRuns(service, { signal }),
    [api, service, version, sessionVersion],
    { serverErrorPanel: true },
  );
  const down = section.state.status === 'server-error';
  useEffect(() => onServerDown(down), [down, onServerDown]);

  const propose = async (item: CiRunItem) => {
    const r = await api.propose(service, 'rerun', item.runKey);
    if (r.ok) onProposed();
    else onWriteFailed(r.failure);
  };

  return (
    <SectionFrame title={t('section.ci')} testId="section-ci">
      <SectionState
        state={section.state}
        failure={section.failure}
        name={t('section.ci')}
        emptyKey="empty.ci"
        onRetry={section.reload}
      >
        {items => {
          const pages = pageCount(items.length);
          const current = Math.min(page, pages);
          return (
            <PagedTable
              caption={t('section.ci')}
              columns={[
                {
                  key: 'run',
                  header: t('column.run'),
                  render: i => `#${i.runNumber}`,
                },
                {
                  key: 'cause',
                  header: t('column.cause'),
                  render: i => i.cause,
                },
                {
                  key: 'action',
                  header: t('column.action'),
                  render: i => {
                    const st = writesDisabled
                      ? {
                          enabled: false,
                          reasonKey: 'disabled.unreachable' as const,
                        }
                      : actionState(i.allowedActions, 'propose');
                    return (
                      <GuardedButton
                        label={t('label.proposeRerun')}
                        ariaLabel={t('label.proposeRerunFor', {
                          runNumber: i.runNumber,
                        })}
                        enabled={st.enabled}
                        reasonKey={st.reasonKey}
                        testId={`rerun-${i.runKey}`}
                        onActivate={() => propose(i)}
                      />
                    );
                  },
                },
              ]}
              rows={slicePage(items, current)}
              rowKey={i => i.runKey}
              page={current}
              pageCount={pages}
              onPage={setPage}
              testId="table-ci"
            />
          );
        }}
      </SectionState>
    </SectionFrame>
  );
}
