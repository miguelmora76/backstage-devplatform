// @ts-check

/**
 * Creates the changes and audit_entries tables and the append-only rule on the
 * audit table (BR5.1, BR8.1; NFR5.5, NFR5.10).
 *
 * @param {import('knex').Knex} knex
 */
exports.up = async function up(knex) {
  await knex.schema.createTable('changes', table => {
    table.comment('Proposed upgrades and CI re-runs and their life.');
    table.string('change_id').primary().notNullable();
    table.string('kind').notNullable();
    table.string('service').notNullable();
    table.string('target').notNullable();
    table.text('summary').notNullable();
    table.string('proposed_by').notNullable();
    table.string('status').notNullable().defaultTo('pending');
    table.string('decided_by');
    table.text('decision_reason');
    table.text('failure_message');
    table.string('proposed_at').notNullable();
    table.string('decided_at');
    table.string('claimed_at');
    table.string('claim_token');
    table.string('claimed_by');
    table.string('claimed_action');
    table.text('claim_reason');
    table.string('claim_previous_status');
    table.integer('decision_count').notNullable().defaultTo(0);
    table.string('last_action');
    table.string('last_outcome');
    table.index(['service', 'proposed_at'], 'changes_service_time_idx');
  });

  await knex.schema.createTable('audit_entries', table => {
    table.comment(
      'Append-only record of every proposal, decision and refusal.',
    );
    table.bigIncrements('entry_id');
    table.string('time').notNullable();
    table.string('actor').notNullable();
    table.string('action').notNullable();
    table.string('service').notNullable();
    table.string('target').notNullable();
    table.string('outcome').notNullable();
    table.text('reason');
    table.string('change_id');
    table.integer('decision_number');
    table.unique(['change_id', 'decision_number'], {
      indexName: 'audit_entries_change_decision_uniq',
    });
    table.index(['service', 'time'], 'audit_entries_service_time_idx');
  });

  if (knex.client.dialect === 'postgresql') {
    await knex.raw(`
      create function guardrails_audit_append_only() returns trigger as $$
      begin
        raise exception 'audit_entries is append-only';
      end;
      $$ language plpgsql
    `);
    await knex.raw(`
      create trigger audit_entries_no_change
      before update or delete on audit_entries
      for each row execute function guardrails_audit_append_only()
    `);
    await knex.raw(`
      create trigger audit_entries_no_truncate
      before truncate on audit_entries
      for each statement execute function guardrails_audit_append_only()
    `);
  } else {
    await knex.raw(`
      create trigger audit_entries_no_update
      before update on audit_entries
      begin
        select raise(abort, 'audit_entries is append-only');
      end
    `);
    await knex.raw(`
      create trigger audit_entries_no_delete
      before delete on audit_entries
      begin
        select raise(abort, 'audit_entries is append-only');
      end
    `);
  }
};

/**
 * @param {import('knex').Knex} knex
 */
exports.down = async function down(knex) {
  if (knex.client.dialect === 'postgresql') {
    await knex.raw(
      'drop trigger if exists audit_entries_no_truncate on audit_entries',
    );
    await knex.raw(
      'drop trigger if exists audit_entries_no_change on audit_entries',
    );
    await knex.raw('drop function if exists guardrails_audit_append_only()');
  }
  await knex.schema.dropTable('audit_entries');
  await knex.schema.dropTable('changes');
};
