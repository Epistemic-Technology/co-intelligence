import { describe, it, expect, vi } from 'vitest';
import { screen } from '@solidjs/testing-library';
import userEvent from '@testing-library/user-event';
import { ProcessingIndicator } from '@/components/ProcessingIndicator';
import { render } from '../../../test/utils/render';

describe('ProcessingIndicator', () => {
  it('should render processing indicator with text', () => {
    render(() => <ProcessingIndicator />);
    
    expect(screen.getByText('Generating response...')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });

  it('should call onCancel when cancel button is clicked', async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    
    render(() => <ProcessingIndicator onCancel={onCancel} />);
    
    const cancelButton = screen.getByRole('button', { name: 'Cancel' });
    await user.click(cancelButton);
    
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('should render without onCancel prop', () => {
    render(() => <ProcessingIndicator />);
    
    const cancelButton = screen.getByRole('button', { name: 'Cancel' });
    expect(cancelButton).toBeInTheDocument();
  });

  it('should have correct CSS classes', () => {
    render(() => <ProcessingIndicator />);
    
    expect(document.querySelector('.coi-processing-indicator')).toBeInTheDocument();
    expect(document.querySelector('.coi-processing-spinner')).toBeInTheDocument();
    expect(document.querySelector('.coi-processing-text')).toBeInTheDocument();
    expect(document.querySelector('.coi-cancel-button')).toBeInTheDocument();
  });
});