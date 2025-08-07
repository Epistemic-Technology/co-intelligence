import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TFile, App } from 'obsidian';
import {
  getContext,
  makeContext,
  contextTokenEstimate
} from '@/utils/model-context';
import { ContextItems, ContextItemContent, Source } from '@/types';

// Mock Obsidian functions
vi.mock('obsidian', async () => {
  const actual = await vi.importActual('obsidian');
  return {
    ...actual,
    requestUrl: vi.fn(),
    htmlToMarkdown: vi.fn(),
    TFile: class MockTFile {
      name: string;
      path: string;
      basename: string;
      extension: string;
      
      constructor(path: string) {
        this.name = path.split('/').pop() || '';
        this.path = path;
        this.basename = this.name.replace(/\.[^/.]+$/, '');
        this.extension = path.split('.').pop() || '';
      }
    }
  };
});

// Mock the notes utility
vi.mock('@/utils/notes', () => ({
  getFilesWithTag: vi.fn()
}));

import { requestUrl, htmlToMarkdown } from 'obsidian';
import { getFilesWithTag } from '@/utils/notes';

describe('model-context utilities', () => {
  let mockApp: App;
  let mockFile1: TFile;
  let mockFile2: TFile;

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockFile1 = {
      name: 'note1.md',
      path: 'notes/note1.md',
      basename: 'note1',
      extension: 'md',
      vault: null,
      parent: null,
      stat: { ctime: 0, mtime: 0, size: 0 }
    } as any;

    mockFile2 = {
      name: 'note2.md',
      path: 'notes/note2.md',
      basename: 'note2',
      extension: 'md',
      vault: null,
      parent: null,
      stat: { ctime: 0, mtime: 0, size: 0 }
    } as any;

    mockApp = {
      vault: {
        cachedRead: vi.fn()
      },
      metadataCache: {
        getFileCache: vi.fn(),
        getCache: vi.fn()
      }
    } as any;
  });

  describe('makeContext', () => {
    it('should create context string from array of context items', () => {
      const contextItems: ContextItemContent[] = [
        { title: 'Note 1', content: 'Content of first note' },
        { title: 'Note 2', content: 'Content of second note' }
      ];

      const result = makeContext(contextItems);

      expect(result).toBe(
        '--- Note: Note 1 ---\nContent of first note\n---\n\n--- Note: Note 2 ---\nContent of second note\n---'
      );
    });

    it('should return empty string for empty array', () => {
      const result = makeContext([]);
      expect(result).toBe('');
    });

    it('should handle single context item', () => {
      const contextItems: ContextItemContent[] = [
        { title: 'Single Note', content: 'Single note content' }
      ];

      const result = makeContext(contextItems);

      expect(result).toBe('--- Note: Single Note ---\nSingle note content\n---');
    });

    it('should handle context items with special characters', () => {
      const contextItems: ContextItemContent[] = [
        { title: 'Note with: Special & Characters', content: 'Content with\n\nmultiple\nlines' }
      ];

      const result = makeContext(contextItems);

      expect(result).toContain('--- Note: Note with: Special & Characters ---');
      expect(result).toContain('Content with\n\nmultiple\nlines');
    });

    it('should handle empty content', () => {
      const contextItems: ContextItemContent[] = [
        { title: 'Empty Note', content: '' }
      ];

      const result = makeContext(contextItems);

      expect(result).toBe('--- Note: Empty Note ---\n\n---');
    });
  });

  describe('getContext', () => {
    it('should return empty array when items is null', async () => {
      const result = await getContext(null, mockApp);
      expect(result).toEqual([]);
    });

    it('should process notes from ContextItems', async () => {
      const contextItems: ContextItems = {
        notes: [mockFile1, mockFile2],
        tags: [],
        sources: []
      };

      mockApp.vault.cachedRead = vi.fn()
        .mockResolvedValueOnce('Content of note 1')
        .mockResolvedValueOnce('Content of note 2');

      const result = await getContext(contextItems, mockApp);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        title: 'note1.md',
        content: 'Content of note 1'
      });
      expect(result[1]).toEqual({
        title: 'note2.md',
        content: 'Content of note 2'
      });
    });

    it('should process tags and get associated files', async () => {
      const contextItems: ContextItems = {
        notes: [],
        tags: ['#important', '#work'],
        sources: []
      };

      const tagFile1 = { ...mockFile1, name: 'tagged1.md' };
      const tagFile2 = { ...mockFile2, name: 'tagged2.md' };

      (getFilesWithTag as any)
        .mockReturnValueOnce([tagFile1])
        .mockReturnValueOnce([tagFile2]);

      mockApp.vault.cachedRead = vi.fn()
        .mockResolvedValueOnce('Content of tagged note 1')
        .mockResolvedValueOnce('Content of tagged note 2');

      const result = await getContext(contextItems, mockApp);

      expect(getFilesWithTag).toHaveBeenCalledWith('#important', mockApp);
      expect(getFilesWithTag).toHaveBeenCalledWith('#work', mockApp);
      expect(result).toHaveLength(2);
    });

    it('should process sources and fetch web content', async () => {
      const contextItems: ContextItems = {
        notes: [],
        tags: [],
        sources: [
          { url: 'https://example.com', title: 'Example Site' },
          { url: 'https://test.com' } // No title provided
        ]
      };

      (requestUrl as any)
        .mockResolvedValueOnce({ text: '<html><body>Example content</body></html>' })
        .mockResolvedValueOnce({ text: '<html><body>Test content</body></html>' });

      (htmlToMarkdown as any)
        .mockReturnValueOnce('Example content')
        .mockReturnValueOnce('Test content');

      const result = await getContext(contextItems, mockApp);

      expect(requestUrl).toHaveBeenCalledWith({ url: 'https://example.com' });
      expect(requestUrl).toHaveBeenCalledWith({ url: 'https://test.com' });
      expect(htmlToMarkdown).toHaveBeenCalledTimes(2);
      
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        title: 'Example Site',
        content: 'Example content'
      });
      expect(result[1]).toEqual({
        title: 'https://test.com',
        content: 'Test content'
      });
    });

    it('should handle mixed context items (notes, tags, sources)', async () => {
      const taggedFile = { ...mockFile1, name: 'tagged.md' };
      
      const contextItems: ContextItems = {
        notes: [mockFile1],
        tags: ['#important'],
        sources: [{ url: 'https://example.com', title: 'Example' }]
      };

      (getFilesWithTag as any).mockReturnValueOnce([taggedFile]);

      mockApp.vault.cachedRead = vi.fn()
        .mockResolvedValueOnce('Direct note content')
        .mockResolvedValueOnce('Tagged note content');

      (requestUrl as any).mockResolvedValueOnce({ text: '<html>Web content</html>' });
      (htmlToMarkdown as any).mockReturnValueOnce('Web content');

      const result = await getContext(contextItems, mockApp);

      expect(result).toHaveLength(3);
      expect(result[0].title).toBe('note1.md');
      expect(result[1].title).toBe('tagged.md');
      expect(result[2].title).toBe('Example');
    });

    it('should handle duplicate files from notes and tags', async () => {
      const contextItems: ContextItems = {
        notes: [mockFile1],
        tags: ['#important'],
        sources: []
      };

      // Tag search returns the same file that's already in notes
      (getFilesWithTag as any).mockReturnValueOnce([mockFile1]);

      mockApp.vault.cachedRead = vi.fn()
        .mockResolvedValueOnce('Note content first time')
        .mockResolvedValueOnce('Note content second time');

      const result = await getContext(contextItems, mockApp);

      // Should include the file twice since it's in both notes and found via tags
      expect(result).toHaveLength(2);
      expect(result[0].title).toBe('note1.md');
      expect(result[1].title).toBe('note1.md');
    });

    it('should handle empty file content', async () => {
      const contextItems: ContextItems = {
        notes: [mockFile1],
        tags: [],
        sources: []
      };

      mockApp.vault.cachedRead = vi.fn().mockResolvedValueOnce('');

      const result = await getContext(contextItems, mockApp);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        title: 'note1.md',
        content: ''
      });
    });

    it('should handle vault read failures gracefully', async () => {
      const contextItems: ContextItems = {
        notes: [mockFile1],
        tags: [],
        sources: []
      };

      mockApp.vault.cachedRead = vi.fn().mockResolvedValueOnce(null);

      const result = await getContext(contextItems, mockApp);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        title: 'note1.md',
        content: ''
      });
    });
  });

  describe('contextTokenEstimate', () => {
    it('should estimate tokens for context items', async () => {
      const contextItems: ContextItems = {
        notes: [mockFile1],
        tags: [],
        sources: []
      };

      // Mock content that's 100 characters long
      const content = 'a'.repeat(100);
      mockApp.vault.cachedRead = vi.fn().mockResolvedValueOnce(content);

      const result = await contextTokenEstimate(contextItems, mockApp);

      // Should be approximately content.length / 4 = 100 / 4 = 25
      expect(result).toBe(25);
    });

    it('should sum tokens from multiple context items', async () => {
      const contextItems: ContextItems = {
        notes: [mockFile1, mockFile2],
        tags: [],
        sources: []
      };

      mockApp.vault.cachedRead = vi.fn()
        .mockResolvedValueOnce('a'.repeat(80))  // 20 tokens
        .mockResolvedValueOnce('b'.repeat(120)); // 30 tokens

      const result = await contextTokenEstimate(contextItems, mockApp);

      expect(result).toBe(50); // 20 + 30
    });

    it('should handle empty content', async () => {
      const contextItems: ContextItems = {
        notes: [mockFile1],
        tags: [],
        sources: []
      };

      mockApp.vault.cachedRead = vi.fn().mockResolvedValueOnce('');

      const result = await contextTokenEstimate(contextItems, mockApp);

      expect(result).toBe(0);
    });

    it('should include tokens from all context types', async () => {
      const taggedFile = { ...mockFile1, name: 'tagged.md' };
      
      const contextItems: ContextItems = {
        notes: [mockFile1],
        tags: ['#test'],
        sources: [{ url: 'https://example.com', title: 'Example' }]
      };

      (getFilesWithTag as any).mockReturnValueOnce([taggedFile]);

      mockApp.vault.cachedRead = vi.fn()
        .mockResolvedValueOnce('a'.repeat(40))   // 10 tokens
        .mockResolvedValueOnce('b'.repeat(80));  // 20 tokens

      (requestUrl as any).mockResolvedValueOnce({ text: '<html>content</html>' });
      (htmlToMarkdown as any).mockReturnValueOnce('c'.repeat(120)); // 30 tokens

      const result = await contextTokenEstimate(contextItems, mockApp);

      expect(result).toBe(60); // 10 + 20 + 30
    });
  });
});