/** Verschiebt ein Element von fromIndex nach toIndex (neues Array, keine Mutation). */
export const moveArrayItem = <T,>(items: T[], fromIndex: number, toIndex: number): T[] => {
  if (
    fromIndex === toIndex ||
    fromIndex < 0 ||
    fromIndex >= items.length ||
    toIndex < 0 ||
    toIndex >= items.length
  ) {
    return items;
  }

  const next = [...items];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next;
};
