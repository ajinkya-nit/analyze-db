import {
  discoverTableColumnStatistics,
} from '../database/adapters/mysql-schema.adapter.js';

const DEFAULT_OPTIONS = Object.freeze({
  includeExactNullCounts: false,
  maxExactNullCountColumns: 0,
  maxHistogramBuckets: 100,
});

/**
 * Collect column statistics without generating histograms or running expensive
 * aggregate queries unless exact null counts have been explicitly enabled.
 */
export async function discoverColumnStatistics(
  connection,
  databaseName,
  tableName,
  { columns, indexes, estimatedRowCount, options = {} }
) {
  return discoverTableColumnStatistics(
    connection,
    databaseName,
    tableName,
    {
      columns,
      indexes,
      estimatedRowCount,
      ...getColumnStatisticsOptions(options),
    }
  );
}

/**
 * Resolve process configuration while keeping discovery lightweight by default.
 */
export function getColumnStatisticsOptions(overrides = {}) {
  return {
    includeExactNullCounts: parseBoolean(
      overrides.includeExactNullCounts ??
        process.env.SCHEMA_STATISTICS_INCLUDE_EXACT_NULL_COUNTS,
      DEFAULT_OPTIONS.includeExactNullCounts
    ),
    maxExactNullCountColumns: parseNonNegativeInteger(
      overrides.maxExactNullCountColumns ??
        process.env.SCHEMA_STATISTICS_MAX_EXACT_NULL_COUNT_COLUMNS,
      DEFAULT_OPTIONS.maxExactNullCountColumns
    ),
    maxHistogramBuckets: parseNonNegativeInteger(
      overrides.maxHistogramBuckets ??
        process.env.SCHEMA_STATISTICS_MAX_HISTOGRAM_BUCKETS,
      DEFAULT_OPTIONS.maxHistogramBuckets
    ),
  };
}

function parseBoolean(value, fallback) {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value !== 'string') {
    return fallback;
  }

  if (value.toLowerCase() === 'true') {
    return true;
  }

  if (value.toLowerCase() === 'false') {
    return false;
  }

  return fallback;
}

function parseNonNegativeInteger(value, fallback) {
  const number = Number(value);
  return Number.isInteger(number) && number >= 0 ? number : fallback;
}
