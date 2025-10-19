import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

// Mock the fs module
jest.mock('fs/promises');
const mockFs = fs as jest.Mocked<typeof fs>;

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

describe('KnowledgeGraphManager', () => {
  let tmpDir: string;
  let memoryFilePath: string;

  beforeEach(() => {
    jest.clearAllMocks();
    tmpDir = path.join(os.tmpdir(), `memory-test-${Date.now()}`);
    memoryFilePath = path.join(tmpDir, 'memory.json');
    process.env.MEMORY_FILE_PATH = memoryFilePath;
  });

  afterEach(async () => {
    delete process.env.MEMORY_FILE_PATH;
    jest.restoreAllMocks();
  });

  describe('Entity Operations', () => {
    it('should create new entities successfully', async () => {
      mockFs.readFile.mockRejectedValue({ code: 'ENOENT' });
      mockFs.writeFile.mockResolvedValue(undefined);

      const { KnowledgeGraphManager } = await import('../index.js');
      const manager = new (KnowledgeGraphManager as any)();

      const entities = [
        { name: 'Alice', entityType: 'person', observations: ['likes coding'] },
        { name: 'Bob', entityType: 'person', observations: ['enjoys reading'] },
      ];

      const result = await manager.createEntities(entities);
      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('Alice');
      expect(mockFs.writeFile).toHaveBeenCalled();
    });

    it('should not create duplicate entities', async () => {
      const existingData = JSON.stringify({
        type: 'entity',
        name: 'Alice',
        entityType: 'person',
        observations: ['existing observation'],
      });
      mockFs.readFile.mockResolvedValue(existingData);
      mockFs.writeFile.mockResolvedValue(undefined);

      const { KnowledgeGraphManager } = await import('../index.js');
      const manager = new (KnowledgeGraphManager as any)();

      const entities = [
        { name: 'Alice', entityType: 'person', observations: ['new observation'] },
        { name: 'Charlie', entityType: 'person', observations: ['likes sports'] },
      ];

      const result = await manager.createEntities(entities);
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Charlie');
    });

    it('should handle empty entity list', async () => {
      mockFs.readFile.mockRejectedValue({ code: 'ENOENT' });
      mockFs.writeFile.mockResolvedValue(undefined);

      const { KnowledgeGraphManager } = await import('../index.js');
      const manager = new (KnowledgeGraphManager as any)();

      const result = await manager.createEntities([]);
      expect(result).toHaveLength(0);
    });
  });

  describe('Relation Operations', () => {
    it('should create new relations successfully', async () => {
      mockFs.readFile.mockRejectedValue({ code: 'ENOENT' });
      mockFs.writeFile.mockResolvedValue(undefined);

      const { KnowledgeGraphManager } = await import('../index.js');
      const manager = new (KnowledgeGraphManager as any)();

      const relations = [
        { from: 'Alice', to: 'Bob', relationType: 'knows' },
        { from: 'Bob', to: 'Charlie', relationType: 'works_with' },
      ];

      const result = await manager.createRelations(relations);
      expect(result).toHaveLength(2);
      expect(result[0].from).toBe('Alice');
      expect(result[0].relationType).toBe('knows');
    });

    it('should not create duplicate relations', async () => {
      const existingData = JSON.stringify({
        type: 'relation',
        from: 'Alice',
        to: 'Bob',
        relationType: 'knows',
      });
      mockFs.readFile.mockResolvedValue(existingData);
      mockFs.writeFile.mockResolvedValue(undefined);

      const { KnowledgeGraphManager } = await import('../index.js');
      const manager = new (KnowledgeGraphManager as any)();

      const relations = [
        { from: 'Alice', to: 'Bob', relationType: 'knows' },
        { from: 'Bob', to: 'Charlie', relationType: 'works_with' },
      ];

      const result = await manager.createRelations(relations);
      expect(result).toHaveLength(1);
      expect(result[0].from).toBe('Bob');
    });

    it('should handle empty relation list', async () => {
      mockFs.readFile.mockRejectedValue({ code: 'ENOENT' });
      mockFs.writeFile.mockResolvedValue(undefined);

      const { KnowledgeGraphManager } = await import('../index.js');
      const manager = new (KnowledgeGraphManager as any)();

      const result = await manager.createRelations([]);
      expect(result).toHaveLength(0);
    });
  });

  describe('Observation Operations', () => {
    it('should add new observations to existing entities', async () => {
      const existingData = JSON.stringify({
        type: 'entity',
        name: 'Alice',
        entityType: 'person',
        observations: ['observation1'],
      });
      mockFs.readFile.mockResolvedValue(existingData);
      mockFs.writeFile.mockResolvedValue(undefined);

      const { KnowledgeGraphManager } = await import('../index.js');
      const manager = new (KnowledgeGraphManager as any)();

      const observations = [
        { entityName: 'Alice', contents: ['observation2', 'observation3'] },
      ];

      const result = await manager.addObservations(observations);
      expect(result).toHaveLength(1);
      expect(result[0].addedObservations).toHaveLength(2);
    });

    it('should not add duplicate observations', async () => {
      const existingData = JSON.stringify({
        type: 'entity',
        name: 'Alice',
        entityType: 'person',
        observations: ['observation1'],
      });
      mockFs.readFile.mockResolvedValue(existingData);
      mockFs.writeFile.mockResolvedValue(undefined);

      const { KnowledgeGraphManager } = await import('../index.js');
      const manager = new (KnowledgeGraphManager as any)();

      const observations = [
        { entityName: 'Alice', contents: ['observation1', 'observation2'] },
      ];

      const result = await manager.addObservations(observations);
      expect(result[0].addedObservations).toHaveLength(1);
      expect(result[0].addedObservations[0]).toBe('observation2');
    });

    it('should throw error for non-existent entity', async () => {
      mockFs.readFile.mockRejectedValue({ code: 'ENOENT' });

      const { KnowledgeGraphManager } = await import('../index.js');
      const manager = new (KnowledgeGraphManager as any)();

      const observations = [
        { entityName: 'NonExistent', contents: ['observation1'] },
      ];

      await expect(manager.addObservations(observations)).rejects.toThrow(
        'Entity with name NonExistent not found'
      );
    });
  });

  describe('Delete Operations', () => {
    it('should delete entities and cascade delete relations', async () => {
      const existingData = [
        JSON.stringify({ type: 'entity', name: 'Alice', entityType: 'person', observations: [] }),
        JSON.stringify({ type: 'entity', name: 'Bob', entityType: 'person', observations: [] }),
        JSON.stringify({ type: 'relation', from: 'Alice', to: 'Bob', relationType: 'knows' }),
      ].join('\n');
      mockFs.readFile.mockResolvedValue(existingData);
      mockFs.writeFile.mockResolvedValue(undefined);

      const { KnowledgeGraphManager } = await import('../index.js');
      const manager = new (KnowledgeGraphManager as any)();

      await manager.deleteEntities(['Alice']);
      expect(mockFs.writeFile).toHaveBeenCalled();
    });

    it('should delete specific observations from entities', async () => {
      const existingData = JSON.stringify({
        type: 'entity',
        name: 'Alice',
        entityType: 'person',
        observations: ['obs1', 'obs2', 'obs3'],
      });
      mockFs.readFile.mockResolvedValue(existingData);
      mockFs.writeFile.mockResolvedValue(undefined);

      const { KnowledgeGraphManager } = await import('../index.js');
      const manager = new (KnowledgeGraphManager as any)();

      await manager.deleteObservations([
        { entityName: 'Alice', observations: ['obs1', 'obs3'] },
      ]);
      expect(mockFs.writeFile).toHaveBeenCalled();
    });

    it('should delete specific relations', async () => {
      const existingData = [
        JSON.stringify({ type: 'relation', from: 'Alice', to: 'Bob', relationType: 'knows' }),
        JSON.stringify({ type: 'relation', from: 'Bob', to: 'Charlie', relationType: 'works_with' }),
      ].join('\n');
      mockFs.readFile.mockResolvedValue(existingData);
      mockFs.writeFile.mockResolvedValue(undefined);

      const { KnowledgeGraphManager } = await import('../index.js');
      const manager = new (KnowledgeGraphManager as any)();

      await manager.deleteRelations([
        { from: 'Alice', to: 'Bob', relationType: 'knows' },
      ]);
      expect(mockFs.writeFile).toHaveBeenCalled();
    });
  });

  describe('Search and Query Operations', () => {
    it('should search nodes by name', async () => {
      const existingData = [
        JSON.stringify({ type: 'entity', name: 'Alice Smith', entityType: 'person', observations: ['developer'] }),
        JSON.stringify({ type: 'entity', name: 'Bob Johnson', entityType: 'person', observations: ['designer'] }),
        JSON.stringify({ type: 'relation', from: 'Alice Smith', to: 'Bob Johnson', relationType: 'knows' }),
      ].join('\n');
      mockFs.readFile.mockResolvedValue(existingData);

      const { KnowledgeGraphManager } = await import('../index.js');
      const manager = new (KnowledgeGraphManager as any)();

      const result = await manager.searchNodes('alice');
      expect(result.entities).toHaveLength(1);
      expect(result.entities[0].name).toBe('Alice Smith');
    });

    it('should search nodes by entity type', async () => {
      const existingData = [
        JSON.stringify({ type: 'entity', name: 'Alice', entityType: 'developer', observations: [] }),
        JSON.stringify({ type: 'entity', name: 'Bob', entityType: 'designer', observations: [] }),
      ].join('\n');
      mockFs.readFile.mockResolvedValue(existingData);

      const { KnowledgeGraphManager } = await import('../index.js');
      const manager = new (KnowledgeGraphManager as any)();

      const result = await manager.searchNodes('developer');
      expect(result.entities).toHaveLength(1);
      expect(result.entities[0].entityType).toBe('developer');
    });

    it('should search nodes by observation content', async () => {
      const existingData = JSON.stringify({
        type: 'entity',
        name: 'Alice',
        entityType: 'person',
        observations: ['loves programming in TypeScript'],
      });
      mockFs.readFile.mockResolvedValue(existingData);

      const { KnowledgeGraphManager } = await import('../index.js');
      const manager = new (KnowledgeGraphManager as any)();

      const result = await manager.searchNodes('typescript');
      expect(result.entities).toHaveLength(1);
    });

    it('should return empty results for non-matching search', async () => {
      const existingData = JSON.stringify({
        type: 'entity',
        name: 'Alice',
        entityType: 'person',
        observations: [],
      });
      mockFs.readFile.mockResolvedValue(existingData);

      const { KnowledgeGraphManager } = await import('../index.js');
      const manager = new (KnowledgeGraphManager as any)();

      const result = await manager.searchNodes('nonexistent');
      expect(result.entities).toHaveLength(0);
      expect(result.relations).toHaveLength(0);
    });

    it('should open specific nodes by name', async () => {
      const existingData = [
        JSON.stringify({ type: 'entity', name: 'Alice', entityType: 'person', observations: [] }),
        JSON.stringify({ type: 'entity', name: 'Bob', entityType: 'person', observations: [] }),
        JSON.stringify({ type: 'entity', name: 'Charlie', entityType: 'person', observations: [] }),
      ].join('\n');
      mockFs.readFile.mockResolvedValue(existingData);

      const { KnowledgeGraphManager } = await import('../index.js');
      const manager = new (KnowledgeGraphManager as any)();

      const result = await manager.openNodes(['Alice', 'Charlie']);
      expect(result.entities).toHaveLength(2);
      expect(result.entities.map((e: any) => e.name).sort()).toEqual(['Alice', 'Charlie']);
    });

    it('should read entire graph', async () => {
      const existingData = [
        JSON.stringify({ type: 'entity', name: 'Alice', entityType: 'person', observations: [] }),
        JSON.stringify({ type: 'entity', name: 'Bob', entityType: 'person', observations: [] }),
        JSON.stringify({ type: 'relation', from: 'Alice', to: 'Bob', relationType: 'knows' }),
      ].join('\n');
      mockFs.readFile.mockResolvedValue(existingData);

      const { KnowledgeGraphManager } = await import('../index.js');
      const manager = new (KnowledgeGraphManager as any)();

      const result = await manager.readGraph();
      expect(result.entities).toHaveLength(2);
      expect(result.relations).toHaveLength(1);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle malformed JSON in storage file', async () => {
      mockFs.readFile.mockResolvedValue('invalid json\n{malformed}');

      const { KnowledgeGraphManager } = await import('../index.js');
      const manager = new (KnowledgeGraphManager as any)();

      await expect(manager.readGraph()).rejects.toThrow();
    });

    it('should handle file system errors gracefully', async () => {
      mockFs.readFile.mockRejectedValue(new Error('Permission denied'));

      const { KnowledgeGraphManager } = await import('../index.js');
      const manager = new (KnowledgeGraphManager as any)();

      await expect(manager.readGraph()).rejects.toThrow('Permission denied');
    });

    it('should handle empty storage file', async () => {
      mockFs.readFile.mockResolvedValue('');

      const { KnowledgeGraphManager } = await import('../index.js');
      const manager = new (KnowledgeGraphManager as any)();

      const result = await manager.readGraph();
      expect(result.entities).toHaveLength(0);
      expect(result.relations).toHaveLength(0);
    });

    it('should handle storage file with only whitespace', async () => {
      mockFs.readFile.mockResolvedValue('  \n  \n  ');

      const { KnowledgeGraphManager } = await import('../index.js');
      const manager = new (KnowledgeGraphManager as any)();

      const result = await manager.readGraph();
      expect(result.entities).toHaveLength(0);
      expect(result.relations).toHaveLength(0);
    });
  });

  describe('Complex Scenarios', () => {
    it('should handle multiple entities and relations together', async () => {
      mockFs.readFile.mockRejectedValue({ code: 'ENOENT' });
      mockFs.writeFile.mockResolvedValue(undefined);

      const { KnowledgeGraphManager } = await import('../index.js');
      const manager = new (KnowledgeGraphManager as any)();

      // Create entities
      const entities = [
        { name: 'Alice', entityType: 'person', observations: ['developer'] },
        { name: 'Bob', entityType: 'person', observations: ['designer'] },
        { name: 'Project X', entityType: 'project', observations: ['active'] },
      ];
      await manager.createEntities(entities);

      // Create relations
      const relations = [
        { from: 'Alice', to: 'Project X', relationType: 'works_on' },
        { from: 'Bob', to: 'Project X', relationType: 'works_on' },
        { from: 'Alice', to: 'Bob', relationType: 'collaborates_with' },
      ];
      
      mockFs.readFile.mockResolvedValue(
        entities.map(e => JSON.stringify({ type: 'entity', ...e })).join('\n')
      );
      
      await manager.createRelations(relations);
      expect(mockFs.writeFile).toHaveBeenCalled();
    });

    it('should filter relations when searching to only include filtered entities', async () => {
      const existingData = [
        JSON.stringify({ type: 'entity', name: 'Alice', entityType: 'developer', observations: [] }),
        JSON.stringify({ type: 'entity', name: 'Bob', entityType: 'designer', observations: [] }),
        JSON.stringify({ type: 'entity', name: 'Charlie', entityType: 'manager', observations: [] }),
        JSON.stringify({ type: 'relation', from: 'Alice', to: 'Bob', relationType: 'works_with' }),
        JSON.stringify({ type: 'relation', from: 'Bob', to: 'Charlie', relationType: 'reports_to' }),
      ].join('\n');
      mockFs.readFile.mockResolvedValue(existingData);

      const { KnowledgeGraphManager } = await import('../index.js');
      const manager = new (KnowledgeGraphManager as any)();

      const result = await manager.searchNodes('developer');
      expect(result.entities).toHaveLength(1);
      // Relations should not include Bob to Charlie since only Alice was in search results
      expect(result.relations).toHaveLength(0);
    });
  });
});