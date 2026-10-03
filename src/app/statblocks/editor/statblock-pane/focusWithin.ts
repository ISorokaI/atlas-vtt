/**
 * Whether focus moving to `target` stays inside `container`, or in a menu one
 * of its controls opened (a portal elsewhere in the document). Read without
 * `instanceof`: a node of a popout window is none of this window's classes.
 */
export function focusStaysIn(container: Element | null, target: EventTarget | null): boolean {
  const node = target as Partial<Element> | null;
  if (!container || typeof node?.closest !== 'function') return false;
  return container.contains(node as Element) || node.closest('[role="menu"]') !== null;
}
