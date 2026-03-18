export interface Step {
  name: string;
  durationMs: number;
  failed: boolean;
}

export interface Tracker {
  step<T>(name: string, fn: () => T): Promise<Awaited<T>>;
  getSteps(): ReadonlyArray<Step>;
}

export function createTracker(): Tracker {
  const steps: Step[] = [];

  return {
    async step<T>(name: string, fn: () => T): Promise<Awaited<T>> {
      const start = performance.now();
      try {
        const result = await fn();
        steps.push({
          name,
          durationMs: Math.round(performance.now() - start),
          failed: false,
        });
        return result as Awaited<T>;
      } catch (error) {
        steps.push({
          name,
          durationMs: Math.round(performance.now() - start),
          failed: true,
        });
        throw error;
      }
    },
    getSteps() {
      return steps;
    },
  };
}
