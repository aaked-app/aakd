/**
 * Next.js 16 supplies dynamic route parameters asynchronously. Direct route
 * tests invoke the exported handlers with resolved values, so handlers accept
 * either representation while always awaiting the value before use.
 */
type AsyncRouteParams<T> = Promise<T> | T
