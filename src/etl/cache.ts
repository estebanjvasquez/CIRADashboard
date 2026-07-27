export function defaultCache(): Cache {
  return (caches as CacheStorage & { default: Cache }).default;
}
