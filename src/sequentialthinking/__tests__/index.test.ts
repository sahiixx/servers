import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';

// Mock chalk before importing the module
jest.mock('chalk', () => ({
  default: {
    yellow: jest.fn((str: string) => str),
    green: jest.fn((str: string) => str),
    blue: jest.fn((str: string) => str),
  },
}));

// Mock the Server and Transport
jest.mock('@modelcontextprotocol/sdk/server/index.js', () => ({
  Server: jest.fn().mockImplementation(() => ({
    setRequestHandler: jest.fn(),
    connect: jest.fn(),
  })),
}));

jest.mock('@modelcontextprotocol/sdk/server/stdio.js', () => ({
  StdioServerTransport: jest.fn(),
}));

describe('SequentialThinkingServer', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    jest.clearAllMocks();
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.restoreAllMocks();
  });

  describe('Thought Validation', () => {
    it('should validate valid thought data', async () => {
      const { SequentialThinkingServer } = await import('../index.js');
      const server = new (SequentialThinkingServer as any)();

      const validInput = {
        thought: 'This is a test thought',
        thoughtNumber: 1,
        totalThoughts: 5,
        nextThoughtNeeded: true,
      };

      const result = server.processThought(validInput);
      expect(result.content).toBeDefined();
      expect(result.content[0].type).toBe('text');
      expect(result.isError).toBeUndefined();
    });

    it('should reject thought without required thought field', async () => {
      const { SequentialThinkingServer } = await import('../index.js');
      const server = new (SequentialThinkingServer as any)();

      const invalidInput = {
        thoughtNumber: 1,
        totalThoughts: 5,
        nextThoughtNeeded: true,
      };

      const result = server.processThought(invalidInput);
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Invalid thought');
    });

    it('should reject thought with invalid thoughtNumber type', async () => {
      const { SequentialThinkingServer } = await import('../index.js');
      const server = new (SequentialThinkingServer as any)();

      const invalidInput = {
        thought: 'Test thought',
        thoughtNumber: 'not a number',
        totalThoughts: 5,
        nextThoughtNeeded: true,
      };

      const result = server.processThought(invalidInput);
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Invalid thoughtNumber');
    });

    it('should reject thought with invalid totalThoughts type', async () => {
      const { SequentialThinkingServer } = await import('../index.js');
      const server = new (SequentialThinkingServer as any)();

      const invalidInput = {
        thought: 'Test thought',
        thoughtNumber: 1,
        totalThoughts: 'invalid',
        nextThoughtNeeded: true,
      };

      const result = server.processThought(invalidInput);
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Invalid totalThoughts');
    });

    it('should reject thought with invalid nextThoughtNeeded type', async () => {
      const { SequentialThinkingServer } = await import('../index.js');
      const server = new (SequentialThinkingServer as any)();

      const invalidInput = {
        thought: 'Test thought',
        thoughtNumber: 1,
        totalThoughts: 5,
        nextThoughtNeeded: 'maybe',
      };

      const result = server.processThought(invalidInput);
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Invalid nextThoughtNeeded');
    });
  });

  describe('Thought Processing', () => {
    it('should process regular thoughts correctly', async () => {
      const { SequentialThinkingServer } = await import('../index.js');
      const server = new (SequentialThinkingServer as any)();

      const thought = {
        thought: 'Analyzing the problem',
        thoughtNumber: 1,
        totalThoughts: 3,
        nextThoughtNeeded: true,
      };

      const result = server.processThought(thought);
      expect(result.isError).toBeUndefined();
      
      const parsedResult = JSON.parse(result.content[0].text);
      expect(parsedResult.thoughtNumber).toBe(1);
      expect(parsedResult.totalThoughts).toBe(3);
      expect(parsedResult.nextThoughtNeeded).toBe(true);
      expect(parsedResult.thoughtHistoryLength).toBe(1);
    });

    it('should process revision thoughts correctly', async () => {
      const { SequentialThinkingServer } = await import('../index.js');
      const server = new (SequentialThinkingServer as any)();

      const revision = {
        thought: 'Revising previous analysis',
        thoughtNumber: 2,
        totalThoughts: 3,
        nextThoughtNeeded: true,
        isRevision: true,
        revisesThought: 1,
      };

      const result = server.processThought(revision);
      expect(result.isError).toBeUndefined();
      
      const parsedResult = JSON.parse(result.content[0].text);
      expect(parsedResult.thoughtNumber).toBe(2);
      expect(parsedResult.thoughtHistoryLength).toBe(1);
    });

    it('should process branch thoughts correctly', async () => {
      const { SequentialThinkingServer } = await import('../index.js');
      const server = new (SequentialThinkingServer as any)();

      const branch = {
        thought: 'Exploring alternative approach',
        thoughtNumber: 2,
        totalThoughts: 4,
        nextThoughtNeeded: true,
        branchFromThought: 1,
        branchId: 'branch-alpha',
      };

      const result = server.processThought(branch);
      expect(result.isError).toBeUndefined();
      
      const parsedResult = JSON.parse(result.content[0].text);
      expect(parsedResult.branches).toContain('branch-alpha');
      expect(parsedResult.thoughtHistoryLength).toBe(1);
    });

    it('should auto-adjust totalThoughts if thoughtNumber exceeds it', async () => {
      const { SequentialThinkingServer } = await import('../index.js');
      const server = new (SequentialThinkingServer as any)();

      const thought = {
        thought: 'Additional thought',
        thoughtNumber: 6,
        totalThoughts: 5,
        nextThoughtNeeded: false,
      };

      const result = server.processThought(thought);
      expect(result.isError).toBeUndefined();
      
      const parsedResult = JSON.parse(result.content[0].text);
      expect(parsedResult.totalThoughts).toBe(6);
    });

    it('should track multiple thoughts in history', async () => {
      const { SequentialThinkingServer } = await import('../index.js');
      const server = new (SequentialThinkingServer as any)();

      const thoughts = [
        { thought: 'First thought', thoughtNumber: 1, totalThoughts: 3, nextThoughtNeeded: true },
        { thought: 'Second thought', thoughtNumber: 2, totalThoughts: 3, nextThoughtNeeded: true },
        { thought: 'Third thought', thoughtNumber: 3, totalThoughts: 3, nextThoughtNeeded: false },
      ];

      thoughts.forEach((t) => server.processThought(t));
      
      const lastResult = server.processThought({
        thought: 'Final thought',
        thoughtNumber: 4,
        totalThoughts: 4,
        nextThoughtNeeded: false,
      });

      const parsedResult = JSON.parse(lastResult.content[0].text);
      expect(parsedResult.thoughtHistoryLength).toBe(4);
    });
  });

  describe('Branch Management', () => {
    it('should track multiple branches separately', async () => {
      const { SequentialThinkingServer } = await import('../index.js');
      const server = new (SequentialThinkingServer as any)();

      const branch1 = {
        thought: 'Branch 1 thought',
        thoughtNumber: 2,
        totalThoughts: 4,
        nextThoughtNeeded: true,
        branchFromThought: 1,
        branchId: 'branch-1',
      };

      const branch2 = {
        thought: 'Branch 2 thought',
        thoughtNumber: 2,
        totalThoughts: 4,
        nextThoughtNeeded: true,
        branchFromThought: 1,
        branchId: 'branch-2',
      };

      server.processThought(branch1);
      const result = server.processThought(branch2);

      const parsedResult = JSON.parse(result.content[0].text);
      expect(parsedResult.branches).toHaveLength(2);
      expect(parsedResult.branches).toContain('branch-1');
      expect(parsedResult.branches).toContain('branch-2');
    });

    it('should add multiple thoughts to same branch', async () => {
      const { SequentialThinkingServer } = await import('../index.js');
      const server = new (SequentialThinkingServer as any)();

      const branchThoughts = [
        {
          thought: 'Branch thought 1',
          thoughtNumber: 2,
          totalThoughts: 5,
          nextThoughtNeeded: true,
          branchFromThought: 1,
          branchId: 'main-branch',
        },
        {
          thought: 'Branch thought 2',
          thoughtNumber: 3,
          totalThoughts: 5,
          nextThoughtNeeded: true,
          branchFromThought: 1,
          branchId: 'main-branch',
        },
      ];

      branchThoughts.forEach((t) => server.processThought(t));
      
      const result = server.processThought({
        thought: 'Status check',
        thoughtNumber: 4,
        totalThoughts: 5,
        nextThoughtNeeded: false,
      });

      const parsedResult = JSON.parse(result.content[0].text);
      expect(parsedResult.branches).toContain('main-branch');
    });
  });

  describe('Thought Logging', () => {
    it('should not log thoughts when DISABLE_THOUGHT_LOGGING is true', async () => {
      process.env.DISABLE_THOUGHT_LOGGING = 'true';
      
      // Clear module cache to reload with new env var
      jest.resetModules();
      
      const { SequentialThinkingServer } = await import('../index.js');
      const server = new (SequentialThinkingServer as any)();

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      const thought = {
        thought: 'Test thought',
        thoughtNumber: 1,
        totalThoughts: 3,
        nextThoughtNeeded: true,
      };

      server.processThought(thought);

      // Should not call console.error when logging is disabled
      expect(consoleErrorSpy).not.toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });

    it('should log thoughts when DISABLE_THOUGHT_LOGGING is false', async () => {
      process.env.DISABLE_THOUGHT_LOGGING = 'false';
      
      jest.resetModules();
      
      const { SequentialThinkingServer } = await import('../index.js');
      const server = new (SequentialThinkingServer as any)();

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      const thought = {
        thought: 'Test thought',
        thoughtNumber: 1,
        totalThoughts: 3,
        nextThoughtNeeded: true,
      };

      server.processThought(thought);

      // Should call console.error when logging is enabled
      expect(consoleErrorSpy).toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });
  });

  describe('Response Format', () => {
    it('should return properly formatted success response', async () => {
      const { SequentialThinkingServer } = await import('../index.js');
      const server = new (SequentialThinkingServer as any)();

      const thought = {
        thought: 'Test thought',
        thoughtNumber: 1,
        totalThoughts: 3,
        nextThoughtNeeded: true,
      };

      const result = server.processThought(thought);
      
      expect(result).toHaveProperty('content');
      expect(Array.isArray(result.content)).toBe(true);
      expect(result.content[0]).toHaveProperty('type', 'text');
      expect(result.content[0]).toHaveProperty('text');
      
      // Should be valid JSON
      expect(() => JSON.parse(result.content[0].text)).not.toThrow();
    });

    it('should return properly formatted error response', async () => {
      const { SequentialThinkingServer } = await import('../index.js');
      const server = new (SequentialThinkingServer as any)();

      const invalidThought = {
        thoughtNumber: 1,
        totalThoughts: 3,
        nextThoughtNeeded: true,
      };

      const result = server.processThought(invalidThought);
      
      expect(result).toHaveProperty('isError', true);
      expect(result).toHaveProperty('content');
      expect(Array.isArray(result.content)).toBe(true);
      
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed).toHaveProperty('error');
      expect(parsed).toHaveProperty('status', 'failed');
    });
  });

  describe('Edge Cases', () => {
    it('should handle thought with all optional fields', async () => {
      const { SequentialThinkingServer } = await import('../index.js');
      const server = new (SequentialThinkingServer as any)();

      const complexThought = {
        thought: 'Complex thought',
        thoughtNumber: 3,
        totalThoughts: 5,
        nextThoughtNeeded: true,
        isRevision: true,
        revisesThought: 2,
        branchFromThought: 1,
        branchId: 'complex-branch',
        needsMoreThoughts: true,
      };

      const result = server.processThought(complexThought);
      expect(result.isError).toBeUndefined();
      
      const parsedResult = JSON.parse(result.content[0].text);
      expect(parsedResult.thoughtNumber).toBe(3);
      expect(parsedResult.branches).toContain('complex-branch');
    });

    it('should handle empty thought string', async () => {
      const { SequentialThinkingServer } = await import('../index.js');
      const server = new (SequentialThinkingServer as any)();

      const emptyThought = {
        thought: '',
        thoughtNumber: 1,
        totalThoughts: 3,
        nextThoughtNeeded: true,
      };

      // Empty string is still a valid string
      const result = server.processThought(emptyThought);
      expect(result.isError).toBeUndefined();
    });

    it('should handle very long thought strings', async () => {
      const { SequentialThinkingServer } = await import('../index.js');
      const server = new (SequentialThinkingServer as any)();

      const longThought = {
        thought: 'A'.repeat(10000),
        thoughtNumber: 1,
        totalThoughts: 3,
        nextThoughtNeeded: true,
      };

      const result = server.processThought(longThought);
      expect(result.isError).toBeUndefined();
    });

    it('should handle zero thoughtNumber gracefully', async () => {
      const { SequentialThinkingServer } = await import('../index.js');
      const server = new (SequentialThinkingServer as any)();

      const zeroThought = {
        thought: 'Zero thought',
        thoughtNumber: 0,
        totalThoughts: 3,
        nextThoughtNeeded: true,
      };

      const result = server.processThought(zeroThought);
      expect(result.isError).toBeUndefined();
    });

    it('should handle negative thoughtNumber', async () => {
      const { SequentialThinkingServer } = await import('../index.js');
      const server = new (SequentialThinkingServer as any)();

      const negativeThought = {
        thought: 'Negative thought',
        thoughtNumber: -1,
        totalThoughts: 3,
        nextThoughtNeeded: true,
      };

      const result = server.processThought(negativeThought);
      expect(result.isError).toBeUndefined();
    });

    it('should handle null values in optional fields', async () => {
      const { SequentialThinkingServer } = await import('../index.js');
      const server = new (SequentialThinkingServer as any)();

      const thoughtWithNulls = {
        thought: 'Test thought',
        thoughtNumber: 1,
        totalThoughts: 3,
        nextThoughtNeeded: true,
        isRevision: null,
        revisesThought: null,
        branchFromThought: null,
        branchId: null,
      };

      const result = server.processThought(thoughtWithNulls);
      expect(result.isError).toBeUndefined();
    });
  });

  describe('Sequential Thought Patterns', () => {
    it('should handle linear thought progression', async () => {
      const { SequentialThinkingServer } = await import('../index.js');
      const server = new (SequentialThinkingServer as any)();

      const linearThoughts = [
        { thought: 'Step 1: Understand problem', thoughtNumber: 1, totalThoughts: 5, nextThoughtNeeded: true },
        { thought: 'Step 2: Analyze requirements', thoughtNumber: 2, totalThoughts: 5, nextThoughtNeeded: true },
        { thought: 'Step 3: Design solution', thoughtNumber: 3, totalThoughts: 5, nextThoughtNeeded: true },
        { thought: 'Step 4: Implement', thoughtNumber: 4, totalThoughts: 5, nextThoughtNeeded: true },
        { thought: 'Step 5: Validate', thoughtNumber: 5, totalThoughts: 5, nextThoughtNeeded: false },
      ];

      let result;
      linearThoughts.forEach((t) => {
        result = server.processThought(t);
      });

      const parsedResult = JSON.parse(result!.content[0].text);
      expect(parsedResult.thoughtHistoryLength).toBe(5);
      expect(parsedResult.nextThoughtNeeded).toBe(false);
    });

    it('should handle thought revision pattern', async () => {
      const { SequentialThinkingServer } = await import('../index.js');
      const server = new (SequentialThinkingServer as any)();

      server.processThought({
        thought: 'Initial approach',
        thoughtNumber: 1,
        totalThoughts: 3,
        nextThoughtNeeded: true,
      });

      const revision = server.processThought({
        thought: 'Better approach found',
        thoughtNumber: 2,
        totalThoughts: 3,
        nextThoughtNeeded: true,
        isRevision: true,
        revisesThought: 1,
      });

      expect(revision.isError).toBeUndefined();
      const parsedResult = JSON.parse(revision.content[0].text);
      expect(parsedResult.thoughtHistoryLength).toBe(2);
    });

    it('should handle extending thoughts beyond initial estimate', async () => {
      const { SequentialThinkingServer } = await import('../index.js');
      const server = new (SequentialThinkingServer as any)();

      server.processThought({
        thought: 'Thought 1',
        thoughtNumber: 1,
        totalThoughts: 2,
        nextThoughtNeeded: true,
      });

      server.processThought({
        thought: 'Thought 2',
        thoughtNumber: 2,
        totalThoughts: 2,
        nextThoughtNeeded: true,
        needsMoreThoughts: true,
      });

      const extended = server.processThought({
        thought: 'Thought 3 (extended)',
        thoughtNumber: 3,
        totalThoughts: 4,
        nextThoughtNeeded: true,
      });

      const parsedResult = JSON.parse(extended.content[0].text);
      expect(parsedResult.thoughtHistoryLength).toBe(3);
      expect(parsedResult.totalThoughts).toBe(4);
    });
  });
});