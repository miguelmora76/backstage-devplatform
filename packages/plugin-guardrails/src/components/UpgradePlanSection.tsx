import { useEffect, useState } from 'react';
import { useGuardrails, useSessionVersion } from '../context';
import { useSection } from '../hooks/useSection';
import { actionState, pageCount, slicePage } from '../rules/derive';
import { t } from '../texts/texts';
import type { PlanItem } from '../api/types';
import { GuardedButton } from './GuardedButton';
import { PagedTable } from './PagedTable';
import { SectionFrame } from './SectionFrame';
import { SectionState } from './SectionState';
import type { ProposeSectionProps } from './sectionTypes';

/** The upgrade plan with a propose action per row (BR1.1, BR2.1). */
export function UpgradePlanSection({
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
    signal => api.plan(service, { signal }),
    [api, service, version, sessionVersion],
    { serverErrorPanel: true },
  );
  const down = section.state.status === 'server-error';
  useEffect(() => onServerDown(down), [down, onServerDown]);

  const propose = async (item: PlanItem) => {
    const r = await api.propose(service, 'upgrade', item.dependencyKey);
    if (r.ok) onProposed();
    else onWriteFailed(r.failure);
  };

  return (
    <SectionFrame title={t('section.plan')} testId="section-plan">
      <SectionState
        state={section.state}
        failure={section.failure}
        name={t('section.plan')}
        emptyKey="empty.plan"
        onRetry={section.reload}
      >
        {items => {
          const pages = pageCount(items.length);
          const current = Math.min(page, pages);
          return (
            <PagedTable
              caption={t('section.plan')}
              columns={[
                {
                  key: 'name',
                  header: t('column.dependency'),
                  render: i => i.name,
                },
                {
                  key: 'cur',
                  header: t('column.current'),
                  render: i => i.currentVersion,
                },
                {
                  key: 'rec',
                  header: t('column.recommended'),
                  render: i => i.recommendedVersion,
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
                        label={t('label.proposeChange')}
                        ariaLabel={t('label.proposeChangeFor', {
                          dependency: i.name,
                        })}
                        enabled={st.enabled}
                        reasonKey={st.reasonKey}
                        testId={`propose-${i.dependencyKey}`}
                        onActivate={() => propose(i)}
                      />
                    );
                  },
                },
              ]}
              rows={slicePage(items, current)}
              rowKey={i => i.dependencyKey}
              page={current}
              pageCount={pages}
              onPage={setPage}
              testId="table-plan"
            />
          );
        }}
      </SectionState>
    </SectionFrame>
  );
}
