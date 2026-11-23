function isObject(value) {
  return value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value);
}

function collectTableNodes(value, results = []) {
  if (Array.isArray(value)) {
    for (const item of value) {
      collectTableNodes(item, results);
    }

    return results;
  }

  if (!isObject(value)) {
    return results;
  }

  if (typeof value.table_name === 'string') {
    results.push(value);
  }

  for (const child of Object.values(value)) {
    if (isObject(child) || Array.isArray(child)) {
      collectTableNodes(child, results);
    }
  }

  return results;
}

function containsFlag(value, flag) {
  if (Array.isArray(value)) {
    return value.some((item) => containsFlag(item, flag));
  }

  if (!isObject(value)) {
    return false;
  }

  if (value[flag] === true) {
    return true;
  }

  return Object.values(value).some(
    (child) =>
      (isObject(child) || Array.isArray(child)) &&
      containsFlag(child, flag)
  );
}

function toNumber(value) {
  const number = Number(value);

  return Number.isFinite(number) ? number : null;
}

function normalizeTableAccess(table) {
  const costInfo = table.cost_info ?? {};

  return {
    tableName: table.table_name,
    accessType: table.access_type ?? null,
    possibleKeys: table.possible_keys ?? [],
    chosenKey: table.key ?? null,

    estimatedRows: toNumber(
      table.rows_examined_per_scan ?? table.rows
    ),

    estimatedRowsProduced: toNumber(
      table.rows_produced_per_join
    ),

    filteredPercentage: toNumber(table.filtered),

    usingIndex: table.using_index === true,
    usingIndexCondition:
      table.using_index_condition === true,

    usingJoinBuffer: table.using_join_buffer ?? null,
    attachedCondition: table.attached_condition ?? null,

    estimatedReadCost: toNumber(costInfo.read_cost),
    estimatedEvaluationCost: toNumber(costInfo.eval_cost),
  };
}

function analyzeTableAccess(table, findings) {
  const accessType = String(
    table.access_type ?? ''
  ).toUpperCase();

  const tableName = table.table_name;

  const estimatedRows = toNumber(
    table.rows_examined_per_scan ?? table.rows
  );

  if (accessType === 'ALL') {
    findings.push({
      type: 'full_table_scan',

      severity:
        estimatedRows !== null && estimatedRows >= 1_000
          ? 'warning'
          : 'info',

      tableName,

      message:
        `MySQL plans to scan all rows of "${tableName}".`,

      recommendation:
        'Review the WHERE and JOIN conditions. Consider an index only if it matches the query workload and improves the execution plan.',

      evidence: {
        accessType,
        estimatedRows,
        possibleKeys: table.possible_keys ?? [],
      },
    });
  }

  if (accessType === 'INDEX') {
    findings.push({
      type: 'full_index_scan',
      severity: 'info',
      tableName,

      message:
        `MySQL plans to scan an entire index on "${tableName}".`,

      recommendation:
        'Check whether the query can use a more selective index access method.',

      evidence: {
        accessType,
        chosenKey: table.key ?? null,
        estimatedRows,
      },
    });
  }

  if (
    Array.isArray(table.possible_keys) &&
    table.possible_keys.length > 0 &&
    !table.key
  ) {
    findings.push({
      type: 'candidate_indexes_not_selected',
      severity: 'info',
      tableName,

      message:
        `MySQL identified possible indexes for "${tableName}" but selected none.`,

      recommendation:
        'Review predicate selectivity, column order, data distribution, and optimizer estimates before changing indexes.',

      evidence: {
        possibleKeys: table.possible_keys,
        accessType,
        estimatedRows,
      },
    });
  }

  if (table.using_join_buffer) {
    findings.push({
      type: 'join_buffer_used',
      severity: 'info',
      tableName,

      message:
        `MySQL uses a join buffer for "${tableName}".`,

      recommendation:
        'Inspect the join condition and available indexes on the joined columns.',

      evidence: {
        joinBuffer: table.using_join_buffer,
      },
    });
  }
}

function summarizeCounts(findings) {
  const counts = {
    critical: 0,
    warning: 0,
    info: 0,
  };

  for (const finding of findings) {
    counts[finding.severity]++;
  }

  return counts;
}

/**
 * Analyze a MySQL EXPLAIN FORMAT=JSON result.
 */
export function analyzeQueryExecutionPlan(plan) {
  if (!isObject(plan)) {
    throw new TypeError(
      'A valid MySQL JSON execution plan is required.'
    );
  }

  const tableNodes = collectTableNodes(plan);
  const findings = [];

  const tableAccesses = tableNodes.map((table) => {
    analyzeTableAccess(table, findings);
    return normalizeTableAccess(table);
  });

  const usesTemporaryTable = containsFlag(
    plan,
    'using_temporary_table'
  );

  const usesFilesort = containsFlag(
    plan,
    'using_filesort'
  );

  if (usesTemporaryTable) {
    findings.push({
      type: 'temporary_table',
      severity: 'info',

      message:
        'The execution plan includes a temporary table operation.',

      recommendation:
        'Review GROUP BY, DISTINCT, and ORDER BY operations. A temporary table is not automatically a performance problem.',
    });
  }

  if (usesFilesort) {
    findings.push({
      type: 'filesort',
      severity: 'info',

      message:
        'The execution plan includes a filesort operation.',

      recommendation:
        'Review ORDER BY and GROUP BY columns and check whether an appropriate index can satisfy the ordering. Filesort does not necessarily mean disk sorting.',
    });
  }

  const joinCount = Math.max(
    0,
    tableAccesses.length - 1
  );

  return {
    tableCount: tableAccesses.length,
    joinCount,

    operations: {
      usesTemporaryTable,
      usesFilesort,
    },

    tableAccesses,

    findingCount: findings.length,
    counts: summarizeCounts(findings),
    findings,

    limitations: [
      'EXPLAIN provides optimizer estimates, not actual runtime measurements.',
      'The SELECT query is not executed by this analysis.',
      'Estimated row counts can differ from actual rows.',
      'Index recommendations require workload and data-distribution review.',
      'A full table scan may be optimal for small tables or low-selectivity queries.',
    ],
  };
}