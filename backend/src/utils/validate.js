export function isNonEmptyString(value) {
  return (
    typeof value === 'string' &&
    value.trim().length > 0
  );
}

export function isValidPort(value) {
  const port = Number(value);

  return (
    Number.isInteger(port) &&
    port >= 1 &&
    port <= 65535
  );
}

export function isValidLength(value, min, max) {
  return (
    typeof value === 'string' &&
    value.length >= min &&
    value.length <= max
  );
}

export function isValidUuid(value) {
  return (
    typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
  );
}