const MAX_QUERY_LENGTH = 20_000;

const FORBIDDEN_KEYWORDS = new Set([
  'INSERT',
  'UPDATE',
  'DELETE',
  'REPLACE',
  'CREATE',
  'ALTER',
  'DROP',
  'TRUNCATE',
  'GRANT',
  'REVOKE',
  'CALL',
  'DO',
  'LOAD',
  'OUTFILE',
  'DUMPFILE',
  'LOCK',
  'UNLOCK',
  'HANDLER',
  'SET',
  'USE',
  'SHOW',
  'DESCRIBE',
  'EXPLAIN',
  'ANALYZE',
  'INTO',
  'SLEEP',
  'BENCHMARK',
  'GET_LOCK',
  'RELEASE_LOCK',
  'RELEASE_ALL_LOCKS',
  'LOAD_FILE',
]);

function maskQuotedContent(sql) {
  let output = '';
  let quote = null;

  for (let i = 0; i < sql.length; i++) {
    const char = sql[i];

    if (quote) {
      if (char === '\\') {
        output += '  ';
        i++;
        continue;
      }

      if (char === quote) {
        if (sql[i + 1] === quote) {
          output += '  ';
          i++;
          continue;
        }

        quote = null;
      }

      output += ' ';
      continue;
    }

    if (char === "'" || char === '"' || char === '`') {
      quote = char;
      output += ' ';
      continue;
    }

    if (
      (char === '-' && sql[i + 1] === '-') ||
      char === '#' ||
      (char === '/' && sql[i + 1] === '*')
    ) {
      throw new Error('SQL comments are not supported.');
    }

    if (char === ';') {
      throw new Error('Only one SQL statement is allowed.');
    }

    output += char;
  }

  if (quote) {
    throw new Error(
      'SQL contains an unterminated quoted value.'
    );
  }

  return output;
}

export function validateQueryPerformanceRequest(req) {
  const errors = [];
  const body = req.body;

  if (
    !body ||
    typeof body !== 'object' ||
    Array.isArray(body)
  ) {
    return ['Request body must be a JSON object.'];
  }

  if (
    typeof body.sql !== 'string' ||
    !body.sql.trim()
  ) {
    return [
      'sql is required and must be a non-empty string.',
    ];
  }

  const sql = body.sql.trim();

  if (sql.length > MAX_QUERY_LENGTH) {
    errors.push(
      `SQL must not exceed ${MAX_QUERY_LENGTH} characters.`
    );

    return errors;
  }

  let maskedSql;

  try {
    maskedSql = maskQuotedContent(sql);
  } catch (error) {
    return [error.message];
  }

  const firstKeyword = maskedSql.trim()
    .match(/^[A-Za-z]+/)?.[0]
    ?.toUpperCase();

  if (
    firstKeyword !== 'SELECT' &&
    firstKeyword !== 'WITH'
  ) {
    errors.push(
      'Only SELECT and WITH ... SELECT queries are allowed.'
    );

    return errors;
  }

  const keywords =
    maskedSql.match(/[A-Za-z_][A-Za-z0-9_]*/g) ?? [];

  for (const keyword of keywords) {
    if (FORBIDDEN_KEYWORDS.has(keyword.toUpperCase())) {
      errors.push(
        `The SQL keyword or function "${keyword}" is not allowed.`
      );
    }
  }

  if (/\bFOR\s+(SHARE|UPDATE)\b/i.test(maskedSql)) {
    errors.push('Locking reads are not allowed.');
  }

  return errors;
}