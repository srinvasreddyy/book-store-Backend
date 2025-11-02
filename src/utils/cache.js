import NodeCache from "node-cache";

const cache = new NodeCache({ stdTTL: 100, checkperiod: 120 });

/**
 * Deletes all keys from the cache that start with the given prefix.
 * @param {string} prefix - The prefix to match against cache keys.
 */
cache.delByPrefix = (prefix) => {
  if (!prefix) return;
  
  const keys = cache.keys();
  const keysToDelete = keys.filter(k => k.startsWith(prefix));
  
  if (keysToDelete.length > 0) {
    cache.del(keysToDelete);
  }
};

export default cache;