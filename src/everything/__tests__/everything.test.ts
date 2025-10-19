import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { createServer } from '../everything.js';
import type { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  ListResourcesRequestSchema,
  ListResourceTemplatesRequestSchema,
  ReadResourceRequestSchema,
  SubscribeRequestSchema,
  UnsubscribeRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
  ListToolsRequestSchema,
  CallToolRequestSchema,
  CompleteRequestSchema,
  RootsListChangedNotificationSchema,
} from '@modelcontextprotocol/sdk/types.js';

describe('Everything Server', () => {
  let server: Server;
  let cleanup: () => Promise<void>;
  let startNotificationIntervals: (sid?: string) => void;

  beforeEach(() => {
    jest.clearAllMocks();
    const result = createServer();
    server = result.server;
    cleanup = result.cleanup;
    startNotificationIntervals = result.startNotificationIntervals;
  });

  afterEach(async () => {
    await cleanup();
  });

  describe('Server Initialization', () => {
    it('creates a server with correct metadata', () => {
      expect(server).toBeDefined();
      // Server should have capabilities
      const capabilities = server.getServerCapabilities();
      expect(capabilities.prompts).toBeDefined();
      expect(capabilities.resources).toBeDefined();
      expect(capabilities.tools).toBeDefined();
      expect(capabilities.logging).toBeDefined();
      expect(capabilities.completions).toBeDefined();
    });

    it('supports resource subscriptions', () => {
      const capabilities = server.getServerCapabilities();
      expect(capabilities.resources?.subscribe).toBe(true);
    });
  });

  describe('Resource Operations', () => {
    describe('ListResources', () => {
      it('returns paginated resources with cursor', async () => {
        const mockRequest = {
          method: 'resources/list' as const,
          params: {},
        };

        const handler = server['requestHandlers'].get(ListResourcesRequestSchema);
        expect(handler).toBeDefined();

        const result = await handler!(mockRequest as any, {} as any);
        
        expect(result.resources).toBeDefined();
        expect(result.resources.length).toBeLessThanOrEqual(10);
        expect(result.nextCursor).toBeDefined();
      });

      it('handles pagination with cursor', async () => {
        const firstCursor = btoa('10');
        const mockRequest = {
          method: 'resources/list' as const,
          params: { cursor: firstCursor },
        };

        const handler = server['requestHandlers'].get(ListResourcesRequestSchema);
        const result = await handler!(mockRequest as any, {} as any);

        expect(result.resources).toBeDefined();
        expect(result.resources.length).toBeGreaterThan(0);
        expect(result.resources[0].uri).toContain('resource/11');
      });

      it('returns no cursor at end of resources', async () => {
        const lastPageCursor = btoa('95');
        const mockRequest = {
          method: 'resources/list' as const,
          params: { cursor: lastPageCursor },
        };

        const handler = server['requestHandlers'].get(ListResourcesRequestSchema);
        const result = await handler!(mockRequest as any, {} as any);

        expect(result.nextCursor).toBeUndefined();
      });

      it('handles invalid cursor gracefully', async () => {
        const mockRequest = {
          method: 'resources/list' as const,
          params: { cursor: 'invalid-cursor' },
        };

        const handler = server['requestHandlers'].get(ListResourcesRequestSchema);
        const result = await handler!(mockRequest as any, {} as any);

        // Should start from beginning if cursor is invalid
        expect(result.resources).toBeDefined();
        expect(result.resources.length).toBeGreaterThan(0);
      });
    });

    describe('ListResourceTemplates', () => {
      it('returns resource templates', async () => {
        const mockRequest = {
          method: 'resources/templates/list' as const,
          params: {},
        };

        const handler = server['requestHandlers'].get(ListResourceTemplatesRequestSchema);
        const result = await handler!(mockRequest as any, {} as any);

        expect(result.resourceTemplates).toBeDefined();
        expect(result.resourceTemplates.length).toBeGreaterThan(0);
        expect(result.resourceTemplates[0].uriTemplate).toContain('{id}');
      });
    });

    describe('ReadResource', () => {
      it('reads a text resource', async () => {
        const mockRequest = {
          method: 'resources/read' as const,
          params: { uri: 'test://static/resource/2' },
        };

        const handler = server['requestHandlers'].get(ReadResourceRequestSchema);
        const result = await handler!(mockRequest as any, {} as any);

        expect(result.contents).toBeDefined();
        expect(result.contents.length).toBe(1);
        expect(result.contents[0]).toHaveProperty('text');
      });

      it('reads a blob resource', async () => {
        const mockRequest = {
          method: 'resources/read' as const,
          params: { uri: 'test://static/resource/3' },
        };

        const handler = server['requestHandlers'].get(ReadResourceRequestSchema);
        const result = await handler!(mockRequest as any, {} as any);

        expect(result.contents).toBeDefined();
        expect(result.contents.length).toBe(1);
        expect(result.contents[0]).toHaveProperty('blob');
      });

      it('throws error for unknown resource', async () => {
        const mockRequest = {
          method: 'resources/read' as const,
          params: { uri: 'test://static/resource/999' },
        };

        const handler = server['requestHandlers'].get(ReadResourceRequestSchema);
        await expect(handler!(mockRequest as any, {} as any)).rejects.toThrow('Unknown resource');
      });

      it('throws error for invalid URI format', async () => {
        const mockRequest = {
          method: 'resources/read' as const,
          params: { uri: 'invalid-uri' },
        };

        const handler = server['requestHandlers'].get(ReadResourceRequestSchema);
        await expect(handler!(mockRequest as any, {} as any)).rejects.toThrow();
      });
    });

    describe('Subscribe/Unsubscribe', () => {
      it('subscribes to resource updates', async () => {
        const mockRequest = {
          method: 'resources/subscribe' as const,
          params: { uri: 'test://static/resource/1' },
        };

        const handler = server['requestHandlers'].get(SubscribeRequestSchema);
        const result = await handler!(mockRequest as any, {} as any);

        expect(result).toEqual({});
      });

      it('unsubscribes from resource updates', async () => {
        // First subscribe
        const subscribeRequest = {
          method: 'resources/subscribe' as const,
          params: { uri: 'test://static/resource/1' },
        };
        await server['requestHandlers'].get(SubscribeRequestSchema)!(subscribeRequest as any, {} as any);

        // Then unsubscribe
        const unsubscribeRequest = {
          method: 'resources/unsubscribe' as const,
          params: { uri: 'test://static/resource/1' },
        };
        const handler = server['requestHandlers'].get(UnsubscribeRequestSchema);
        const result = await handler!(unsubscribeRequest as any, {} as any);

        expect(result).toEqual({});
      });
    });
  });

  describe('Prompt Operations', () => {
    describe('ListPrompts', () => {
      it('lists all available prompts', async () => {
        const mockRequest = {
          method: 'prompts/list' as const,
          params: {},
        };

        const handler = server['requestHandlers'].get(ListPromptsRequestSchema);
        const result = await handler!(mockRequest as any, {} as any);

        expect(result.prompts).toBeDefined();
        expect(result.prompts.length).toBeGreaterThan(0);
        expect(result.prompts.some(p => p.name === 'simple_prompt')).toBe(true);
        expect(result.prompts.some(p => p.name === 'complex_prompt')).toBe(true);
        expect(result.prompts.some(p => p.name === 'resource_prompt')).toBe(true);
      });
    });

    describe('GetPrompt', () => {
      it('returns simple prompt without arguments', async () => {
        const mockRequest = {
          method: 'prompts/get' as const,
          params: { name: 'simple_prompt' },
        };

        const handler = server['requestHandlers'].get(GetPromptRequestSchema);
        const result = await handler!(mockRequest as any, {} as any);

        expect(result.messages).toBeDefined();
        expect(result.messages.length).toBeGreaterThan(0);
        expect(result.messages[0].role).toBe('user');
      });

      it('returns complex prompt with arguments', async () => {
        const mockRequest = {
          method: 'prompts/get' as const,
          params: {
            name: 'complex_prompt',
            arguments: { temperature: '0.7', style: 'formal' },
          },
        };

        const handler = server['requestHandlers'].get(GetPromptRequestSchema);
        const result = await handler!(mockRequest as any, {} as any);

        expect(result.messages).toBeDefined();
        expect(result.messages.length).toBeGreaterThan(0);
        expect(result.messages[0].content).toHaveProperty('text');
      });

      it('returns resource prompt with embedded resource', async () => {
        const mockRequest = {
          method: 'prompts/get' as const,
          params: {
            name: 'resource_prompt',
            arguments: { resourceId: '5' },
          },
        };

        const handler = server['requestHandlers'].get(GetPromptRequestSchema);
        const result = await handler!(mockRequest as any, {} as any);

        expect(result.messages).toBeDefined();
        expect(result.messages.length).toBe(2);
        expect(result.messages[1].content).toHaveProperty('resource');
      });

      it('throws error for invalid resourceId', async () => {
        const mockRequest = {
          method: 'prompts/get' as const,
          params: {
            name: 'resource_prompt',
            arguments: { resourceId: '999' },
          },
        };

        const handler = server['requestHandlers'].get(GetPromptRequestSchema);
        await expect(handler!(mockRequest as any, {} as any)).rejects.toThrow('Invalid resourceId');
      });

      it('throws error for unknown prompt', async () => {
        const mockRequest = {
          method: 'prompts/get' as const,
          params: { name: 'unknown_prompt' },
        };

        const handler = server['requestHandlers'].get(GetPromptRequestSchema);
        await expect(handler!(mockRequest as any, {} as any)).rejects.toThrow('Unknown prompt');
      });
    });
  });

  describe('Tool Operations', () => {
    describe('ListTools', () => {
      it('lists all available tools', async () => {
        const mockRequest = {
          method: 'tools/list' as const,
          params: {},
        };

        const handler = server['requestHandlers'].get(ListToolsRequestSchema);
        const result = await handler!(mockRequest as any, {} as any);

        expect(result.tools).toBeDefined();
        expect(result.tools.length).toBeGreaterThan(0);
        
        const toolNames = result.tools.map(t => t.name);
        expect(toolNames).toContain('echo');
        expect(toolNames).toContain('add');
        expect(toolNames).toContain('longRunningOperation');
      });
    });

    describe('CallTool - echo', () => {
      it('echoes back the message', async () => {
        const mockRequest = {
          method: 'tools/call' as const,
          params: {
            name: 'echo',
            arguments: { message: 'Hello, World!' },
          },
        };

        const handler = server['requestHandlers'].get(CallToolRequestSchema);
        const result = await handler!(mockRequest as any, { requestId: '123' } as any);

        expect(result.content).toBeDefined();
        expect(result.content[0].type).toBe('text');
        expect(result.content[0].text).toContain('Hello, World!');
      });

      it('validates input schema', async () => {
        const mockRequest = {
          method: 'tools/call' as const,
          params: {
            name: 'echo',
            arguments: { wrongField: 'test' },
          },
        };

        const handler = server['requestHandlers'].get(CallToolRequestSchema);
        await expect(handler!(mockRequest as any, { requestId: '123' } as any)).rejects.toThrow();
      });
    });

    describe('CallTool - add', () => {
      it('adds two positive numbers', async () => {
        const mockRequest = {
          method: 'tools/call' as const,
          params: {
            name: 'add',
            arguments: { a: 5, b: 3 },
          },
        };

        const handler = server['requestHandlers'].get(CallToolRequestSchema);
        const result = await handler!(mockRequest as any, { requestId: '123' } as any);

        expect(result.content[0].text).toContain('8');
      });

      it('adds negative numbers', async () => {
        const mockRequest = {
          method: 'tools/call' as const,
          params: {
            name: 'add',
            arguments: { a: -5, b: -3 },
          },
        };

        const handler = server['requestHandlers'].get(CallToolRequestSchema);
        const result = await handler!(mockRequest as any, { requestId: '123' } as any);

        expect(result.content[0].text).toContain('-8');
      });

      it('handles zero', async () => {
        const mockRequest = {
          method: 'tools/call' as const,
          params: {
            name: 'add',
            arguments: { a: 0, b: 0 },
          },
        };

        const handler = server['requestHandlers'].get(CallToolRequestSchema);
        const result = await handler!(mockRequest as any, { requestId: '123' } as any);

        expect(result.content[0].text).toContain('0');
      });

      it('handles decimal numbers', async () => {
        const mockRequest = {
          method: 'tools/call' as const,
          params: {
            name: 'add',
            arguments: { a: 1.5, b: 2.3 },
          },
        };

        const handler = server['requestHandlers'].get(CallToolRequestSchema);
        const result = await handler!(mockRequest as any, { requestId: '123' } as any);

        expect(result.content[0].text).toContain('3.8');
      });
    });

    describe('CallTool - printEnv', () => {
      it('prints environment variables', async () => {
        const mockRequest = {
          method: 'tools/call' as const,
          params: {
            name: 'printEnv',
            arguments: {},
          },
        };

        const handler = server['requestHandlers'].get(CallToolRequestSchema);
        const result = await handler!(mockRequest as any, { requestId: '123' } as any);

        expect(result.content[0].type).toBe('text');
        expect(result.content[0].text).toBeDefined();
        // Should be valid JSON
        expect(() => JSON.parse(result.content[0].text!)).not.toThrow();
      });
    });

    describe('CallTool - getTinyImage', () => {
      it('returns an image', async () => {
        const mockRequest = {
          method: 'tools/call' as const,
          params: {
            name: 'getTinyImage',
            arguments: {},
          },
        };

        const handler = server['requestHandlers'].get(CallToolRequestSchema);
        const result = await handler!(mockRequest as any, { requestId: '123' } as any);

        expect(result.content.length).toBe(3);
        expect(result.content[1].type).toBe('image');
        expect(result.content[1]).toHaveProperty('data');
        expect(result.content[1]).toHaveProperty('mimeType');
      });
    });

    describe('CallTool - annotatedMessage', () => {
      it('returns error message with annotations', async () => {
        const mockRequest = {
          method: 'tools/call' as const,
          params: {
            name: 'annotatedMessage',
            arguments: { messageType: 'error', includeImage: false },
          },
        };

        const handler = server['requestHandlers'].get(CallToolRequestSchema);
        const result = await handler!(mockRequest as any, { requestId: '123' } as any);

        expect(result.content[0].type).toBe('text');
        expect(result.content[0]).toHaveProperty('annotations');
        expect(result.content[0].annotations?.priority).toBe(1.0);
      });

      it('returns success message with annotations', async () => {
        const mockRequest = {
          method: 'tools/call' as const,
          params: {
            name: 'annotatedMessage',
            arguments: { messageType: 'success', includeImage: false },
          },
        };

        const handler = server['requestHandlers'].get(CallToolRequestSchema);
        const result = await handler!(mockRequest as any, { requestId: '123' } as any);

        expect(result.content[0].annotations?.priority).toBe(0.7);
      });

      it('includes image when requested', async () => {
        const mockRequest = {
          method: 'tools/call' as const,
          params: {
            name: 'annotatedMessage',
            arguments: { messageType: 'debug', includeImage: true },
          },
        };

        const handler = server['requestHandlers'].get(CallToolRequestSchema);
        const result = await handler!(mockRequest as any, { requestId: '123' } as any);

        expect(result.content.length).toBe(2);
        expect(result.content[1].type).toBe('image');
      });
    });

    describe('CallTool - getResourceReference', () => {
      it('returns resource reference', async () => {
        const mockRequest = {
          method: 'tools/call' as const,
          params: {
            name: 'getResourceReference',
            arguments: { resourceId: 10 },
          },
        };

        const handler = server['requestHandlers'].get(CallToolRequestSchema);
        const result = await handler!(mockRequest as any, { requestId: '123' } as any);

        expect(result.content.length).toBe(3);
        expect(result.content[1].type).toBe('resource');
        expect(result.content[1]).toHaveProperty('resource');
      });

      it('throws error for invalid resource ID', async () => {
        const mockRequest = {
          method: 'tools/call' as const,
          params: {
            name: 'getResourceReference',
            arguments: { resourceId: 999 },
          },
        };

        const handler = server['requestHandlers'].get(CallToolRequestSchema);
        await expect(handler!(mockRequest as any, { requestId: '123' } as any)).rejects.toThrow();
      });

      it('validates resource ID range', async () => {
        const mockRequest = {
          method: 'tools/call' as const,
          params: {
            name: 'getResourceReference',
            arguments: { resourceId: 0 },
          },
        };

        const handler = server['requestHandlers'].get(CallToolRequestSchema);
        await expect(handler!(mockRequest as any, { requestId: '123' } as any)).rejects.toThrow();
      });
    });

    describe('CallTool - getResourceLinks', () => {
      it('returns multiple resource links', async () => {
        const mockRequest = {
          method: 'tools/call' as const,
          params: {
            name: 'getResourceLinks',
            arguments: { count: 3 },
          },
        };

        const handler = server['requestHandlers'].get(CallToolRequestSchema);
        const result = await handler!(mockRequest as any, { requestId: '123' } as any);

        expect(result.content.length).toBe(4); // 1 text + 3 resource_links
        expect(result.content[1].type).toBe('resource_link');
      });

      it('respects count parameter', async () => {
        const mockRequest = {
          method: 'tools/call' as const,
          params: {
            name: 'getResourceLinks',
            arguments: { count: 5 },
          },
        };

        const handler = server['requestHandlers'].get(CallToolRequestSchema);
        const result = await handler!(mockRequest as any, { requestId: '123' } as any);

        expect(result.content.length).toBe(6); // 1 text + 5 resource_links
      });
    });

    describe('CallTool - structuredContent', () => {
      it('returns structured weather data', async () => {
        const mockRequest = {
          method: 'tools/call' as const,
          params: {
            name: 'structuredContent',
            arguments: { location: 'New York' },
          },
        };

        const handler = server['requestHandlers'].get(CallToolRequestSchema);
        const result = await handler!(mockRequest as any, { requestId: '123' } as any);

        expect(result.content[0].type).toBe('text');
        expect(result).toHaveProperty('structuredContent');
        expect(result.structuredContent).toHaveProperty('temperature');
        expect(result.structuredContent).toHaveProperty('conditions');
        expect(result.structuredContent).toHaveProperty('humidity');
      });
    });

    describe('CallTool - unknown tool', () => {
      it('throws error for unknown tool', async () => {
        const mockRequest = {
          method: 'tools/call' as const,
          params: {
            name: 'unknownTool',
            arguments: {},
          },
        };

        const handler = server['requestHandlers'].get(CallToolRequestSchema);
        await expect(handler!(mockRequest as any, { requestId: '123' } as any)).rejects.toThrow('Unknown tool');
      });
    });
  });

  describe('Completion Operations', () => {
    describe('Complete', () => {
      it('completes resource IDs', async () => {
        const mockRequest = {
          method: 'completion/complete' as const,
          params: {
            ref: { type: 'ref/resource', uri: 'test://static/resource/1' },
            argument: { name: 'resourceId', value: '1' },
          },
        };

        const handler = server['requestHandlers'].get(CompleteRequestSchema);
        const result = await handler!(mockRequest as any, {} as any);

        expect(result.completion).toBeDefined();
        expect(result.completion.values).toBeDefined();
        expect(result.completion.values.length).toBeGreaterThan(0);
      });

      it('completes prompt arguments', async () => {
        const mockRequest = {
          method: 'completion/complete' as const,
          params: {
            ref: { type: 'ref/prompt', name: 'complex_prompt' },
            argument: { name: 'style', value: 'ca' },
          },
        };

        const handler = server['requestHandlers'].get(CompleteRequestSchema);
        const result = await handler!(mockRequest as any, {} as any);

        expect(result.completion.values).toContain('casual');
      });

      it('filters completions based on input', async () => {
        const mockRequest = {
          method: 'completion/complete' as const,
          params: {
            ref: { type: 'ref/prompt', name: 'complex_prompt' },
            argument: { name: 'temperature', value: '0' },
          },
        };

        const handler = server['requestHandlers'].get(CompleteRequestSchema);
        const result = await handler!(mockRequest as any, {} as any);

        expect(result.completion.values.every(v => v.startsWith('0'))).toBe(true);
      });

      it('returns empty array for unknown argument', async () => {
        const mockRequest = {
          method: 'completion/complete' as const,
          params: {
            ref: { type: 'ref/prompt', name: 'complex_prompt' },
            argument: { name: 'unknownArg', value: 'test' },
          },
        };

        const handler = server['requestHandlers'].get(CompleteRequestSchema);
        const result = await handler!(mockRequest as any, {} as any);

        expect(result.completion.values).toEqual([]);
      });

      it('throws error for unknown reference type', async () => {
        const mockRequest = {
          method: 'completion/complete' as const,
          params: {
            ref: { type: 'ref/unknown' as any, name: 'test' },
            argument: { name: 'test', value: 'test' },
          },
        };

        const handler = server['requestHandlers'].get(CompleteRequestSchema);
        await expect(handler!(mockRequest as any, {} as any)).rejects.toThrow('Unknown reference type');
      });
    });
  });

  describe('Notification Intervals', () => {
    it('starts notification intervals', () => {
      expect(() => startNotificationIntervals()).not.toThrow();
    });

    it('starts notification intervals with session ID', () => {
      expect(() => startNotificationIntervals('test-session-id')).not.toThrow();
    });
  });
});