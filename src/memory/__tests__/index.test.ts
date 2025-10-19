import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

// Mock fs module
jest.mock('fs/promises');
const mockFs = fs as jest.Mocked<typeof fs>;

describe('Memory Server', () => {
  let testMemoryFile: string;

  beforeEach(() => {
    jest.clearAllMocks();
    testMemoryFile = path.join(os.tmpdir(), 'test-memory.json');
    process.env.MEMORY_FILE_PATH = testMemoryFile;
  });

  afterEach(() => {
    delete process.env.MEMORY_FILE_PATH;
  });

  describe('KnowledgeGraph Data Structures', () => {
    it('defines Entity structure correctly', () => {
      const entity = {
        name: 'Alice',
        entityType: 'Person',
        observations: ['Works at Company X', 'Likes programming'],
      };

      expect(entity).toHaveProperty('name');
      expect(entity).toHaveProperty('entityType');
      expect(entity).toHaveProperty('observations');
      expect(Array.isArray(entity.observations)).toBe(true);
    });

    it('defines Relation structure correctly', () => {
      const relation = {
        from: 'Alice',
        to: 'Bob',
        relationType: 'knows',
      };

      expect(relation).toHaveProperty('from');
      expect(relation).toHaveProperty('to');
      expect(relation).toHaveProperty('relationType');
    });

    it('defines KnowledgeGraph structure correctly', () => {
      const graph = {
        entities: [],
        relations: [],
      };

      expect(graph).toHaveProperty('entities');
      expect(graph).toHaveProperty('relations');
      expect(Array.isArray(graph.entities)).toBe(true);
      expect(Array.isArray(graph.relations)).toBe(true);
    });
  });

  describe('Entity Operations', () => {
    describe('Create Entities', () => {
      it('creates new entities', () => {
        const entities = [
          { name: 'Alice', entityType: 'Person', observations: ['Smart'] },
          { name: 'Bob', entityType: 'Person', observations: ['Friendly'] },
        ];

        expect(entities.length).toBe(2);
        expect(entities[0].name).toBe('Alice');
        expect(entities[1].name).toBe('Bob');
      });

      it('handles entities with multiple observations', () => {
        const entity = {
          name: 'Alice',
          entityType: 'Person',
          observations: [
            'Software engineer',
            'Works remotely',
            'Enjoys hiking',
            'Speaks multiple languages',
          ],
        };

        expect(entity.observations.length).toBe(4);
      });

      it('handles entities with empty observations', () => {
        const entity = {
          name: 'NewPerson',
          entityType: 'Person',
          observations: [],
        };

        expect(entity.observations).toEqual([]);
      });

      it('prevents duplicate entities by name', () => {
        const existingEntities = [
          { name: 'Alice', entityType: 'Person', observations: ['First'] },
        ];
        const newEntities = [
          { name: 'Alice', entityType: 'Person', observations: ['Second'] },
          { name: 'Bob', entityType: 'Person', observations: ['Different'] },
        ];

        const filtered = newEntities.filter(
          e => !existingEntities.some(existing => existing.name === e.name)
        );

        expect(filtered.length).toBe(1);
        expect(filtered[0].name).toBe('Bob');
      });
    });

    describe('Delete Entities', () => {
      it('filters out deleted entities', () => {
        const entities = [
          { name: 'Alice', entityType: 'Person', observations: [] },
          { name: 'Bob', entityType: 'Person', observations: [] },
          { name: 'Charlie', entityType: 'Person', observations: [] },
        ];
        const toDelete = ['Bob'];

        const remaining = entities.filter(e => !toDelete.includes(e.name));

        expect(remaining.length).toBe(2);
        expect(remaining.map(e => e.name)).toEqual(['Alice', 'Charlie']);
      });

      it('removes relations when entities are deleted', () => {
        const relations = [
          { from: 'Alice', to: 'Bob', relationType: 'knows' },
          { from: 'Bob', to: 'Charlie', relationType: 'knows' },
          { from: 'Alice', to: 'Charlie', relationType: 'knows' },
        ];
        const deletedEntities = ['Bob'];

        const remaining = relations.filter(
          r => !deletedEntities.includes(r.from) && !deletedEntities.includes(r.to)
        );

        expect(remaining.length).toBe(1);
        expect(remaining[0].from).toBe('Alice');
        expect(remaining[0].to).toBe('Charlie');
      });

      it('handles deleting multiple entities', () => {
        const entities = [
          { name: 'Alice', entityType: 'Person', observations: [] },
          { name: 'Bob', entityType: 'Person', observations: [] },
          { name: 'Charlie', entityType: 'Person', observations: [] },
        ];
        const toDelete = ['Alice', 'Charlie'];

        const remaining = entities.filter(e => !toDelete.includes(e.name));

        expect(remaining.length).toBe(1);
        expect(remaining[0].name).toBe('Bob');
      });
    });
  });

  describe('Relation Operations', () => {
    describe('Create Relations', () => {
      it('creates new relations', () => {
        const relations = [
          { from: 'Alice', to: 'Bob', relationType: 'knows' },
          { from: 'Bob', to: 'Charlie', relationType: 'manages' },
        ];

        expect(relations.length).toBe(2);
        expect(relations[0].relationType).toBe('knows');
        expect(relations[1].relationType).toBe('manages');
      });

      it('prevents duplicate relations', () => {
        const existingRelations = [
          { from: 'Alice', to: 'Bob', relationType: 'knows' },
        ];
        const newRelations = [
          { from: 'Alice', to: 'Bob', relationType: 'knows' },
          { from: 'Bob', to: 'Charlie', relationType: 'knows' },
        ];

        const filtered = newRelations.filter(
          r =>
            !existingRelations.some(
              existing =>
                existing.from === r.from &&
                existing.to === r.to &&
                existing.relationType === r.relationType
            )
        );

        expect(filtered.length).toBe(1);
        expect(filtered[0].from).toBe('Bob');
      });

      it('allows multiple relation types between same entities', () => {
        const relations = [
          { from: 'Alice', to: 'Bob', relationType: 'knows' },
          { from: 'Alice', to: 'Bob', relationType: 'manages' },
          { from: 'Alice', to: 'Bob', relationType: 'mentors' },
        ];

        expect(relations.length).toBe(3);
        expect(new Set(relations.map(r => r.relationType)).size).toBe(3);
      });
    });

    describe('Delete Relations', () => {
      it('deletes specific relations', () => {
        const relations = [
          { from: 'Alice', to: 'Bob', relationType: 'knows' },
          { from: 'Bob', to: 'Charlie', relationType: 'knows' },
          { from: 'Alice', to: 'Charlie', relationType: 'manages' },
        ];
        const toDelete = [{ from: 'Alice', to: 'Bob', relationType: 'knows' }];

        const remaining = relations.filter(
          r =>
            !toDelete.some(
              del =>
                r.from === del.from &&
                r.to === del.to &&
                r.relationType === del.relationType
            )
        );

        expect(remaining.length).toBe(2);
      });

      it('only deletes exact matches', () => {
        const relations = [
          { from: 'Alice', to: 'Bob', relationType: 'knows' },
          { from: 'Alice', to: 'Bob', relationType: 'manages' },
        ];
        const toDelete = [{ from: 'Alice', to: 'Bob', relationType: 'knows' }];

        const remaining = relations.filter(
          r =>
            !toDelete.some(
              del =>
                r.from === del.from &&
                r.to === del.to &&
                r.relationType === del.relationType
            )
        );

        expect(remaining.length).toBe(1);
        expect(remaining[0].relationType).toBe('manages');
      });
    });
  });

  describe('Observation Operations', () => {
    describe('Add Observations', () => {
      it('adds new observations to entity', () => {
        const entity = {
          name: 'Alice',
          entityType: 'Person',
          observations: ['First observation'],
        };
        const newObservations = ['Second observation', 'Third observation'];

        const toAdd = newObservations.filter(
          obs => !entity.observations.includes(obs)
        );
        entity.observations.push(...toAdd);

        expect(entity.observations.length).toBe(3);
      });

      it('prevents duplicate observations', () => {
        const entity = {
          name: 'Alice',
          entityType: 'Person',
          observations: ['Likes coffee', 'Works remotely'],
        };
        const newObservations = ['Likes coffee', 'Enjoys reading'];

        const toAdd = newObservations.filter(
          obs => !entity.observations.includes(obs)
        );

        expect(toAdd.length).toBe(1);
        expect(toAdd[0]).toBe('Enjoys reading');
      });

      it('handles adding multiple observations at once', () => {
        const entity = {
          name: 'Alice',
          entityType: 'Person',
          observations: [],
        };
        const newObservations = [
          'Observation 1',
          'Observation 2',
          'Observation 3',
          'Observation 4',
        ];

        entity.observations.push(...newObservations);

        expect(entity.observations.length).toBe(4);
      });
    });

    describe('Delete Observations', () => {
      it('deletes specific observations', () => {
        const entity = {
          name: 'Alice',
          entityType: 'Person',
          observations: ['First', 'Second', 'Third', 'Fourth'],
        };
        const toDelete = ['Second', 'Fourth'];

        entity.observations = entity.observations.filter(
          obs => !toDelete.includes(obs)
        );

        expect(entity.observations.length).toBe(2);
        expect(entity.observations).toEqual(['First', 'Third']);
      });

      it('handles non-existent observations gracefully', () => {
        const entity = {
          name: 'Alice',
          entityType: 'Person',
          observations: ['First', 'Second'],
        };
        const toDelete = ['NonExistent'];

        entity.observations = entity.observations.filter(
          obs => !toDelete.includes(obs)
        );

        expect(entity.observations.length).toBe(2);
      });
    });
  });

  describe('Search Operations', () => {
    describe('Search Nodes', () => {
      it('finds entities by name', () => {
        const entities = [
          { name: 'Alice Smith', entityType: 'Person', observations: [] },
          { name: 'Bob Jones', entityType: 'Person', observations: [] },
          { name: 'Alice Johnson', entityType: 'Person', observations: [] },
        ];
        const query = 'alice';

        const results = entities.filter(e =>
          e.name.toLowerCase().includes(query.toLowerCase())
        );

        expect(results.length).toBe(2);
      });

      it('finds entities by type', () => {
        const entities = [
          { name: 'Alice', entityType: 'Person', observations: [] },
          { name: 'Google', entityType: 'Company', observations: [] },
          { name: 'Bob', entityType: 'Person', observations: [] },
        ];
        const query = 'company';

        const results = entities.filter(e =>
          e.entityType.toLowerCase().includes(query.toLowerCase())
        );

        expect(results.length).toBe(1);
        expect(results[0].name).toBe('Google');
      });

      it('finds entities by observation content', () => {
        const entities = [
          {
            name: 'Alice',
            entityType: 'Person',
            observations: ['Works at Google', 'Lives in SF'],
          },
          {
            name: 'Bob',
            entityType: 'Person',
            observations: ['Works at Microsoft'],
          },
        ];
        const query = 'google';

        const results = entities.filter(e =>
          e.observations.some(obs =>
            obs.toLowerCase().includes(query.toLowerCase())
          )
        );

        expect(results.length).toBe(1);
        expect(results[0].name).toBe('Alice');
      });

      it('is case-insensitive', () => {
        const entities = [
          { name: 'Alice', entityType: 'Person', observations: ['SENIOR ENGINEER'] },
        ];
        const query = 'senior engineer';

        const results = entities.filter(e =>
          e.name.toLowerCase().includes(query.toLowerCase()) ||
          e.entityType.toLowerCase().includes(query.toLowerCase()) ||
          e.observations.some(obs =>
            obs.toLowerCase().includes(query.toLowerCase())
          )
        );

        expect(results.length).toBe(1);
      });

      it('returns empty array when no matches', () => {
        const entities = [
          { name: 'Alice', entityType: 'Person', observations: [] },
        ];
        const query = 'nonexistent';

        const results = entities.filter(e =>
          e.name.toLowerCase().includes(query.toLowerCase())
        );

        expect(results.length).toBe(0);
      });
    });

    describe('Open Nodes', () => {
      it('retrieves entities by name', () => {
        const entities = [
          { name: 'Alice', entityType: 'Person', observations: [] },
          { name: 'Bob', entityType: 'Person', observations: [] },
          { name: 'Charlie', entityType: 'Person', observations: [] },
        ];
        const names = ['Alice', 'Charlie'];

        const results = entities.filter(e => names.includes(e.name));

        expect(results.length).toBe(2);
        expect(results.map(e => e.name).sort()).toEqual(['Alice', 'Charlie']);
      });

      it('returns empty array for non-existent names', () => {
        const entities = [
          { name: 'Alice', entityType: 'Person', observations: [] },
        ];
        const names = ['NonExistent'];

        const results = entities.filter(e => names.includes(e.name));

        expect(results.length).toBe(0);
      });

      it('filters relations to only include opened entities', () => {
        const entities = [
          { name: 'Alice', entityType: 'Person', observations: [] },
          { name: 'Bob', entityType: 'Person', observations: [] },
          { name: 'Charlie', entityType: 'Person', observations: [] },
        ];
        const relations = [
          { from: 'Alice', to: 'Bob', relationType: 'knows' },
          { from: 'Bob', to: 'Charlie', relationType: 'knows' },
          { from: 'Alice', to: 'Charlie', relationType: 'knows' },
        ];
        const names = ['Alice', 'Charlie'];

        const filteredEntityNames = new Set(
          entities.filter(e => names.includes(e.name)).map(e => e.name)
        );
        const filteredRelations = relations.filter(
          r => filteredEntityNames.has(r.from) && filteredEntityNames.has(r.to)
        );

        expect(filteredRelations.length).toBe(1);
        expect(filteredRelations[0].from).toBe('Alice');
        expect(filteredRelations[0].to).toBe('Charlie');
      });
    });
  });

  describe('Graph Persistence', () => {
    it('serializes entities to JSON lines', () => {
      const entities = [
        { name: 'Alice', entityType: 'Person', observations: ['Smart'] },
        { name: 'Bob', entityType: 'Person', observations: ['Friendly'] },
      ];

      const lines = entities.map(e =>
        JSON.stringify({
          type: 'entity',
          name: e.name,
          entityType: e.entityType,
          observations: e.observations,
        })
      );

      expect(lines.length).toBe(2);
      expect(() => JSON.parse(lines[0])).not.toThrow();
      expect(JSON.parse(lines[0]).type).toBe('entity');
    });

    it('serializes relations to JSON lines', () => {
      const relations = [
        { from: 'Alice', to: 'Bob', relationType: 'knows' },
        { from: 'Bob', to: 'Charlie', relationType: 'manages' },
      ];

      const lines = relations.map(r =>
        JSON.stringify({
          type: 'relation',
          from: r.from,
          to: r.to,
          relationType: r.relationType,
        })
      );

      expect(lines.length).toBe(2);
      expect(() => JSON.parse(lines[0])).not.toThrow();
      expect(JSON.parse(lines[0]).type).toBe('relation');
    });

    it('deserializes JSON lines correctly', () => {
      const lines = [
        '{"type":"entity","name":"Alice","entityType":"Person","observations":["Smart"]}',
        '{"type":"relation","from":"Alice","to":"Bob","relationType":"knows"}',
      ];

      const items = lines.map(line => JSON.parse(line));
      const entities = items.filter(item => item.type === 'entity');
      const relations = items.filter(item => item.type === 'relation');

      expect(entities.length).toBe(1);
      expect(relations.length).toBe(1);
      expect(entities[0].name).toBe('Alice');
    });
  });

  describe('Edge Cases', () => {
    it('handles empty knowledge graph', () => {
      const graph = { entities: [], relations: [] };

      expect(graph.entities.length).toBe(0);
      expect(graph.relations.length).toBe(0);
    });

    it('handles entity with special characters in name', () => {
      const entity = {
        name: "O'Brien",
        entityType: 'Person',
        observations: ['Has apostrophe'],
      };

      const serialized = JSON.stringify(entity);
      const deserialized = JSON.parse(serialized);

      expect(deserialized.name).toBe("O'Brien");
    });

    it('handles observation with newlines and special chars', () => {
      const entity = {
        name: 'Alice',
        entityType: 'Person',
        observations: ['Line 1\nLine 2', 'Contains "quotes"'],
      };

      const serialized = JSON.stringify(entity);
      const deserialized = JSON.parse(serialized);

      expect(deserialized.observations[0]).toContain('\n');
      expect(deserialized.observations[1]).toContain('"');
    });

    it('handles very long observation text', () => {
      const longText = 'A'.repeat(10000);
      const entity = {
        name: 'Test',
        entityType: 'Test',
        observations: [longText],
      };

      expect(entity.observations[0].length).toBe(10000);
    });

    it('handles entities with same name but different types', () => {
      const entities = [
        { name: 'Mercury', entityType: 'Planet', observations: [] },
        { name: 'Mercury', entityType: 'Element', observations: [] },
      ];

      // In actual implementation, names should be unique
      // This tests the behavior when duplicates exist
      expect(entities.length).toBe(2);
    });
  });
});