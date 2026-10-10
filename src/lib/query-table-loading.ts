/** Match factory dashboards: skeleton only until the first payload for this query key. */
export function queryShowsTableLoading(query: {
  isPending: boolean;
  isFetching: boolean;
  data: unknown;
}): boolean {
  return query.isPending || (query.isFetching && query.data === undefined);
}
