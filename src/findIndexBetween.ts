
export function findIndexBetween<T>(arr: T[], startIndex: number, end: number, predicate: (el: T) => boolean): number {
  for (let i = startIndex; i < end; i++) {
    if (predicate(arr[i]))
      return i;
  }
  return -1;
}
