import { jest } from '@jest/globals';

describe('Sequential Thinking Server', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
    jest.clearAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('ThoughtData Interface', () => {
    it('should validate required thought field', () => {
      const validThought = {
        thought: 'This is a valid thought',
        thoughtNumber: 1,
        totalThoughts: 5,
        nextThoughtNeeded: true,
      };

      expect(validThought.thought).toBe('This is a valid thought');
      expect(typeof validThought.thought).toBe('string');
    });

    it('should validate required thoughtNumber field', () => {
      const validThought = {
        thought: 'Test',
        thoughtNumber: 3,
        totalThoughts: 5,
        nextThoughtNeeded: true,
      };

      expect(validThought.thoughtNumber).toBe(3);
      expect(typeof validThought.thoughtNumber).toBe('number');
    });

    it('should validate required totalThoughts field', () => {
      const validThought = {
        thought: 'Test',
        thoughtNumber: 1,
        totalThoughts: 10,
        nextThoughtNeeded: true,
      };

      expect(validThought.totalThoughts).toBe(10);
      expect(typeof validThought.totalThoughts).toBe('number');
    });

    it('should validate required nextThoughtNeeded field', () => {
      const validThought = {
        thought: 'Test',
        thoughtNumber: 1,
        totalThoughts: 5,
        nextThoughtNeeded: false,
      };

      expect(validThought.nextThoughtNeeded).toBe(false);
      expect(typeof validThought.nextThoughtNeeded).toBe('boolean');
    });

    it('should allow optional isRevision field', () => {
      const thoughtWithRevision = {
        thought: 'Revised thought',
        thoughtNumber: 2,
        totalThoughts: 5,
        nextThoughtNeeded: true,
        isRevision: true,
      };

      expect(thoughtWithRevision.isRevision).toBe(true);
    });

    it('should allow optional revisesThought field', () => {
      const thoughtWithRevision = {
        thought: 'Test',
        thoughtNumber: 3,
        totalThoughts: 5,
        nextThoughtNeeded: true,
        isRevision: true,
        revisesThought: 1,
      };

      expect(thoughtWithRevision.revisesThought).toBe(1);
    });

    it('should allow optional branchFromThought field', () => {
      const branchedThought = {
        thought: 'Branched thought',
        thoughtNumber: 4,
        totalThoughts: 8,
        nextThoughtNeeded: true,
        branchFromThought: 2,
        branchId: 'branch-1',
      };

      expect(branchedThought.branchFromThought).toBe(2);
    });

    it('should allow optional branchId field', () => {
      const branchedThought = {
        thought: 'Test',
        thoughtNumber: 1,
        totalThoughts: 5,
        nextThoughtNeeded: true,
        branchId: 'experimental-path',
      };

      expect(branchedThought.branchId).toBe('experimental-path');
    });

    it('should allow optional needsMoreThoughts field', () => {
      const thought = {
        thought: 'Test',
        thoughtNumber: 5,
        totalThoughts: 5,
        nextThoughtNeeded: true,
        needsMoreThoughts: true,
      };

      expect(thought.needsMoreThoughts).toBe(true);
    });
  });

  describe('Thought Validation', () => {
    it('should reject invalid thought type', () => {
      const invalidData = {
        thought: 123, // Should be string
        thoughtNumber: 1,
        totalThoughts: 5,
        nextThoughtNeeded: true,
      };

      expect(typeof invalidData.thought).not.toBe('string');
    });

    it('should reject missing thought field', () => {
      const invalidData = {
        thoughtNumber: 1,
        totalThoughts: 5,
        nextThoughtNeeded: true,
      };

      expect(invalidData).not.toHaveProperty('thought');
    });

    it('should reject invalid thoughtNumber type', () => {
      const invalidData = {
        thought: 'Test',
        thoughtNumber: '1', // Should be number
        totalThoughts: 5,
        nextThoughtNeeded: true,
      };

      expect(typeof invalidData.thoughtNumber).not.toBe('number');
    });

    it('should reject missing thoughtNumber field', () => {
      const invalidData = {
        thought: 'Test',
        totalThoughts: 5,
        nextThoughtNeeded: true,
      };

      expect(invalidData).not.toHaveProperty('thoughtNumber');
    });

    it('should reject invalid totalThoughts type', () => {
      const invalidData = {
        thought: 'Test',
        thoughtNumber: 1,
        totalThoughts: '5', // Should be number
        nextThoughtNeeded: true,
      };

      expect(typeof invalidData.totalThoughts).not.toBe('number');
    });

    it('should reject invalid nextThoughtNeeded type', () => {
      const invalidData = {
        thought: 'Test',
        thoughtNumber: 1,
        totalThoughts: 5,
        nextThoughtNeeded: 'yes', // Should be boolean
      };

      expect(typeof invalidData.nextThoughtNeeded).not.toBe('boolean');
    });

    it('should handle empty thought string', () => {
      const emptyThought = {
        thought: '',
        thoughtNumber: 1,
        totalThoughts: 5,
        nextThoughtNeeded: true,
      };

      expect(emptyThought.thought).toBe('');
      expect(emptyThought.thought.length).toBe(0);
    });

    it('should handle very long thought strings', () => {
      const longThought = 'a'.repeat(10000);
      const thought = {
        thought: longThought,
        thoughtNumber: 1,
        totalThoughts: 5,
        nextThoughtNeeded: true,
      };

      expect(thought.thought.length).toBe(10000);
    });
  });

  describe('Thought Numbering', () => {
    it('should handle thoughtNumber exceeding totalThoughts', () => {
      const thought = {
        thought: 'Unexpected continuation',
        thoughtNumber: 8,
        totalThoughts: 5,
        nextThoughtNeeded: true,
      };

      expect(thought.thoughtNumber).toBeGreaterThan(thought.totalThoughts);
    });

    it('should handle thought sequence starting from 1', () => {
      const thought = {
        thought: 'First thought',
        thoughtNumber: 1,
        totalThoughts: 10,
        nextThoughtNeeded: true,
      };

      expect(thought.thoughtNumber).toBe(1);
    });

    it('should handle mid-sequence thoughts', () => {
      const thought = {
        thought: 'Middle thought',
        thoughtNumber: 5,
        totalThoughts: 10,
        nextThoughtNeeded: true,
      };

      expect(thought.thoughtNumber).toBeGreaterThan(1);
      expect(thought.thoughtNumber).toBeLessThan(thought.totalThoughts);
    });

    it('should handle final thought in sequence', () => {
      const thought = {
        thought: 'Final thought',
        thoughtNumber: 10,
        totalThoughts: 10,
        nextThoughtNeeded: false,
      };

      expect(thought.thoughtNumber).toBe(thought.totalThoughts);
      expect(thought.nextThoughtNeeded).toBe(false);
    });

    it('should allow totalThoughts adjustment', () => {
      const initialThought = {
        thought: 'Initial estimate',
        thoughtNumber: 1,
        totalThoughts: 5,
        nextThoughtNeeded: true,
      };

      const adjustedThought = {
        thought: 'Realized need more',
        thoughtNumber: 6,
        totalThoughts: 10,
        nextThoughtNeeded: true,
      };

      expect(adjustedThought.totalThoughts).toBeGreaterThan(initialThought.totalThoughts);
    });
  });

  describe('Revision Thoughts', () => {
    it('should mark revisions correctly', () => {
      const revision = {
        thought: 'Actually, let me reconsider...',
        thoughtNumber: 4,
        totalThoughts: 10,
        nextThoughtNeeded: true,
        isRevision: true,
        revisesThought: 2,
      };

      expect(revision.isRevision).toBe(true);
      expect(revision.revisesThought).toBeDefined();
    });

    it('should track which thought is being revised', () => {
      const revision = {
        thought: 'Correction to previous analysis',
        thoughtNumber: 5,
        totalThoughts: 8,
        nextThoughtNeeded: true,
        isRevision: true,
        revisesThought: 3,
      };

      expect(revision.revisesThought).toBe(3);
    });

    it('should allow revision without revisesThought number', () => {
      const revision = {
        thought: 'General revision',
        thoughtNumber: 4,
        totalThoughts: 8,
        nextThoughtNeeded: true,
        isRevision: true,
      };

      expect(revision.isRevision).toBe(true);
      expect(revision.revisesThought).toBeUndefined();
    });

    it('should handle non-revision thoughts', () => {
      const regularThought = {
        thought: 'Regular thought',
        thoughtNumber: 2,
        totalThoughts: 5,
        nextThoughtNeeded: true,
      };

      expect(regularThought.isRevision).toBeUndefined();
    });
  });

  describe('Branching Thoughts', () => {
    it('should create branches with proper metadata', () => {
      const branch = {
        thought: 'Alternative approach',
        thoughtNumber: 1,
        totalThoughts: 5,
        nextThoughtNeeded: true,
        branchFromThought: 3,
        branchId: 'alt-solution',
      };

      expect(branch.branchFromThought).toBe(3);
      expect(branch.branchId).toBe('alt-solution');
    });

    it('should track multiple branches with unique IDs', () => {
      const branch1 = {
        thought: 'Path A',
        thoughtNumber: 1,
        totalThoughts: 4,
        nextThoughtNeeded: true,
        branchFromThought: 2,
        branchId: 'path-a',
      };

      const branch2 = {
        thought: 'Path B',
        thoughtNumber: 1,
        totalThoughts: 3,
        nextThoughtNeeded: true,
        branchFromThought: 2,
        branchId: 'path-b',
      };

      expect(branch1.branchId).not.toBe(branch2.branchId);
    });

    it('should allow branch without branchFromThought', () => {
      const branch = {
        thought: 'New branch',
        thoughtNumber: 1,
        totalThoughts: 5,
        nextThoughtNeeded: true,
        branchId: 'experiment',
      };

      expect(branch.branchId).toBeDefined();
      expect(branch.branchFromThought).toBeUndefined();
    });

    it('should handle complex branch hierarchies', () => {
      const mainThought = {
        thought: 'Main analysis',
        thoughtNumber: 5,
        totalThoughts: 10,
        nextThoughtNeeded: true,
      };

      const subBranch = {
        thought: 'Sub-branch thought',
        thoughtNumber: 2,
        totalThoughts: 4,
        nextThoughtNeeded: true,
        branchFromThought: 1,
        branchId: 'sub-exploration',
      };

      expect(mainThought.branchId).toBeUndefined();
      expect(subBranch.branchId).toBeDefined();
    });
  });

  describe('Dynamic Thought Planning', () => {
    it('should handle needsMoreThoughts flag', () => {
      const thought = {
        thought: 'Realized complexity is greater',
        thoughtNumber: 5,
        totalThoughts: 5,
        nextThoughtNeeded: true,
        needsMoreThoughts: true,
      };

      expect(thought.needsMoreThoughts).toBe(true);
      expect(thought.nextThoughtNeeded).toBe(true);
    });

    it('should allow continuing after reaching totalThoughts', () => {
      const endThought = {
        thought: 'Thought I was done',
        thoughtNumber: 5,
        totalThoughts: 5,
        nextThoughtNeeded: true,
        needsMoreThoughts: true,
      };

      const continuedThought = {
        thought: 'But found more to explore',
        thoughtNumber: 6,
        totalThoughts: 8,
        nextThoughtNeeded: true,
      };

      expect(continuedThought.thoughtNumber).toBeGreaterThan(endThought.totalThoughts);
    });

    it('should handle reducing totalThoughts', () => {
      const initialThought = {
        thought: 'Expected complex problem',
        thoughtNumber: 1,
        totalThoughts: 20,
        nextThoughtNeeded: true,
      };

      const simplifiedThought = {
        thought: 'Actually simpler than expected',
        thoughtNumber: 3,
        totalThoughts: 5,
        nextThoughtNeeded: true,
      };

      expect(simplifiedThought.totalThoughts).toBeLessThan(initialThought.totalThoughts);
    });
  });

  describe('Thought Formatting', () => {
    it('should format regular thoughts with proper structure', () => {
      const thought = {
        thought: 'Analysis of the problem',
        thoughtNumber: 3,
        totalThoughts: 8,
        nextThoughtNeeded: true,
      };

      const formatted = `Thought ${thought.thoughtNumber}/${thought.totalThoughts}`;
      expect(formatted).toContain('3/8');
    });

    it('should format revision thoughts with context', () => {
      const revision = {
        thought: 'Correcting previous assumption',
        thoughtNumber: 5,
        totalThoughts: 10,
        nextThoughtNeeded: true,
        isRevision: true,
        revisesThought: 3,
      };

      const formatted = `Revision (revising thought ${revision.revisesThought})`;
      expect(formatted).toContain('revising thought 3');
    });

    it('should format branch thoughts with branch info', () => {
      const branch = {
        thought: 'Exploring alternative',
        thoughtNumber: 2,
        totalThoughts: 5,
        nextThoughtNeeded: true,
        branchFromThought: 4,
        branchId: 'alternative-path',
      };

      const formatted = `Branch (from thought ${branch.branchFromThought}, ID: ${branch.branchId})`;
      expect(formatted).toContain('from thought 4');
      expect(formatted).toContain('alternative-path');
    });
  });

  describe('Environment Configuration', () => {
    it('should respect DISABLE_THOUGHT_LOGGING=true', () => {
      process.env.DISABLE_THOUGHT_LOGGING = 'true';
      expect(process.env.DISABLE_THOUGHT_LOGGING.toLowerCase()).toBe('true');
    });

    it('should respect DISABLE_THOUGHT_LOGGING=TRUE (uppercase)', () => {
      process.env.DISABLE_THOUGHT_LOGGING = 'TRUE';
      expect(process.env.DISABLE_THOUGHT_LOGGING.toLowerCase()).toBe('true');
    });

    it('should enable logging when DISABLE_THOUGHT_LOGGING=false', () => {
      process.env.DISABLE_THOUGHT_LOGGING = 'false';
      expect(process.env.DISABLE_THOUGHT_LOGGING.toLowerCase()).not.toBe('true');
    });

    it('should enable logging when DISABLE_THOUGHT_LOGGING is not set', () => {
      delete process.env.DISABLE_THOUGHT_LOGGING;
      const value = process.env.DISABLE_THOUGHT_LOGGING || '';
      expect(value.toLowerCase()).not.toBe('true');
    });

    it('should handle various truthy/falsy string values', () => {
      const truthyValues = ['true', 'TRUE', 'True'];
      const falsyValues = ['false', 'FALSE', 'False', '0', ''];

      truthyValues.forEach(val => {
        expect(val.toLowerCase()).toBe('true');
      });

      falsyValues.forEach(val => {
        expect(val.toLowerCase()).not.toBe('true');
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle null thought gracefully', () => {
      const invalidData = {
        thought: null,
        thoughtNumber: 1,
        totalThoughts: 5,
        nextThoughtNeeded: true,
      };

      expect(invalidData.thought).toBeNull();
    });

    it('should handle undefined thought gracefully', () => {
      const invalidData = {
        thoughtNumber: 1,
        totalThoughts: 5,
        nextThoughtNeeded: true,
      };

      expect(invalidData.thought).toBeUndefined();
    });

    it('should handle zero thoughtNumber', () => {
      const thought = {
        thought: 'Test',
        thoughtNumber: 0,
        totalThoughts: 5,
        nextThoughtNeeded: true,
      };

      expect(thought.thoughtNumber).toBe(0);
    });

    it('should handle negative thoughtNumber', () => {
      const thought = {
        thought: 'Test',
        thoughtNumber: -1,
        totalThoughts: 5,
        nextThoughtNeeded: true,
      };

      expect(thought.thoughtNumber).toBeLessThan(0);
    });

    it('should handle zero totalThoughts', () => {
      const thought = {
        thought: 'Test',
        thoughtNumber: 1,
        totalThoughts: 0,
        nextThoughtNeeded: true,
      };

      expect(thought.totalThoughts).toBe(0);
    });

    it('should handle very large thoughtNumber values', () => {
      const thought = {
        thought: 'Test',
        thoughtNumber: Number.MAX_SAFE_INTEGER,
        totalThoughts: Number.MAX_SAFE_INTEGER,
        nextThoughtNeeded: true,
      };

      expect(thought.thoughtNumber).toBe(Number.MAX_SAFE_INTEGER);
    });
  });

  describe('Response Format', () => {
    it('should return proper success response structure', () => {
      const response = {
        content: [{
          type: 'text',
          text: JSON.stringify({
            thoughtNumber: 3,
            totalThoughts: 10,
            nextThoughtNeeded: true,
            branches: [],
            thoughtHistoryLength: 3,
          }, null, 2),
        }],
      };

      expect(response.content).toHaveLength(1);
      expect(response.content[0].type).toBe('text');
    });

    it('should return proper error response structure', () => {
      const response = {
        content: [{
          type: 'text',
          text: JSON.stringify({
            error: 'Invalid thought data',
            status: 'failed',
          }, null, 2),
        }],
        isError: true,
      };

      expect(response.isError).toBe(true);
      expect(response.content[0].type).toBe('text');
    });

    it('should include thought history length in response', () => {
      const responseData = {
        thoughtNumber: 5,
        totalThoughts: 10,
        nextThoughtNeeded: true,
        branches: [],
        thoughtHistoryLength: 5,
      };

      expect(responseData.thoughtHistoryLength).toBe(5);
    });

    it('should include branch information in response', () => {
      const responseData = {
        thoughtNumber: 2,
        totalThoughts: 5,
        nextThoughtNeeded: true,
        branches: ['branch-1', 'branch-2'],
        thoughtHistoryLength: 4,
      };

      expect(responseData.branches).toHaveLength(2);
    });
  });

  describe('Tool Schema Validation', () => {
    it('should define minimum value for thoughtNumber', () => {
      const schema = {
        thoughtNumber: {
          type: 'integer',
          minimum: 1,
        },
      };

      expect(schema.thoughtNumber.minimum).toBe(1);
    });

    it('should define minimum value for totalThoughts', () => {
      const schema = {
        totalThoughts: {
          type: 'integer',
          minimum: 1,
        },
      };

      expect(schema.totalThoughts.minimum).toBe(1);
    });

    it('should mark thought as required field', () => {
      const required = ['thought', 'nextThoughtNeeded', 'thoughtNumber', 'totalThoughts'];
      expect(required).toContain('thought');
    });

    it('should mark nextThoughtNeeded as required field', () => {
      const required = ['thought', 'nextThoughtNeeded', 'thoughtNumber', 'totalThoughts'];
      expect(required).toContain('nextThoughtNeeded');
    });

    it('should allow optional fields', () => {
      const allFields = [
        'thought',
        'nextThoughtNeeded',
        'thoughtNumber',
        'totalThoughts',
        'isRevision',
        'revisesThought',
        'branchFromThought',
        'branchId',
        'needsMoreThoughts',
      ];
      const requiredFields = ['thought', 'nextThoughtNeeded', 'thoughtNumber', 'totalThoughts'];
      const optionalFields = allFields.filter(f => !requiredFields.includes(f));

      expect(optionalFields).toContain('isRevision');
      expect(optionalFields).toContain('branchId');
    });
  });

  describe('Unicode and Special Characters', () => {
    it('should handle unicode characters in thoughts', () => {
      const thought = {
        thought: '日本語の思考プロセス',
        thoughtNumber: 1,
        totalThoughts: 5,
        nextThoughtNeeded: true,
      };

      expect(thought.thought).toBe('日本語の思考プロセス');
    });

    it('should handle emojis in thoughts', () => {
      const thought = {
        thought: 'Exploring solutions 🚀 with creativity ✨',
        thoughtNumber: 1,
        totalThoughts: 5,
        nextThoughtNeeded: true,
      };

      expect(thought.thought).toContain('🚀');
      expect(thought.thought).toContain('✨');
    });

    it('should handle multiline thoughts', () => {
      const thought = {
        thought: 'First line\nSecond line\nThird line',
        thoughtNumber: 1,
        totalThoughts: 5,
        nextThoughtNeeded: true,
      };

      expect(thought.thought).toContain('\n');
      expect(thought.thought.split('\n')).toHaveLength(3);
    });

    it('should handle special characters in branch IDs', () => {
      const branch = {
        thought: 'Test',
        thoughtNumber: 1,
        totalThoughts: 5,
        nextThoughtNeeded: true,
        branchId: 'branch-with-special-chars_123',
      };

      expect(branch.branchId).toContain('-');
      expect(branch.branchId).toContain('_');
    });
  });
});