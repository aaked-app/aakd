/**
 * Next.js 16 supplies dynamic route parameters asynchronously. Direct route
 * tests invoke exported handlers with the same Promise-wrapped shape so their
 * route contracts remain compatible with Next's generated validators.
 */
type AsyncRouteParams<T> = Promise<T>
