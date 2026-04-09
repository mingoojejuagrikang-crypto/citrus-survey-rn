export function resolveUndoValue(
  previousNumericValue: number | null,
  previousTextValue: string | null
) {
  if (previousNumericValue === null && previousTextValue === null) {
    return {
      deleteCurrent: true,
      numericValue: null,
      textValue: null,
    };
  }

  return {
    deleteCurrent: false,
    numericValue: previousNumericValue,
    textValue: previousTextValue,
  };
}
