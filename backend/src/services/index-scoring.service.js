const WEIGHTS = Object.freeze({
  selectivity: 25,
  predicateType: 20,
  tableSize: 15,
  existingCoverage: 20,
  optimizerEvidence: 10,
  queryCompatibility: 10,
});


function clampScore(value) {
return Math.max(0, Math.min(100, value));
}

function round(value) {
return Math.round(value * 100) / 100;
}

function getSelectivityScore(columnDetails) {
const estimates = columnDetails
.map((column) => column.selectivity?.selectivity)
.filter((value) =>
typeof value === 'number' &&
Number.isFinite(value)
);

if (estimates.length === 0) {
return {
score: 35,
reason: 'Selectivity statistics are unavailable.',
};
}

const average =
estimates.reduce((total, value) => total + value, 0) /
estimates.length;

if (average <= 0.01) {
return { score: 100, reason: 'Very selective predicates.' };
}

if (average <= 0.05) {
return { score: 85, reason: 'Highly selective predicates.' };
}

if (average <= 0.10) {
return { score: 70, reason: 'Moderately selective predicates.' };
}

if (average <= 0.25) {
return { score: 50, reason: 'Somewhat selective predicates.' };
}

if (average <= 0.50) {
return { score: 25, reason: 'Low-selectivity predicates.' };
}

return { score: 10, reason: 'Very low-selectivity predicates.' };
}

function getPredicateTypeScore(columnDetails) {
const types = new Set(
columnDetails.map((column) => column.predicateType)
);

if (types.has('equality') && types.has('range')) {
return {
score: 95,
reason: 'Candidate supports equality and range predicates.',
};
}

if (types.has('equality')) {
return {
score: 100,
reason: 'Candidate supports equality predicates.',
};
}

if (types.has('join')) {
return {
score: 90,
reason: 'Candidate includes JOIN columns.',
};
}

if (types.has('range')) {
return {
score: 75,
reason: 'Candidate supports range predicates.',
};
}

if (types.has('ordering')) {
return {
score: 60,
reason: 'Candidate supports query ordering.',
};
}

return {
score: 30,
reason: 'Candidate predicate compatibility is limited.',
};
}

function getTableSizeScore(estimatedRows) {
if (
estimatedRows === null ||
estimatedRows === undefined ||
!Number.isFinite(Number(estimatedRows))
) {
return {
score: 30,
reason: 'Table size statistics are unavailable.',
};
}

const rows = Number(estimatedRows);

if (rows >= 100_000) {
return { score: 100, reason: 'Large table.' };
}

if (rows >= 10_000) {
return { score: 80, reason: 'Medium-to-large table.' };
}

if (rows >= 1_000) {
return { score: 60, reason: 'Medium-sized table.' };
}

if (rows >= 100) {
return { score: 40, reason: 'Small table.' };
}

if (rows > 0) {
return { score: 20, reason: 'Very small table.' };
}

return {
score: 10,
reason: 'Optimizer estimates zero table rows.',
};
}

function getCoverageScore(coverage) {
switch (coverage?.status) {
case 'fully_covered':
return {
score: 0,
reason: 'An existing visible B-tree index already covers this candidate.',
};

case 'partially_covered':
return {
score: 40,
reason: 'An existing index covers only a prefix of this candidate.',
};

default:
return {
score: 100,
reason: 'No existing visible B-tree index covers this candidate.',
};
}
}

function getOptimizerScore(evidence) {
if (!evidence) {
return {
score: 50,
reason: 'No matching optimizer table-access evidence.',
};
}

const accessType = String(
evidence.accessType ?? ''
).toUpperCase();

const possibleKeys = evidence.possibleKeys ?? [];

if (
possibleKeys.length > 0 &&
!evidence.chosenKey
) {
return {
score: 35,
reason: 'MySQL identified possible indexes but selected none; investigate selectivity and optimizer estimates.',
};
}

if (accessType === 'ALL') {
return {
score: 55,
reason: 'MySQL currently plans a full table scan.',
};
}

if (['REF', 'EQ_REF', 'CONST', 'RANGE'].includes(accessType)) {
return {
score: 70,
reason: 'MySQL already uses indexed access.',
};
}

return {
score: 50,
reason: 'Optimizer evidence is inconclusive.',
};
}

function getCompatibilityScore(columnDetails) {
const hasJoin = columnDetails.some(
(column) => column.isJoinColumn
);

const hasOrdering = columnDetails.some(
(column) => column.isOrderColumn
);

if (hasJoin && hasOrdering) {
return {
score: 100,
reason: 'Candidate supports JOIN and ORDER BY columns.',
};
}

if (hasJoin) {
return {
score: 90,
reason: 'Candidate supports JOIN columns.',
};
}

if (hasOrdering) {
return {
score: 80,
reason: 'Candidate supports ORDER BY columns.',
};
}

return {
score: 60,
reason: 'Candidate supports filter predicates.',
};
}

function calculateWeightedScore(breakdown) {
const weightedTotal =
breakdown.selectivity.score * WEIGHTS.selectivity +
breakdown.predicateType.score * WEIGHTS.predicateType +
breakdown.tableSize.score * WEIGHTS.tableSize +
breakdown.existingCoverage.score * WEIGHTS.existingCoverage +
breakdown.optimizerEvidence.score * WEIGHTS.optimizerEvidence +
breakdown.queryCompatibility.score * WEIGHTS.queryCompatibility;

return round(clampScore(weightedTotal / 100));
}

function getScoreLabel(score) {
if (score >= 75) return 'strong_candidate';
if (score >= 50) return 'moderate_candidate';

return 'weak_candidate';
}

/**
- Score one index candidate.
-
- The score measures suitability for review, not guaranteed performance gain.
  */
  export function scoreIndexCandidate(candidate) {
  if (!candidate || !Array.isArray(candidate.columns)) {
  throw new TypeError('A valid index candidate is required.');
  }
const breakdown = {
selectivity: getSelectivityScore(
candidate.columnDetails ?? []
),
predicateType: getPredicateTypeScore(
candidate.columnDetails ?? []
),
tableSize: getTableSizeScore(
candidate.estimatedTableRows
),
existingCoverage: getCoverageScore(
candidate.existingIndexCoverage
),
optimizerEvidence: getOptimizerScore(
candidate.optimizerEvidence
),
queryCompatibility: getCompatibilityScore(
candidate.columnDetails ?? []
),
};

const score = calculateWeightedScore(breakdown);

const fullyCovered =
candidate.existingIndexCoverage?.status === 'fully_covered';

const warnings = [];

if (fullyCovered) {
warnings.push('An existing index already covers this candidate.');
}

if (
(candidate.columnDetails ?? []).some(
(column) => column.selectivity?.selectivity === null
)
) {
warnings.push('Some predicate selectivity estimates are unavailable.');
}

if (
candidate.estimatedTableRows === null ||
candidate.estimatedTableRows === undefined
) {
warnings.push('Table row estimates are unavailable.');
}

if (
candidate.optimizerEvidence?.possibleKeys?.length > 0 &&
!candidate.optimizerEvidence.chosenKey
) {
warnings.push('MySQL did not select an available possible index.');
}

return {
...candidate,
score,
scoreLabel: getScoreLabel(score),
isRecommendedForReview: !fullyCovered && score >= 50,
scoreBreakdown: breakdown,
scoringWeights: WEIGHTS,
warnings,
limitations: [
'Scores are heuristic and are not measured performance improvements.',
'MySQL table row counts and index cardinality may be approximate.',
'Write overhead and index storage costs are not yet included.',
'Composite index column ordering requires further workload analysis.',
'No index is created automatically.',
],
};
}

/**

* Score a collection of index candidates from highest to lowest.
*/
export function scoreIndexCandidates(candidates) {
if (!Array.isArray(candidates)) {
throw new TypeError('Index candidates must be an array.');
}

return candidates
.map(scoreIndexCandidate)
.sort((a, b) => b.score - a.score);
}