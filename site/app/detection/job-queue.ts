type QueuedJob<T> = {
  id: number;
  payload: T;
  cancelled: boolean;
};

type JobErrorHandler<T> = (
  error: unknown,
  payload: T,
  isCancelled: () => boolean,
) => void;

export type LatestJobRunner<T> = {
  enqueue: (id: number, payload: T) => void;
  cancel: (id: number) => void;
};

/**
 * Runs at most one job at a time and keeps only the newest queued job.
 *
 * A processor must check isCancelled() at its async boundaries. This keeps a
 * long-running job from publishing stale progress while still allowing the
 * next job to start only after the current processor has fully unwound.
 */
export function createLatestJobRunner<T>(
  processor: (payload: T, isCancelled: () => boolean) => Promise<void>,
  onError?: JobErrorHandler<T>,
): LatestJobRunner<T> {
  let active: QueuedJob<T> | null = null;
  let pending: QueuedJob<T> | null = null;
  let draining = false;

  const drain = async () => {
    if (draining) return;
    draining = true;
    try {
      while (pending) {
        const job = pending;
        pending = null;
        active = job;
        try {
          await processor(job.payload, () => job.cancelled);
        } catch (error) {
          onError?.(error, job.payload, () => job.cancelled);
        } finally {
          if (active === job) active = null;
        }
      }
    } finally {
      draining = false;
      if (pending) void drain();
    }
  };

  return {
    enqueue(id, payload) {
      if (active) active.cancelled = true;
      if (pending) pending.cancelled = true;
      pending = { id, payload, cancelled: false };
      void drain();
    },
    cancel(id) {
      if (active?.id === id) active.cancelled = true;
      if (pending?.id === id) pending = null;
    },
  };
}
