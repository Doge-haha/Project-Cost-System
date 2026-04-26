export function buildAbsoluteAppUrl(path: string) {
  if (typeof window === "undefined" || !window.location) {
    return path;
  }

  return new URL(path, window.location.origin).toString();
}
