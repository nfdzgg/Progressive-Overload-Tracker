const exercises = (n: number) => `${n} ${n === 1 ? 'exercise' : 'exercises'}`;

/** Result line after a routine import: how many exercises matched and were created. */
export function routineImportSummary(matched: number, created: number): string {
  if (matched === 0 && created === 0) return 'Routine imported: no exercises.';
  if (matched === 0) return `Routine imported: ${exercises(created)} created.`;
  const matchedText = `${exercises(matched)} matched by name (history kept)`;
  return created === 0
    ? `Routine imported: ${matchedText}.`
    : `Routine imported: ${matchedText}, ${created} created.`;
}
