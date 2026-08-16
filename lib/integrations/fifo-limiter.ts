type PendingTask = {
  task: () => Promise<unknown>;
  resolve: (value: unknown) => void;
  reject: (reason?: unknown) => void;
};

export function createFifoLimiter(maxConcurrent: number) {
  if (!Number.isInteger(maxConcurrent) || maxConcurrent < 1) {
    throw new TypeError("A concorrência deve ser um inteiro positivo.");
  }

  let activeCount = 0;
  const pendingTasks: PendingTask[] = [];

  function drain() {
    while (activeCount < maxConcurrent && pendingTasks.length > 0) {
      const pendingTask = pendingTasks.shift()!;
      activeCount += 1;

      void pendingTask
        .task()
        .then(pendingTask.resolve, pendingTask.reject)
        .finally(() => {
          activeCount -= 1;
          drain();
        });
    }
  }

  return function run<T>(task: () => Promise<T>) {
    return new Promise<T>((resolve, reject) => {
      pendingTasks.push({
        task: async () => task(),
        resolve: (value) => resolve(value as T),
        reject,
      });
      drain();
    });
  };
}
