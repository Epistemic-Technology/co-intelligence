import { render as solidRender } from '@solidjs/testing-library';
import { JSX } from 'solid-js';

// Custom render function with default providers if needed
export const render = (component: () => JSX.Element) => {
  return solidRender(component);
};