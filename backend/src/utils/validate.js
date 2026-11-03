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