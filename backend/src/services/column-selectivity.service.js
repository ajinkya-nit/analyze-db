
const LOW_SELECTIVITY_THRESHOLD = 0.10;

function toFiniteNumber(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function clamp(value, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}

function normalizeLiteral(value) {
  if (typeof value === 'string') {
    return value.toLowerCase();
  }

  return value;
}

function valuesEqual(left, right) {
  if (left === right) return true;

  const leftNumber = toFiniteNumber(left);
  const rightNumber = toFiniteNumber(right);

  if (leftNumber !== null && rightNumber !== null) {
    return leftNumber === rightNumber;
  }

  return normalizeLiteral(left) === normalizeLiteral(right);
}

function compareValues(left, right) {
  const leftNumber = toFiniteNumber(left);
  const rightNumber = toFiniteNumber(right);

  if (leftNumber !== null && rightNumber !== null) {
    return Math.sign(leftNumber - rightNumber);
  }

  const leftDate = Date.parse(left);
  const rightDate = Date.parse(right);

  if (
    typeof left === 'string' &&
    typeof right === 'string' &&
    Number.isFinite(leftDate) &&
    Number.isFinite(rightDate)
  ) {
    return Math.sign(leftDate - rightDate);
  }

  if (typeof left === 'string' && typeof right === 'string') {
    return Math.sign(left.localeCompare(right));
  }

  return null;
}

function normalizeBucketFrequency(value) {
  const frequency = toFiniteNumber(value);

  return frequency === null ? null : clamp(frequency);
}

function getHistogramBuckets(histogram) {
  return Array.isArray(histogram?.buckets)
    ? histogram.buckets
    : [];
}

function estimateSingletonEquality(histogram, value) {
  const buckets = getHistogramBuckets(histogram);

  let previousCumulative = 0;

  for (const bucket of buckets) {
    if (!Array.isArray(bucket) || bucket.length < 2) {
      continue;
    }

    const bucketValue = bucket[0];
    const cumulative = normalizeBucketFrequency(bucket[1]);

    if (cumulative === null) continue;

    if (valuesEqual(bucketValue, value)) {
      return {
        selectivity: clamp(cumulative - previousCumulative),
        source: 'histogram_singleton',
        confidence: histogram.samplingRate === 1
          ? 'high'
          : 'medium',
        method: 'singleton_value_frequency',
      };
    }

    previousCumulative = cumulative;
  }

  return {
    selectivity: 0,
    source: 'histogram_singleton',
    confidence: 'medium',
    method: 'value_not_present_in_histogram',
  };
}

function estimateEquiHeightEquality(histogram, value) {
  const buckets = getHistogramBuckets(histogram);

  let previousCumulative = 0;

  for (const bucket of buckets) {
    if (!Array.isArray(bucket) || bucket.length < 4) {
      continue;
    }

    const lower = bucket[0];
    const upper = bucket[1];
    const cumulative = normalizeBucketFrequency(bucket[2]);
    const distinctValues = toFiniteNumber(bucket[3]);

    if (
      cumulative === null ||
      distinctValues === null ||
      distinctValues <= 0
    ) {
      continue;
    }

    const lowerComparison = compareValues(value, lower);
    const upperComparison = compareValues(value, upper);

    if (
      lowerComparison !== null &&
      upperComparison !== null &&
      lowerComparison >= 0 &&
      upperComparison <= 0
    ) {
      const bucketMass = clamp(cumulative - previousCumulative);

      return {
        selectivity: clamp(bucketMass / distinctValues),
        source: 'histogram_equi_height',
        confidence: 'medium',
        method: 'average_frequency_within_histogram_bucket',
      };
    }

    previousCumulative = cumulative;
  }

  return {
    selectivity: 0,
    source: 'histogram_equi_height',
    confidence: 'low',
    method: 'value_outside_histogram_buckets',
  };
}

function estimateHistogramEquality(histogram, value) {
  if (
    histogram?.status !== 'available' ||
    !Array.isArray(histogram.buckets) ||
    histogram.buckets.length === 0
  ) {
    return null;
  }

  if (histogram.histogramType === 'singleton') {
    return estimateSingletonEquality(histogram, value);
  }

  if (histogram.histogramType === 'equi-height') {
    return estimateEquiHeightEquality(histogram, value);
  }

  return null;
}

function estimateSingletonRange(histogram, operator, value) {
  const buckets = getHistogramBuckets(histogram);

  let previousCumulative = 0;
  let selectivity = 0;

  for (const bucket of buckets) {
    if (!Array.isArray(bucket) || bucket.length < 2) {
      continue;
    }

    const bucketValue = bucket[0];
    const cumulative = normalizeBucketFrequency(bucket[1]);

    if (cumulative === null) continue;

    const frequency = clamp(cumulative - previousCumulative);
    const comparison = compareValues(bucketValue, value);

    if (comparison === null) {
      return null;
    }

    const matches =
      operator === '>' ? comparison > 0 :
      operator === '>=' ? comparison >= 0 :
      operator === '<' ? comparison < 0 :
      operator === '<=' ? comparison <= 0 :
      false;

    if (matches) {
      selectivity += frequency;
    }

    previousCumulative = cumulative;
  }

  return {
    selectivity: clamp(selectivity),
    source: 'histogram_singleton',
    confidence: histogram.samplingRate === 1
      ? 'high'
      : 'medium',
    method: 'singleton_range_distribution',
  };
}

function getDistinctValueEstimate(statistics) {
  const estimates = (statistics?.indexCardinality ?? [])
    .filter((item) =>
      item.isApproximateDistinctValues === true &&
      item.approximateDistinctValues !== null &&
      item.approximateDistinctValues !== undefined
    )
    .map((item) => ({
      value: toFiniteNumber(item.approximateDistinctValues),
      isUnique: item.isUnique === true,
      isPrimary: item.isPrimary === true,
    }))
    .filter((item) => item.value !== null && item.value > 0);

  if (estimates.length === 0) {
    return null;
  }

  // Prefer unique/primary indexes, then the largest available estimate.
  estimates.sort((a, b) => {
    const aPriority = Number(a.isUnique || a.isPrimary);
    const bPriority = Number(b.isUnique || b.isPrimary);

    return bPriority - aPriority || b.value - a.value;
  });

  return estimates[0].value;
}

function buildResult({
  predicate,
  column,
  selectivity,
  source,
  confidence,
  method,
  distinctValues = null,
  estimatedTableRows = null,
  warnings = [],
}) {
  const normalizedSelectivity =
    selectivity === null ? null : clamp(selectivity);

  const estimatedRows =
    normalizedSelectivity !== null &&
    estimatedTableRows !== null &&
    estimatedTableRows >= 0
      ? Math.round(normalizedSelectivity * estimatedTableRows)
      : null;

  return {
    columnName: predicate.columnName,
    operator: predicate.operator,
    selectivity: normalizedSelectivity,
    estimatedMatchingRows: estimatedRows,
    estimatedTableRows,
    distinctValues,
    source,
    confidence,
    method,
    isLowSelectivity:
      normalizedSelectivity !== null &&
      normalizedSelectivity >= LOW_SELECTIVITY_THRESHOLD,
    warnings,
  };
}

/**
 * Estimate selectivity for one predicate using saved MySQL statistics.
 *
 * Literal values must be explicitly marked as known. Parameterized queries
 * should not pretend that their parameter values are available.
 */
export function estimateColumnSelectivity({
  predicate,
  column,
  columnStatistics,
  estimatedTableRows = null,
}) {
  if (!predicate || !predicate.columnName || !predicate.operator) {
    throw new TypeError('A valid column predicate is required.');
  }

  const statistics = columnStatistics ?? {};
  const histogram = statistics.histogram ?? {};
  const rows = toFiniteNumber(
    estimatedTableRows ?? statistics.estimatedTableRows
  );

  const operator = predicate.operator.toUpperCase();
  const warnings = [];

  if (operator === 'IS NULL') {
    const nullFraction = toFiniteNumber(
      histogram.nullValuesFraction
    );

    if (nullFraction !== null) {
      return buildResult({
        predicate,
        column,
        selectivity: nullFraction,
        source: 'histogram_null_fraction',
        confidence: 'medium',
        method: 'histogram_null_fraction',
        estimatedTableRows: rows,
      });
    }

    if (column?.isNullable === false) {
      return buildResult({
        predicate,
        column,
        selectivity: 0,
        source: 'schema_nullability',
        confidence: 'high',
        method: 'non_nullable_column',
        estimatedTableRows: rows,
      });
    }

    warnings.push('NULL distribution is not available.');

    return buildResult({
      predicate,
      column,
      selectivity: null,
      source: 'unavailable',
      confidence: 'low',
      method: 'unknown_null_distribution',
      estimatedTableRows: rows,
      warnings,
    });
  }

  if (operator === 'IS NOT NULL') {
    const nullFraction = toFiniteNumber(
      histogram.nullValuesFraction
    );

    if (nullFraction !== null) {
      return buildResult({
        predicate,
        column,
        selectivity: 1 - clamp(nullFraction),
        source: 'histogram_null_fraction',
        confidence: 'medium',
        method: 'complement_of_null_fraction',
        estimatedTableRows: rows,
      });
    }

    if (column?.isNullable === false) {
      return buildResult({
        predicate,
        column,
        selectivity: 1,
        source: 'schema_nullability',
        confidence: 'high',
        method: 'non_nullable_column',
        estimatedTableRows: rows,
      });
    }

    return buildResult({
      predicate,
      column,
      selectivity: null,
      source: 'unavailable',
      confidence: 'low',
      method: 'unknown_null_distribution',
      estimatedTableRows: rows,
      warnings: ['NULL distribution is not available.'],
    });
  }

  const isEquality = ['=', '=='].includes(operator);
  const isRange = ['>', '>=', '<', '<='].includes(operator);

  if (
    predicate.valueKnown === true &&
    isEquality
  ) {
    const histogramEstimate = estimateHistogramEquality(
      histogram,
      predicate.value
    );

    if (histogramEstimate) {
      return buildResult({
        predicate,
        column,
        ...histogramEstimate,
        estimatedTableRows: rows,
        warnings,
      });
    }
  }

  if (
    predicate.valueKnown === true &&
    isRange &&
    histogram.histogramType === 'singleton'
  ) {
    const histogramEstimate = estimateSingletonRange(
      histogram,
      operator,
      predicate.value
    );

    if (histogramEstimate) {
      return buildResult({
        predicate,
        column,
        ...histogramEstimate,
        estimatedTableRows: rows,
        warnings,
      });
    }
  }

  if (isEquality) {
    const distinctValues = getDistinctValueEstimate(statistics);

    if (distinctValues !== null) {
      return buildResult({
        predicate,
        column,
        selectivity: 1 / distinctValues,
        source: 'index_cardinality',
        confidence: 'low',
        method: 'uniform_distribution_assumption',
        distinctValues,
        estimatedTableRows: rows,
        warnings: [
          'Assumes a uniform distribution; actual value frequency may differ.',
        ],
      });
    }
  }

  return buildResult({
    predicate,
    column,
    selectivity: null,
    source: 'unavailable',
    confidence: 'low',
    method: 'insufficient_statistics',
    estimatedTableRows: rows,
    warnings: [
      'Available statistics are insufficient for a reliable estimate.',
    ],
  });
}
