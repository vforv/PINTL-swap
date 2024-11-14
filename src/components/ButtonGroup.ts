import { ButtonConfig } from "../types";

export class ButtonGroup extends HTMLElement {
    private buttons: ButtonConfig[];
    private clickHandler: (event: { action: string; value: string }) => void;
  
    constructor(buttons: ButtonConfig[], onButtonClick: (event: { action: string; value: string }) => void) {
      super();
      this.buttons = buttons;
      this.clickHandler = onButtonClick;
    }
  
    connectedCallback(): void {
      this.render();
      this.attachEventListeners();
    }
  
    private render(): void {
      this.innerHTML = `
        <div class="button-group">
          ${this.buttons.map(button => `
            <button 
              class="${button.class || 'token-button'}"
              data-action="${button.action}"
              data-value="${button.value || ''}"
            >
              ${button.text}
            </button>
          `).join('')}
        </div>
      `;
    }
  
    private attachEventListeners(): void {
      this.addEventListener('click', (e: Event) => {
        const button = (e.target as HTMLElement).closest('button');
        if (button instanceof HTMLButtonElement) {
          this.clickHandler({
            action: button.dataset.action || '',
            value: button.dataset.value || ''
          });
        }
      });
    }
  }
  
  customElements.define('button-group', ButtonGroup);