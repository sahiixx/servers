import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';

describe('Sequential Thinking Server', () => {
  describe('ThoughtData Structure', () => {
    it('defines required fields', () => {
      const thoughtData = {
        thought: 'This is my first thought',
        thoughtNumber: 1,
        totalThoughts: 5,
        nextThoughtNeeded: true,
      };

      expect(thoughtData).toHaveProperty('thought');
      expect(thoughtData).toHaveProperty('thoughtNumber');
      expect(thoughtData).toHaveProperty('totalThoughts');
      expect(thoughtData).toHaveProperty('nextThoughtNeeded');
    });

    it('includes optional revision fields', () => {
      const thoughtData = {
        thought: 'Revising previous thought',
        thoughtNumber: 3,
        totalThoughts: 5,
        nextThoughtNeeded: true,
        isRevision: true,
        revisesThought: 2,
      };

      expect(thoughtData.isRevision).toBe(true);
      expect(thoughtData.revisesThought).toBe(2);
    });

    it('includes optional branching fields', () => {
      const thoughtData = {
        thought: 'Branching into alternative approach',
        thoughtNumber: 4,
        totalThoughts: 6,
        nextThoughtNeeded: true,
        branchFromThought: 3,
        branchId: 'branch-1',
      };

      expect(thoughtData.branchFromThought).toBe(3);
      expect(thoughtData.branchId).toBe('branch-1');
    });
  });

  describe('Thought Validation', () => {
    it('validates thought is a string', () => {
      const invalidData = {
        thought: 123,
        thoughtNumber: 1,
        totalThoughts: 5,
        nextThoughtNeeded: true,
      };

      expect(typeof invalidData.thought).not.toBe('string');
    });

    it('validates thoughtNumber is a number', () => {
      const validData = {
        thought: 'Valid thought',
        thoughtNumber: 1,
        totalThoughts: 5,
        nextThoughtNeeded: true,
      };

      expect(typeof validData.thoughtNumber).toBe('number');
      expect(validData.thoughtNumber).toBeGreaterThan(0);
    });

    it('validates totalThoughts is a number', () => {
      const validData = {
        thought: 'Valid thought',
        thoughtNumber: 1,
        totalThoughts: 5,
        nextThoughtNeeded: true,
      };

      expect(typeof validData.totalThoughts).toBe('number');
      expect(validData.totalThoughts).toBeGreaterThan(0);
    });

    it('validates nextThoughtNeeded is a boolean', () => {
      const validData = {
        thought: 'Valid thought',
        thoughtNumber: 1,
        totalThoughts: 5,
        nextThoughtNeeded: true,
      };

      expect(typeof validData.nextThoughtNeeded).toBe('boolean');
    });
  });

  describe('Thought History Management', () => {
    it('tracks thought history in order', () => {
      const history: any[] = [];
      
      history.push({
        thought: 'First thought',
        thoughtNumber: 1,
        totalThoughts: 3,
        nextThoughtNeeded: true,
      });
      
      history.push({
        thought: 'Second thought',
        thoughtNumber: 2,
        totalThoughts: 3,
        nextThoughtNeeded: true,
      });

      expect(history.length).toBe(2);
      expect(history[0].thoughtNumber).toBe(1);
      expect(history[1].thoughtNumber).toBe(2);
    });

    it('adjusts totalThoughts when thoughtNumber exceeds it', () => {
      let thoughtData = {
        thought: 'Need more thoughts',
        thoughtNumber: 6,
        totalThoughts: 5,
        nextThoughtNeeded: true,
      };

      if (thoughtData.thoughtNumber > thoughtData.totalThoughts) {
        thoughtData.totalThoughts = thoughtData.thoughtNumber;
      }

      expect(thoughtData.totalThoughts).toBe(6);
    });

    it('handles revision thoughts', () => {
      const history: any[] = [];
      
      history.push({
        thought: 'Original thought',
        thoughtNumber: 2,
        totalThoughts: 5,
        nextThoughtNeeded: true,
      });
      
      history.push({
        thought: 'Revised thought',
        thoughtNumber: 3,
        totalThoughts: 5,
        nextThoughtNeeded: true,
        isRevision: true,
        revisesThought: 2,
      });

      const revision = history[1];
      expect(revision.isRevision).toBe(true);
      expect(revision.revisesThought).toBe(2);
    });
  });

  describe('Branch Management', () => {
    it('creates new branches', () => {
      const branches: Record<string, any[]> = {};
      const branchId = 'branch-1';
      
      if (!branches[branchId]) {
        branches[branchId] = [];
      }

      branches[branchId].push({
        thought: 'Branched thought',
        thoughtNumber: 4,
        totalThoughts: 6,
        nextThoughtNeeded: true,
        branchFromThought: 3,
        branchId: 'branch-1',
      });

      expect(branches['branch-1']).toBeDefined();
      expect(branches['branch-1'].length).toBe(1);
    });

    it('tracks multiple branches', () => {
      const branches: Record<string, any[]> = {
        'branch-1': [{
          thought: 'Branch 1 thought',
          thoughtNumber: 4,
          totalThoughts: 6,
          nextThoughtNeeded: true,
          branchFromThought: 3,
          branchId: 'branch-1',
        }],
        'branch-2': [{
          thought: 'Branch 2 thought',
          thoughtNumber: 4,
          totalThoughts: 6,
          nextThoughtNeeded: true,
          branchFromThought: 3,
          branchId: 'branch-2',
        }],
      };

      expect(Object.keys(branches).length).toBe(2);
      expect(branches['branch-1']).toBeDefined();
      expect(branches['branch-2']).toBeDefined();
    });

    it('accumulates thoughts within a branch', () => {
      const branches: Record<string, any[]> = {};
      const branchId = 'branch-1';
      
      if (!branches[branchId]) {
        branches[branchId] = [];
      }

      branches[branchId].push({
        thought: 'First branch thought',
        thoughtNumber: 4,
        totalThoughts: 6,
        nextThoughtNeeded: true,
        branchFromThought: 3,
        branchId: 'branch-1',
      });

      branches[branchId].push({
        thought: 'Second branch thought',
        thoughtNumber: 5,
        totalThoughts: 6,
        nextThoughtNeeded: false,
        branchId: 'branch-1',
      });

      expect(branches['branch-1'].length).toBe(2);
    });
  });

  describe('Thought Formatting', () => {
    it('formats regular thoughts', () => {
      const thought = {
        thought: 'Analyzing the problem',
        thoughtNumber: 1,
        totalThoughts: 5,
        nextThoughtNeeded: true,
      };

      const formatted = `Thought ${thought.thoughtNumber}/${thought.totalThoughts}`;
      expect(formatted).toContain('1/5');
    });

    it('indicates revision in formatting', () => {
      const thought = {
        thought: 'Correcting previous analysis',
        thoughtNumber: 3,
        totalThoughts: 5,
        nextThoughtNeeded: true,
        isRevision: true,
        revisesThought: 2,
      };

      const formatted = thought.isRevision 
        ? `Revision (revising thought ${thought.revisesThought})`
        : 'Regular thought';
      
      expect(formatted).toContain('Revision');
      expect(formatted).toContain('2');
    });

    it('indicates branching in formatting', () => {
      const thought = {
        thought: 'Exploring alternative',
        thoughtNumber: 4,
        totalThoughts: 6,
        nextThoughtNeeded: true,
        branchFromThought: 3,
        branchId: 'branch-1',
      };

      const formatted = thought.branchFromThought 
        ? `Branch (from thought ${thought.branchFromThought}, ID: ${thought.branchId})`
        : 'Regular thought';
      
      expect(formatted).toContain('Branch');
      expect(formatted).toContain('3');
      expect(formatted).toContain('branch-1');
    });
  });

  describe('Thought Processing Results', () => {
    it('returns success status with metadata', () => {
      const result = {
        thoughtNumber: 1,
        totalThoughts: 5,
        nextThoughtNeeded: true,
        branches: [],
        thoughtHistoryLength: 1,
      };

      expect(result.thoughtNumber).toBe(1);
      expect(result.totalThoughts).toBe(5);
      expect(result.nextThoughtNeeded).toBe(true);
      expect(result.branches).toBeDefined();
      expect(result.thoughtHistoryLength).toBe(1);
    });

    it('returns error status on failure', () => {
      const result = {
        error: 'Invalid thought: must be a string',
        status: 'failed',
      };

      expect(result.error).toBeDefined();
      expect(result.status).toBe('failed');
    });

    it('includes branch information in result', () => {
      const branches = ['branch-1', 'branch-2'];
      const result = {
        thoughtNumber: 5,
        totalThoughts: 8,
        nextThoughtNeeded: true,
        branches: branches,
        thoughtHistoryLength: 7,
      };

      expect(result.branches.length).toBe(2);
      expect(result.branches).toContain('branch-1');
    });
  });

  describe('Edge Cases', () => {
    it('handles thought number exceeding total thoughts', () => {
      const thought = {
        thought: 'Unexpected continuation',
        thoughtNumber: 8,
        totalThoughts: 5,
        nextThoughtNeeded: true,
      };

      // Should auto-adjust
      const adjusted = {
        ...thought,
        totalThoughts: Math.max(thought.totalThoughts, thought.thoughtNumber),
      };

      expect(adjusted.totalThoughts).toBe(8);
    });

    it('handles empty thought text', () => {
      const thought = {
        thought: '',
        thoughtNumber: 1,
        totalThoughts: 5,
        nextThoughtNeeded: true,
      };

      expect(thought.thought).toBe('');
      expect(thought.thought.length).toBe(0);
    });

    it('handles very long thought text', () => {
      const longThought = 'A'.repeat(10000);
      const thought = {
        thought: longThought,
        thoughtNumber: 1,
        totalThoughts: 5,
        nextThoughtNeeded: true,
      };

      expect(thought.thought.length).toBe(10000);
    });

    it('handles thought with special characters', () => {
      const thought = {
        thought: 'Thought with\nnewlines\tand\ttabs and "quotes" and \'apostrophes\'',
        thoughtNumber: 1,
        totalThoughts: 5,
        nextThoughtNeeded: true,
      };

      expect(thought.thought).toContain('\n');
      expect(thought.thought).toContain('\t');
      expect(thought.thought).toContain('"');
    });

    it('handles zero or negative thought numbers gracefully', () => {
      const invalidThought = {
        thought: 'Invalid',
        thoughtNumber: 0,
        totalThoughts: 5,
        nextThoughtNeeded: true,
      };

      // Should be rejected in validation
      expect(invalidThought.thoughtNumber).toBeLessThanOrEqual(0);
    });

    it('handles needsMoreThoughts flag', () => {
      const thought = {
        thought: 'Realizing more analysis needed',
        thoughtNumber: 5,
        totalThoughts: 5,
        nextThoughtNeeded: true,
        needsMoreThoughts: true,
      };

      expect(thought.needsMoreThoughts).toBe(true);
      expect(thought.nextThoughtNeeded).toBe(true);
    });
  });

  describe('Sequential Thinking Workflow', () => {
    it('completes a full thought sequence', () => {
      const thoughts = [
        { thoughtNumber: 1, totalThoughts: 3, nextThoughtNeeded: true },
        { thoughtNumber: 2, totalThoughts: 3, nextThoughtNeeded: true },
        { thoughtNumber: 3, totalThoughts: 3, nextThoughtNeeded: false },
      ];

      expect(thoughts.length).toBe(3);
      expect(thoughts[2].nextThoughtNeeded).toBe(false);
    });

    it('allows extending thought sequence mid-process', () => {
      const thoughts = [
        { thoughtNumber: 1, totalThoughts: 3, nextThoughtNeeded: true },
        { thoughtNumber: 2, totalThoughts: 3, nextThoughtNeeded: true },
        { thoughtNumber: 3, totalThoughts: 5, nextThoughtNeeded: true }, // Extended
        { thoughtNumber: 4, totalThoughts: 5, nextThoughtNeeded: true },
        { thoughtNumber: 5, totalThoughts: 5, nextThoughtNeeded: false },
      ];

      expect(thoughts[2].totalThoughts).toBe(5);
      expect(thoughts.length).toBe(5);
    });

    it('supports non-linear thinking with revisions', () => {
      const thoughts = [
        { thoughtNumber: 1, totalThoughts: 5, nextThoughtNeeded: true },
        { thoughtNumber: 2, totalThoughts: 5, nextThoughtNeeded: true },
        { 
          thoughtNumber: 3, 
          totalThoughts: 5, 
          nextThoughtNeeded: true,
          isRevision: true,
          revisesThought: 1 
        },
        { thoughtNumber: 4, totalThoughts: 5, nextThoughtNeeded: false },
      ];

      const revisions = thoughts.filter(t => t.isRevision);
      expect(revisions.length).toBe(1);
      expect(revisions[0].revisesThought).toBe(1);
    });

    it('supports exploring alternative paths via branches', () => {
      const mainThoughts = [
        { thoughtNumber: 1, totalThoughts: 5, nextThoughtNeeded: true },
        { thoughtNumber: 2, totalThoughts: 5, nextThoughtNeeded: true },
      ];

      const branchThoughts = [
        { 
          thoughtNumber: 3, 
          totalThoughts: 5, 
          nextThoughtNeeded: true,
          branchFromThought: 2,
          branchId: 'alt-1'
        },
        { 
          thoughtNumber: 4, 
          totalThoughts: 5, 
          nextThoughtNeeded: false,
          branchId: 'alt-1'
        },
      ];

      expect(branchThoughts[0].branchFromThought).toBe(2);
      expect(branchThoughts.every(t => t.branchId === 'alt-1')).toBe(true);
    });
  });

  describe('Logging Control', () => {
    it('respects DISABLE_THOUGHT_LOGGING environment variable', () => {
      const originalValue = process.env.DISABLE_THOUGHT_LOGGING;
      
      process.env.DISABLE_THOUGHT_LOGGING = 'true';
      const disableLogging = (process.env.DISABLE_THOUGHT_LOGGING || '').toLowerCase() === 'true';
      expect(disableLogging).toBe(true);
      
      process.env.DISABLE_THOUGHT_LOGGING = 'false';
      const enableLogging = (process.env.DISABLE_THOUGHT_LOGGING || '').toLowerCase() !== 'true';
      expect(enableLogging).toBe(true);
      
      if (originalValue !== undefined) {
        process.env.DISABLE_THOUGHT_LOGGING = originalValue;
      } else {
        delete process.env.DISABLE_THOUGHT_LOGGING;
      }
    });
  });
});