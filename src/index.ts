// Re-export components and types
export * from './types';
export * from './components/TokenSwapChat';

// Initialize any global setup
import { TokenSwapChat } from './components/TokenSwapChat';

// Ensure component is defined only once
if (!customElements.get('token-swap-chat')) {
  customElements.define('token-swap-chat', TokenSwapChat);
}