/** True when another direct DataSet child already uses this exact name. */
export function dataSetNameTaken(
  parent: Element | null | undefined,
  name: string,
  own?: Element | null,
): boolean {
  if (!parent || name === '') return false;
  return Array.from(parent.children).some(
    (child) =>
      child.tagName === 'DataSet' &&
      child !== own &&
      child.getAttribute('name') === name,
  );
}
