import { useEffect, useState } from 'react';
import { useDemoUsers, useGuardrails, useSessionVersion } from '../context';
import { useSection } from '../hooks/useSection';
import { dateRangeInvalid, pageCount } from '../rules/derive';
import { endOfDayIso, formatTime, startOfDayIso } from '../texts/formatTime';
import { t } from '../texts/texts';
import type { AuditFilters as ApiFilters } from '../api/types';
import { AuditFilters, NO_FILTERS, type FilterValues } from './AuditFilters';
import { PagedTable } from './PagedTable';
import { SectionFrame } from './SectionFrame';
import { SectionState } from './SectionState';
import { StatusLabel } from './StatusLabel';

function toApiFilters(v: FilterValues): ApiFilters {
  const filters: ApiFilters = {};
  const from = startOfDayIso(v.from);
  const to = endOfDayIso(v.to);
  if (from) filters.from = from;
  if (to) filters.to = to;
  if (v.actor) filters.actor = v.actor;
  if (v.action) filters.action = v.action;
  if (v.outcome) filters.outcome = v.outcome;
  return filters;
}

const hasFilters = (v: FilterValues) => Object.values(v).some(x => x !== '');

/**
 * The audit log of this service: filters, table, paging. Every control here
 * reads; there is no way to edit, delete or add an entry (BR4.3, NFR5.1).
 */
export function AuditLogSection({
  service,
  version,
}: {
  service: string;
  version: number;
}) {
  const { api } = useGuardrails();
  const sessionVersion = useSessionVersion();
  const users = useDemoUsers() ?? [];
  const [values, setValues] = useState<FilterValues>(NO_FILTERS);
  const [applied, setApplied] = useState<FilterValues>(NO_FILTERS);
  const [page, setPage] = useState(1);
  const invalid = dateRangeInvalid(values.from, values.to);

  // A change of filters applies from page 1; an invalid date range applies
  // nothing and requests nothing (BR4.2).
  useEffect(() => {
    if (!invalid) {
      setApplied(values);
      setPage(1);
    }
  }, [values, invalid]);

  const section = useSection(
    signal => api.audit(service, toApiFilters(applied), page, { signal }),
    [api, service, version, sessionVersion, applied, page],
    { isEmpty: d => d.items.length === 0, keepPrevious: true },
  );

  return (
    <SectionFrame title={t('section.audit')} testId="section-audit">
      <AuditFilters
        users={users}
        values={values}
        onChange={setValues}
        rangeInvalid={invalid}
        disabled={section.state.status === 'load-failed'}
      />
      <SectionState
        state={section.state}
        failure={section.failure}
        refreshing={section.refreshing}
        name={t('section.audit')}
        emptyKey={hasFilters(applied) ? 'empty.auditFiltered' : 'empty.audit'}
        onRetry={section.reload}
      >
        {data => (
          <PagedTable
            caption={t('section.audit')}
            columns={[
              {
                key: 'time',
                header: t('column.time'),
                render: e => formatTime(e.time),
              },
              {
                key: 'actor',
                header: t('column.actor'),
                render: e => e.actor.name,
              },
              {
                key: 'action',
                header: t('column.auditAction'),
                render: e => t(`action.${e.action}`),
              },
              {
                key: 'service',
                header: t('column.service'),
                render: e => e.service,
              },
              {
                key: 'target',
                header: t('column.target'),
                render: e => e.target,
              },
              {
                key: 'outcome',
                header: t('column.outcome'),
                render: e => <StatusLabel status={e.outcome} />,
              },
              {
                key: 'reason',
                header: t('column.reason'),
                render: e => e.reason ?? t('text.noReason'),
              },
            ]}
            rows={data.items}
            rowKey={e => e.entryId}
            page={data.page}
            pageCount={pageCount(data.total, data.pageSize)}
            onPage={setPage}
            testId="table-audit"
          />
        )}
      </SectionState>
    </SectionFrame>
  );
}
