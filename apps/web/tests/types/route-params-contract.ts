export type RouteParamsMustBePromise = Assert<
  IsAssignable<AsyncRouteParams<{ id: string }>, Promise<{ id: string }>>
>

export type PlainRouteParamsMustBeRejected = Assert<
  IsAssignable<{ id: string }, AsyncRouteParams<{ id: string }>> extends false
    ? true
    : false
>

type Assert<T extends true> = T
type IsAssignable<From, To> = [From] extends [To] ? true : false
