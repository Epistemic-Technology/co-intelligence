import { describe, it, expect, vi, beforeEach } from 'vitest';
import { 
  isCoiNote, 
  isPathCoiNote, 
  isActiveCoiNote, 
  isPathActiveCoiNote,
  sanitizeForTagName,
  serializeCoiNoteContent,
  deserializeCoiNoteContent
} from '../notes';
import { TFile, App } from 'obsidian';

describe('notes utilities', () => {
  let mockApp: App;
  let mockFile: TFile;

  beforeEach(() => {
    mockApp = new App();
    mockFile = new TFile('test.md');
  });

  describe('isCoiNote', () => {
    it('should return true for COI notes', () => {
      mockApp.metadataCache.getFileCache = vi.fn().mockReturnValue({
        frontmatter: { 'is-coi-chat': true }
      });

      const result = isCoiNote(mockFile, mockApp);
      expect(result).toBe(true);
    });

    it('should return false for non-COI notes', () => {
      mockApp.metadataCache.getFileCache = vi.fn().mockReturnValue({
        frontmatter: { 'is-coi-chat': false }
      });

      const result = isCoiNote(mockFile, mockApp);
      expect(result).toBe(false);
    });

    it('should return false when frontmatter is missing', () => {
      mockApp.metadataCache.getFileCache = vi.fn().mockReturnValue(null);

      const result = isCoiNote(mockFile, mockApp);
      expect(result).toBe(false);
    });
  });

  describe('isPathCoiNote', () => {
    it('should return true for COI note paths', () => {
      mockApp.metadataCache.getCache = vi.fn().mockReturnValue({
        frontmatter: { 'is-coi-chat': true }
      });

      const result = isPathCoiNote('test.md', mockApp);
      expect(result).toBe(true);
    });

    it('should return false for empty path', () => {
      const result = isPathCoiNote('', mockApp);
      expect(result).toBe(false);
    });
  });

  describe('isActiveCoiNote', () => {
    it('should return true for active COI notes', () => {
      mockApp.metadataCache.getFileCache = vi.fn().mockReturnValue({
        frontmatter: { 
          'is-coi-chat': true,
          'coi-chat-view': true
        }
      });

      const result = isActiveCoiNote(mockFile, mockApp);
      expect(result).toBe(true);
    });

    it('should return false for inactive COI notes', () => {
      mockApp.metadataCache.getFileCache = vi.fn().mockReturnValue({
        frontmatter: { 
          'is-coi-chat': true,
          'coi-chat-view': false
        }
      });

      const result = isActiveCoiNote(mockFile, mockApp);
      expect(result).toBe(false);
    });
  });

  describe('isPathActiveCoiNote', () => {
    it('should return true for active COI note paths', () => {
      mockApp.metadataCache.getCache = vi.fn().mockReturnValue({
        frontmatter: { 
          'is-coi-chat': true,
          'coi-chat-view': true
        }
      });

      const result = isPathActiveCoiNote('test.md', mockApp);
      expect(result).toBe(true);
    });

    it('should return false for empty path', () => {
      const result = isPathActiveCoiNote('', mockApp);
      expect(result).toBe(false);
    });
  });

  describe('sanitizeForTagName', () => {
    it('should sanitize special characters', () => {
      const result = sanitizeForTagName('Hello World!@#$%');
      expect(result).toBe('hello-world');
    });

    it('should preserve alphanumeric and allowed characters', () => {
      const result = sanitizeForTagName('test_tag-123');
      expect(result).toBe('test_tag-123');
    });

    it('should remove leading and trailing dashes', () => {
      const result = sanitizeForTagName('--test-tag--');
      expect(result).toBe('test-tag');
    });

    it('should collapse multiple dashes', () => {
      const result = sanitizeForTagName('test---multiple--dashes');
      expect(result).toBe('test-multiple-dashes');
    });

    it('should handle empty string', () => {
      const result = sanitizeForTagName('');
      expect(result).toBe('');
    });

    it('should trim whitespace', () => {
      const result = sanitizeForTagName('  test tag  ');
      expect(result).toBe('test-tag');
    });
  });

  describe('serializeCoiNoteContent', () => {
    it('should serialize basic chat messages', async () => {
      const currentContent = '<!-- CHAT-THREAD-START -->\n\n<!-- CHAT-THREAD-END -->';
      const messages = [
        { role: 'user' as const, content: 'Hello' },
        { role: 'assistant' as const, content: 'Hi there!' }
      ];

      const result = await serializeCoiNoteContent(currentContent, mockApp, messages, null);
      
      expect(result).toContain('## user:\n\nHello');
      expect(result).toContain('## assistant:\n\nHi there!');
    });

    it('should include sources when provided', async () => {
      const currentContent = '<!-- CHAT-THREAD-START -->\n\n<!-- CHAT-THREAD-END -->';
      const messages = [
        { role: 'user' as const, content: 'Question' }
      ];
      const sources = [
        { title: 'Test Source', url: 'https://example.com' }
      ];

      const result = await serializeCoiNoteContent(currentContent, mockApp, messages, null, sources);
      
      expect(result).toContain('## Sources');
      expect(result).toContain('1. [Test Source](https://example.com)');
    });

    it('should preserve content before and after chat section', async () => {
      const currentContent = 'Before\n<!-- CHAT-THREAD-START -->\n\n<!-- CHAT-THREAD-END -->\nAfter';
      const messages = [
        { role: 'user' as const, content: 'Test' }
      ];

      const result = await serializeCoiNoteContent(currentContent, mockApp, messages, null);
      
      expect(result.startsWith('Before')).toBe(true);
      expect(result.endsWith('After')).toBe(true);
    });

    it('should adjust header levels in content', async () => {
      const currentContent = '<!-- CHAT-THREAD-START -->\n\n<!-- CHAT-THREAD-END -->';
      const messages = [
        { role: 'user' as const, content: '# Main Header\n## Sub Header' }
      ];

      const result = await serializeCoiNoteContent(currentContent, mockApp, messages, null);
      
      expect(result).toContain('### Main Header');
      expect(result).toContain('#### Sub Header');
    });
  });

  describe('deserializeCoiNoteContent', () => {
    it('should deserialize basic chat messages', async () => {
      const content = `
<!-- CHAT-THREAD-START -->
## user:

Hello

## assistant:

Hi there!
<!-- CHAT-THREAD-END -->
      `.trim();

      const result = await deserializeCoiNoteContent(content, null, mockApp);
      
      expect(result.messages).toHaveLength(2);
      expect(result.messages[0]).toEqual({ role: 'user', content: 'Hello' });
      expect(result.messages[1]).toEqual({ role: 'assistant', content: 'Hi there!' });
    });

    it('should deserialize sources', async () => {
      const content = `
<!-- CHAT-THREAD-START -->
## user:

Question

## Sources

1. [Test Source](https://example.com)
2. [Another Source](https://test.com)
<!-- CHAT-THREAD-END -->
      `.trim();

      const result = await deserializeCoiNoteContent(content, null, mockApp);
      
      expect(result.sources).toHaveLength(2);
      expect(result.sources[0]).toEqual({ title: 'Test Source', url: 'https://example.com' });
      expect(result.sources[1]).toEqual({ title: 'Another Source', url: 'https://test.com' });
    });

    it('should return empty result when no chat section found', async () => {
      const content = 'Regular note content without chat section';

      const result = await deserializeCoiNoteContent(content, null, mockApp);
      
      expect(result.messages).toHaveLength(0);
      expect(result.sources).toHaveLength(0);
      expect(result.contextItems).toEqual({ notes: [], tags: [], sources: [] });
    });

    it('should handle context items from frontmatter', async () => {
      const content = '<!-- CHAT-THREAD-START -->\n<!-- CHAT-THREAD-END -->';
      const metadata = {
        frontmatter: {
          'linked-notes': ['note1.md', 'note2.md'],
          'linked-tags': ['#tag1', '#tag2']
        }
      };

      // Mock files for linked notes
      mockApp.vault.getAbstractFileByPath = vi.fn()
        .mockReturnValueOnce(new TFile('note1.md'))
        .mockReturnValueOnce(new TFile('note2.md'));

      const result = await deserializeCoiNoteContent(content, metadata, mockApp);
      
      expect(result.contextItems.notes).toHaveLength(2);
      expect(result.contextItems.tags).toEqual(['#tag1', '#tag2']);
    });
  });
});