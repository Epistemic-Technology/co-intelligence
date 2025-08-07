import { describe, it, expect } from 'vitest';
import { getDomainFromUrl, ensureSourceTitle } from '../url';

describe('url utilities', () => {
  describe('getDomainFromUrl', () => {
    it('should extract domain from valid HTTPS URL', () => {
      const result = getDomainFromUrl('https://www.example.com/path/to/page');
      expect(result).toBe('www.example.com');
    });

    it('should extract domain from valid HTTP URL', () => {
      const result = getDomainFromUrl('http://example.org/some/path');
      expect(result).toBe('example.org');
    });

    it('should extract domain without protocol', () => {
      const result = getDomainFromUrl('example.com/path');
      expect(result).toBe('example.com');
    });

    it('should handle URLs with www prefix', () => {
      const result = getDomainFromUrl('www.test-site.co.uk');
      expect(result).toBe('test-site.co.uk');
    });

    it('should handle URLs with ports', () => {
      const result = getDomainFromUrl('https://localhost:3000/api/endpoint');
      expect(result).toBe('localhost');
    });

    it('should fallback to manual parsing for invalid URLs', () => {
      const result = getDomainFromUrl('not-a-valid-url');
      expect(result).toBe('not-a-valid-url');
    });

    it('should handle empty string', () => {
      const result = getDomainFromUrl('');
      expect(result).toBe('');
    });

    it('should handle complex URLs with subdomains', () => {
      const result = getDomainFromUrl('https://api.subdomain.example.com/v1/data');
      expect(result).toBe('api.subdomain.example.com');
    });
  });

  describe('ensureSourceTitle', () => {
    it('should keep existing title when provided', () => {
      const source = { url: 'https://example.com', title: 'My Title' };
      const result = ensureSourceTitle(source);
      
      expect(result).toEqual({
        url: 'https://example.com',
        title: 'My Title'
      });
    });

    it('should trim whitespace from existing title', () => {
      const source = { url: 'https://example.com', title: '  My Title  ' };
      const result = ensureSourceTitle(source);
      
      expect(result).toEqual({
        url: 'https://example.com',
        title: 'My Title'
      });
    });

    it('should use domain as fallback when title is empty', () => {
      const source = { url: 'https://www.example.com/page', title: '' };
      const result = ensureSourceTitle(source);
      
      expect(result).toEqual({
        url: 'https://www.example.com/page',
        title: 'www.example.com'
      });
    });

    it('should use domain as fallback when title is only whitespace', () => {
      const source = { url: 'https://example.org/path', title: '   ' };
      const result = ensureSourceTitle(source);
      
      expect(result).toEqual({
        url: 'https://example.org/path',
        title: 'example.org'
      });
    });

    it('should use domain as fallback when title is missing', () => {
      const source = { url: 'https://test.com/api/data' };
      const result = ensureSourceTitle(source);
      
      expect(result).toEqual({
        url: 'https://test.com/api/data',
        title: 'test.com'
      });
    });

    it('should preserve other properties from source', () => {
      const source = { 
        url: 'https://example.com', 
        title: 'Test',
        customProp: 'value'
      } as any;
      const result = ensureSourceTitle(source);
      
      expect(result).toEqual({
        url: 'https://example.com',
        title: 'Test',
        customProp: 'value'
      });
    });
  });
});