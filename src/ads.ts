// When the game offers Poki a commercial break. Every ad rule lives here; the caller supplies the
// function that shows the break, so the rules can be tested without a browser.
//
//  - Memories before `firstMemory` never request a break.
//  - From `firstMemory` on, a break is requested after completing a memory (never after the last
//    one), or before the puzzle resets on every `restartsPerBreak`-th manual restart. Restarts are
//    counted across memories, and the count resets after every break request.
//  - Only one request can be in flight at a time.
//
// There is deliberately no timer or cooldown: Poki's requirements forbid internal ad timers, and
// Poki's own system decides whether each requested break actually shows an ad.

export type AdPolicyOptions = {
  firstMemory: number;
  lastMemory: number;
  restartsPerBreak: number;
  showBreak: () => Promise<void>;
};

export function createAdPolicy(options: AdPolicyOptions) {
  let restarts = 0;
  let requesting = false;

  async function request(): Promise<boolean> {
    requesting = true;
    try {
      await options.showBreak();
    } catch {
      // No ad available, an ad blocker, or no SDK: carry on as if the break finished.
    } finally {
      restarts = 0;
      requesting = false;
    }
    return true;
  }

  return {
    /** After a completed memory's celebration, before the next memory loads. Resolves true if a break was requested. */
    async afterMemory(memory: number): Promise<boolean> {
      if (requesting || memory < options.firstMemory || memory >= options.lastMemory) return false;
      return request();
    },

    /** When the player presses Restart, before the puzzle resets. Resolves true if a break was requested. */
    async beforeRestart(memory: number): Promise<boolean> {
      if (requesting || memory < options.firstMemory) return false;
      restarts++;
      return restarts >= options.restartsPerBreak ? request() : false;
    },

    /** For tests: the restart count and whether a request is in flight. */
    snapshot(): { restarts: number; requesting: boolean } {
      return { restarts, requesting };
    },
  };
}
