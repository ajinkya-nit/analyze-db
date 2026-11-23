function normalizeIdentifier(value) {
    return value?.replace(/^[`"]|[`"]$/g, '') ?? null;
}

function escapeIdentifier(value) {
    return `\`${String(value).replace(/`/g, '``')}\``;
}

function normalizeSql(sql) {
    return sql
        .replace(/'(?:''|\\.|[^'])*'/g, '?')
        .replace(/"(?:\\.|[^"])*"/g, '?')
        .replace(/\b\d+(?:\.\d+)?\b/g, '?')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();
}

function unique(values) {
    return [...new Set(values.filter(Boolean))];
}

function parseTableReferences(sql) {
    const references = [];

    const pattern =
        /\b(?:FROM|JOIN)\s+(`?[a-zA-Z_][\w$]*`?)(?:\s*\.\s*(`?[a-zA-Z_][\w$]*`?))?(?:\s+(?:AS\s+)?(`?[a-zA-Z_][\w$]*`?))?/gi;

    const reservedAliases = new Set([
        'WHERE', 'JOIN', 'LEFT', 'RIGHT', 'INNER',
        'OUTER', 'CROSS', 'ON', 'GROUP', 'ORDER',
        'LIMIT', 'HAVING', 'UNION', 'FULL',
    ]);

    let match;

    while ((match = pattern.exec(sql)) !== null) {
        const schemaName = match[2]
            ? normalizeIdentifier(match[1])
            : null;

        const tableName = normalizeIdentifier(
            match[2] ?? match[1]
        );

        let alias = normalizeIdentifier(match[3]);

        if (alias && reservedAliases.has(alias.toUpperCase())) {
            alias = null;
        }

        references.push({
            schemaName,
            tableName,
            alias: alias ?? tableName,
        });
    }

    return references;
}

function extractJoinColumns(sql) {
    const results = [];

    const pattern =
        /\bON\s+([a-zA-Z_][\w$]*)\s*\.\s*`?([a-zA-Z_][\w$]*)`?\s*=\s*([a-zA-Z_][\w$]*)\s*\.\s*`?([a-zA-Z_][\w$]*)`?/gi;

    let match;

    while ((match = pattern.exec(sql)) !== null) {
        results.push({
            alias: match[1],
            columnName: match[2],
            type: 'join',
        });

        results.push({
            alias: match[3],
            columnName: match[4],
            type: 'join',
        });
    }

    return results;
}

function extractColumnReferences(expression) {
    const columns = [];
    const pattern =
        /(?:\b([a-zA-Z_][\w$]*)\s*\.\s*)?`?([a-zA-Z_][\w$]*)`?\s*(?:=|<>|!=|>=|<=|>|<|\bLIKE\b|\bIN\b|\bIS\b)/gi;

    let match;

    while ((match = pattern.exec(expression)) !== null) {
        columns.push({
            alias: match[1] ?? null,
            columnName: match[2],
        });
    }

    return columns;
}

function extractOrderByColumns(sql) {
    const match = sql.match(
        /\bORDER\s+BY\s+([\s\S]*?)(?=\bLIMIT\b|\bHAVING\b|\bUNION\b|$)/i
    );

    if (!match) {
        return [];
    }

    return match[1]
        .split(',')
        .map((part) => {
            const columnMatch = part.trim().match(
                /^(?:([a-zA-Z_][\w$]*)\s*\.\s*)?`?([a-zA-Z_][\w$]*)`?(?:\s+(ASC|DESC))?$/i
            );

            if (!columnMatch) {
                return null;
            }

            return {
                alias: columnMatch[1] ?? null,
                columnName: columnMatch[2],
                direction: (columnMatch[3] ?? 'ASC').toUpperCase(),
            };
        })
        .filter(Boolean);
}

function extractPredicates(sql) {
    const predicates = [];

    const identifier =
        '(?:`?[a-zA-Z_][\\w$]*`?\\s*\\.\\s*)?`?[a-zA-Z_][\\w$]*`?';
    const pattern = new RegExp(
        String.raw`(?:\bWHERE\b|\bON\b|\bAND\b|\bOR\b)\s+(${identifier})\s*(IS\s+NOT\s+NULL|IS\s+NULL|>=|<=|<>|!=|=|>|<|\bLIKE\b|\bIN\b)(?:\s*(?:'((?:''|\\.|[^'])*)'|"((?:""|\\.|[^"])*)"|([-+]?\d+(?:\.\d+)?(?:e[-+]?\d+)?|\bNULL\b|\bTRUE\b|\bFALSE\b|\?)))?`,
        'gi'
    );

    let match;

    while ((match = pattern.exec(sql)) !== null) {
        const parts = match[1]
            .split('.')
            .map((part) => normalizeIdentifier(part.trim()));
        const operator = match[2].toUpperCase().replace(/\s+/g, ' ');

        let value;
        let valueKnown = false;

        if (operator === 'IS NULL' || operator === 'IS NOT NULL') {
            value = null;
            valueKnown = true;
        } else if (match[3] !== undefined) {
            value = match[3].replaceAll("''", "'");
            valueKnown = true;
        } else if (match[4] !== undefined) {
            value = match[4].replaceAll('""', '"');
            valueKnown = true;
        } else if (match[5] !== undefined) {
            const rawValue = match[5];

            if (rawValue.toUpperCase() === 'NULL') {
                value = null;
                valueKnown = true;
            } else if (rawValue.toUpperCase() === 'TRUE') {
                value = true;
                valueKnown = true;
            } else if (rawValue.toUpperCase() === 'FALSE') {
                value = false;
                valueKnown = true;
            } else if (rawValue !== '?') {
                value = Number(rawValue);
                valueKnown = Number.isFinite(value);
            }
        }

        predicates.push({
            alias: parts.length > 1 ? parts[0] : null,
            columnName: parts.at(-1),
            operator,
            value,
            valueKnown,
        });
    }

    return predicates;
}

function getExistingIndexPrefixes(indexes) {
    return (indexes ?? []).map((index) =>
        (index.columns ?? [])
            .slice()
            .sort((a, b) => a.position - b.position)
            .map((part) => part.columnName)
            .filter(Boolean)
    );
}

function hasExistingIndex(indexes, candidateColumns) {
    const existingPrefixes = getExistingIndexPrefixes(indexes);

    return existingPrefixes.some((existing) =>
        existing.length >= candidateColumns.length &&
        candidateColumns.every(
            (column, position) => existing[position] === column
        )
    );
}

function getPredicateType(operator) {
    if (['=', 'IS NULL', 'IS NOT NULL'].includes(operator)) {
        return 'equality';
    }

    if (['>', '<', '>=', '<=', 'LIKE', 'IN'].includes(operator)) {
        return 'range';
    }

    return 'other';
}

function buildTableAnalysis(reference, metadata, allPredicates, orderColumns, joinColumns) {
    const table = metadata.find((item) =>
        item.object_name.toLowerCase() === reference.tableName.toLowerCase() &&
        (!reference.schemaName ||
            item.schema_name.toLowerCase() === reference.schemaName.toLowerCase())
    );

    if (!table) {
    return {
        tableName: reference.tableName,
        schemaName: reference.schemaName,
        alias: reference.alias,
        schemaFound: false,
        predicates: [],
        joins: [],
        ordering: [],
        columnsReferenced: [],
        existingIndexCount: 0,
        recommendations: [],
    };
    }

    const tableColumns = table.metadata?.columns ?? [];

    const predicates = allPredicates.filter((predicate) =>
        predicate.alias
            ? predicate.alias.toLowerCase() === reference.alias.toLowerCase()
            : reference.alias.toLowerCase() === reference.tableName.toLowerCase()
    );

    const orders = orderColumns.filter((column) =>
        column.alias
            ? column.alias.toLowerCase() === reference.alias.toLowerCase()
            : reference.alias.toLowerCase() === reference.tableName.toLowerCase()
    );
    const joins = joinColumns.filter(
        (column) =>
            column.alias.toLowerCase() === reference.alias.toLowerCase()
    );

    const knownColumns = new Set(
        tableColumns.map((column) => column.columnName.toLowerCase())
    );

    const validPredicates = predicates.filter((predicate) =>
        knownColumns.has(predicate.columnName.toLowerCase())
    );

    const validOrders = orders.filter((column) =>
        knownColumns.has(column.columnName.toLowerCase())
    );

    const equalityColumns = unique(
        validPredicates
            .filter((predicate) =>
                getPredicateType(predicate.operator) === 'equality'
            )
            .map((predicate) => predicate.columnName)
    );

    const rangeColumns = unique(
        validPredicates
            .filter((predicate) =>
                getPredicateType(predicate.operator) === 'range'
            )
            .map((predicate) => predicate.columnName)
    );

    const orderByColumns = unique(
        validOrders.map((column) => column.columnName)
    );
    const validJoins = joins.filter((column) =>
        knownColumns.has(column.columnName.toLowerCase())
    );
    const candidateColumns = unique([
        ...equalityColumns,
        ...validJoins.map((column) => column.columnName),
        ...rangeColumns,
        ...orderByColumns,
    ]);

    const indexes = table.metadata?.indexes ?? [];
    const recommendations = [];

    if (
        candidateColumns.length > 0 &&
        !hasExistingIndex(indexes, candidateColumns)
    ) {
        const indexName = `idx_adb_${reference.tableName}_${candidateColumns.join('_')}`
            .slice(0, 60);

        recommendations.push({
            type: 'composite_index_candidate',
            severity: 'info',
            tableName: reference.tableName,
            columns: candidateColumns,
            reason:
                'These columns appear in query predicates or ordering and may benefit from a composite index.',
            existingIndexFound: false,
            suggestedSql:
                `CREATE INDEX ${escapeIdentifier(indexName)} ON ${escapeIdentifier(reference.tableName)} (${candidateColumns.map(escapeIdentifier).join(', ')});`,
            advisoryOnly: true,
        });
    }

    return {
        tableName: reference.tableName,
        schemaName: table.schema_name,
        alias: reference.alias,
        schemaFound: true,

        columnsReferenced: unique([
            ...validPredicates.map((item) => item.columnName),
            ...validOrders.map((item) => item.columnName),
            ...validJoins.map((item) => item.columnName),
        ]),

        predicates: validPredicates.map((predicate) => ({
            columnName: predicate.columnName,
            operator: predicate.operator,
            value: predicate.value,
            valueKnown: predicate.valueKnown === true,
            type: getPredicateType(predicate.operator),
        })),


        joins: validJoins.map((column) => ({
            columnName: column.columnName,
            type: 'join',
        })),

        ordering: validOrders,
        existingIndexCount: indexes.length,
        recommendations,
    };
}

/**
 * Analyze SQL structure against discovered MySQL schema metadata.
 * This is a heuristic analyzer, not a complete SQL parser.
 */
export function analyzeAdvancedQuery(sql, schemaMetadata) {
    if (typeof sql !== 'string' || !sql.trim()) {
        throw new TypeError('A valid SQL query is required.');
    }

    if (!Array.isArray(schemaMetadata)) {
        throw new TypeError('Schema metadata must be an array.');
    }

    const normalizedSql = normalizeSql(sql);
    const references = parseTableReferences(sql);
    const predicates = extractPredicates(sql);
    const joinColumns = extractJoinColumns(sql);
    const orderColumns = extractOrderByColumns(sql);

    const findings = [];
    const recommendations = [];

    const hasSelectStar = /\bSELECT\s+(?:[a-zA-Z_]\w*\s*\.\s*)?\*/i.test(sql);

    const hasLeadingWildcardLike =
        /\bLIKE\s*(['"])\s*%/i.test(sql);

    const hasOrConditions = /\bOR\b/i.test(sql);

    const hasFunctionsOnPredicates =
        /\b(?:LOWER|UPPER|DATE|YEAR|MONTH|CAST|COALESCE|IFNULL)\s*\(/i.test(sql);

    const joinCount = (
        sql.match(/\bJOIN\b/gi) ?? []
    ).length;

    if (hasSelectStar) {
        findings.push({
            type: 'select_star',
            severity: 'info',
            message: 'The query uses SELECT *.',
            recommendation:
                'Select only the columns required by the application to reduce unnecessary data retrieval and network transfer.',
        });
    }

    if (hasLeadingWildcardLike) {
        findings.push({
            type: 'leading_wildcard_like',
            severity: 'warning',
            message: 'A LIKE pattern begins with a wildcard.',
            recommendation:
                'A conventional B-tree index generally cannot efficiently seek into a leading-wildcard pattern. Consider full-text search or a different search strategy.',
        });
    }

    if (hasOrConditions) {
        findings.push({
            type: 'or_predicate',
            severity: 'info',
            message: 'The query contains OR predicates.',
            recommendation:
                'Review the execution plan to determine whether the optimizer can use indexes for each branch. Separate queries or UNION may help in some cases, but are not universally faster.',
        });
    }

    if (hasFunctionsOnPredicates) {
        findings.push({
            type: 'function_in_expression',
            severity: 'info',
            message: 'The query contains functions that may be applied to columns.',
            recommendation:
                'If a function wraps an indexed predicate column, consider a sargable range predicate or a suitable functional index.',
        });
    }

    if (joinCount > 0) {
        findings.push({
            type: 'join_analysis',
            severity: 'info',
            message: `The query contains ${joinCount} JOIN operation(s).`,
            recommendation:
                'Verify that join columns have compatible data types and suitable indexes on the relevant tables.',
        });
    }

    const tableAnalyses = references.map((reference) =>
        buildTableAnalysis(
            reference,
            schemaMetadata,
            predicates,
            orderColumns,
            joinColumns
        )
    );

    for (const table of tableAnalyses) {
        recommendations.push(...table.recommendations);
    }

    const unknownTables = tableAnalyses
        .filter((table) => !table.schemaFound)
        .map((table) => table.tableName);

    if (unknownTables.length > 0) {
        findings.push({
            type: 'schema_metadata_missing',
            severity: 'info',
            message: 'Some query tables were not found in discovered schema metadata.',
            recommendation:
                'Refresh schema discovery and verify table names and aliases.',
            evidence: {
                tables: unknownTables,
            },
        });
    }

    return {
        queryFingerprint: normalizedSql,
        queryComplexity: {
            tableCount: references.length,
            joinCount,
            joinColumnCount: joinColumns.length,
            predicateCount: predicates.length,
            orderByColumnCount: orderColumns.length,
            usesSelectStar: hasSelectStar,
            hasOrConditions,
            hasLeadingWildcardLike,
            hasFunctionsOnPredicates,
        },
        tables: tableAnalyses,
        findingCount: findings.length,
        findings,
        recommendationCount: recommendations.length,
        recommendations,
        limitations: [
            'SQL structure analysis is heuristic and does not implement the full MySQL grammar.',
            'Column and alias resolution may be incomplete for nested queries, CTEs, and complex expressions.',
            'Index recommendations are candidates, not guaranteed improvements.',
            'Composite index order must be verified against actual query workload and execution plans.',
            'No DDL is executed by this analyzer.',
        ],
    };
}

