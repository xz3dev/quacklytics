import {
  createStore as tanstackStore,
  useSelector,
} from "@tanstack/react-store";
type Update<T> = Partial<T> | ((previous: T) => Partial<T>);
export function create<T>(
  initialize: (set: (update: Update<T>) => void, get: () => T) => T,
) {
  const set = (update: Update<T>) =>
    store.setState((previous: T) => ({
      ...previous,
      ...(typeof update === "function" ? update(previous) : update),
    }));
  const get = (): T => store.get();
  const store = tanstackStore(initialize(set, get));
  function useBoundStore(): T;
  function useBoundStore<U>(select: (state: T) => U): U;
  function useBoundStore<U>(select?: (state: T) => U) {
    return useSelector(store, (state) => (select ? select(state) : state));
  }
  return Object.assign(useBoundStore, {
    getState: get,
    setState: set,
    subscribe: store.subscribe,
  });
}
export const createStore = create;
export type StoreApi<T> = ReturnType<typeof create<T>>;
