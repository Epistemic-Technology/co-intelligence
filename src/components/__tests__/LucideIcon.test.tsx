import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@solidjs/testing-library';
import { LucideIcon } from '@/components/LucideIcon';
import { render } from '../../../test/utils/render';

// Mock the setIcon function from Obsidian
vi.mock('obsidian', () => ({
  setIcon: vi.fn(),
}));

describe('LucideIcon', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render with correct CSS class', () => {
    render(() => <LucideIcon name="settings" />);
    
    expect(document.querySelector('.coi-lucide-icon')).toBeInTheDocument();
  });

  it('should call setIcon with correct parameters on mount', async () => {
    const { setIcon } = await import('obsidian');
    render(() => <LucideIcon name="home" />);
    
    // Wait for onMount to be called
    await new Promise(resolve => setTimeout(resolve, 0));
    
    expect(setIcon).toHaveBeenCalledTimes(1);
    expect(setIcon).toHaveBeenCalledWith(
      expect.any(HTMLElement),
      'home'
    );
  });

  it('should render different icons with different names', async () => {
    const { setIcon } = await import('obsidian');
    const { unmount } = render(() => <LucideIcon name="star" />);
    
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(setIcon).toHaveBeenCalledWith(expect.any(HTMLElement), 'star');
    
    unmount();
    vi.clearAllMocks();
    
    render(() => <LucideIcon name="heart" />);
    
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(setIcon).toHaveBeenCalledWith(expect.any(HTMLElement), 'heart');
  });
});