import { SwapController } from "../controllers/SwapController";
import { ITokenService } from "../interfaces/ITokenService";
import { KaswareStateManager } from "../services/KaswareStateManager";
import { KaswareStateManagerAdapter } from "../services/KaswareStateManagerAdapter";
import {
  MessageData,
  MessageType,
  KaswareState,
  SwapStep,
  Token,
  TokenSwapTheme,
  TokenSwapTextConfig,
  TokenSwapConfig,
  MessageButtons,
} from "../types";

export class TokenSwapChat extends HTMLElement {
  public readonly shadowRoot!: ShadowRoot;
  private readonly controller: SwapController;
  private readonly messages: MessageData[] = [];
  private readonly kaswareState: KaswareStateManager;
  private readonly tokenService: ITokenService;
  private isInitialized = false;
  private _stateChangeHandler?: EventListener;
  private config: TokenSwapConfig = {
    defaultTokens: [], // Will show all tokens if empty
    defaultBuyToken: undefined,
  };

  private textConfig: TokenSwapTextConfig = {
    title: "Prophet Swap",
    subtitle: "Available commands: /swap, /buy",
    connectMessage: "Please connect your KASWARE wallet to start trading",
    disconnectMessage:
      "Wallet disconnected. Please connect your wallet to continue.",
    inputPlaceholder: "Type a command or message...",
    connectButtonText: "Connect KASWARE Wallet",
    confirmButtonText: "Confirm",
    cancelButtonText: "Cancel",
  };

  static readonly templateContent: string = TokenSwapChat.getTemplateContent();

  static get observedAttributes(): string[] {
    return [
      "theme",
      "disabled",
      "title",
      "subtitle",
      "connect-message",
      "disconnect-message",
      "input-placeholder",
      "connect-button-text",
      "confirm-button-text",
      "cancel-button-text",
      "default-tokens",
      "default-buy-token",
    ];
  }

  constructor() {
    super();
    const shadow = this.attachShadow({ mode: "open" });
    this.kaswareState = KaswareStateManager.getInstance();
    this.tokenService = new KaswareStateManagerAdapter(this.kaswareState);
    this.controller = new SwapController(this.tokenService);

    const template = document.createElement("template");
    template.innerHTML = TokenSwapChat.getTemplateContent();
    shadow.appendChild(template.content.cloneNode(true));

    // Wait for DOM to be completely loaded
    window.addEventListener("load", () => {
      // Initialize content after DOM is ready
      this.initializeContent();
      void this.initialize();
      this.controller.startStatusCheck().then()
    });
  }

  private async initialize(): Promise<void> {
    if (this.isInitialized) return;
  
    try {
      await this.checkKaswareAvailability();
      this.setupEventListeners();
      this.isInitialized = true;
      
      // Show default buy option if wallet is connected
      const state = this.kaswareState.getState();
      if (state.isConnected) {
        this.showDefaultBuyOption();
      }
    } catch (error) {
      this.handleError(error);
    }
  }
  public configure(config: TokenSwapConfig): void {
    this.config = {
      ...this.config,
      ...config,
    };
  }

  private async checkKaswareAvailability(): Promise<void> {
    try {
      const provider = window.kasware;
      if (!provider) {
        throw new Error('Kasware provider not found');
      }

      const accounts = await provider.getAccounts();
      if (accounts && accounts.length > 0) {
        await this.kaswareState.connectWallet();
        // Remove this line as we don't need additional check
        // await this.checkWalletConnection();
      } else {
        const previousConnection = localStorage.getItem('kasware_connection');
        if (previousConnection) {
          try {
            await this.kaswareState.connectWallet();
          } catch (error) {
            localStorage.removeItem('kasware_connection');
            console.error('Failed to restore connection:', error);
          }
        }
      }
    } catch (error) {
      console.error('Kasware availability check failed:', error);
    }

    // Single check at the end
    await this.checkWalletConnection();
}

  private checkWalletConnection(): void {
    const state = this.kaswareState.getState();
    this.updateInputState(state.isConnected);
    
    // Clear existing messages first
    this.removeConnectionMessages();

    // Add single connection status message
    this.addMessage({
      id: Date.now(),
      type: MessageType.BOT,
      text: state.isConnected && state.account 
        ? `Connected to wallet: ${state.account}`
        : (this.textConfig as any).connectMessage,
      buttons: {
        type: 'connect_wallet',
        data: { action: state.isConnected ? 'disconnect' : 'connect' }
      }
    });

    // Add single quick actions message
    if(!state.isConnected) {
      this.addMessage({
        id: Date.now(),
        type: MessageType.BOT,
        text: "Quick buy option:",
        buttons: {
          type: 'quick_buy',
          symbol: this.config.defaultBuyToken || 'PINTL'
        }
      });
    }
    
}

  private async setupEventListeners() {
    // Setup controller events
    this.controller.on("message", (message: MessageData) => {
      this.addMessage(message);
    });

    this.controller.on("error", (error: MessageData) => {
      this.addMessage(error);
    });

    // Setup KaswareState events
    const handleStateChange = async (e: Event) => {
      const event = e as CustomEvent<KaswareState>;
      await this.handleKaswareStateChange(event.detail);
    };

    this._stateChangeHandler = handleStateChange;
    this.kaswareState.addEventListener(
      "stateChanged",
      this._stateChangeHandler
    );

    // Setup provider events if available
    const provider = (window as any).kasware;
    if (provider) {
      provider.on("accountsChanged", async (accounts: string[]) => {
        if (accounts.length === 0) {
          // User disconnected wallet
          await this.disconnect();
        } else {
          // Account changed, update connection
          await this.kaswareState.connectWallet();
        }
      });

      provider.on("chainChanged", async () => {
        // Chain changed, refresh connection
        await this.kaswareState.connectWallet();
      });

      provider.on("disconnect", async () => {
        await this.disconnect();
      });
    }

    // Setup DOM events
    const form = this.shadowRoot?.querySelector("form");
    const input = this.shadowRoot?.querySelector("input");

    if (!form || !input) {
      throw new Error("Required elements not found in shadow DOM");
    }

    form.addEventListener("submit", this.handleSubmit.bind(this));
    this.shadowRoot?.addEventListener("click", this.handleClick.bind(this));
  }

  private handleConnectMessageChange(): void {
    // Find any existing connect messages and update them
    const messages = this.messages;
    const connectMessageIndex = messages.findIndex(
      (msg) =>
        msg.type === MessageType.BOT && msg.buttons?.type === "connect_wallet"
    );

    if (connectMessageIndex !== -1) {
      // Update existing connect message
      messages[connectMessageIndex] = {
        id: Date.now(),
        type: MessageType.BOT,
        text: (this.textConfig as any).connectMessage,
        buttons: {
          type: "connect_wallet",
          data: { action: "connect" },
        },
      };
      this.updateMessages();
    }
  }
 
  private async handleKaswareStateChange(state: KaswareState): Promise<void> {
    if (state.isConnected && state.account) {
      localStorage.setItem('kasware_connection', 'true');
    } else {
      localStorage.removeItem('kasware_connection');
    }

    // Clear existing messages
    this.removeConnectionMessages();

    // Add single connection status message with quick actions
    this.addMessage({
      id: Date.now(),
      type: MessageType.BOT,
      text: !state.isConnected ? this.textConfig.disconnectMessage : 
            state.account ? `Connected to wallet: ${state.account}` : (this.textConfig as any).connectMessage,
      buttons: {
        type: 'connect_wallet',
        data: { action: state.isConnected ? 'disconnect' : 'connect' }
      }
    });

    // Add quick actions in one message
    this.addMessage({
      id: Date.now(),
      type: MessageType.BOT,
      text: "Quick buy option:",
      buttons: {
        type: 'quick_buy',
        symbol: this.config.defaultBuyToken || 'PINTL'
      }
    });

    this.updateInputState(state.isConnected);
}

  private updateInputState(isConnected: boolean): void {
    const input = this.shadowRoot?.querySelector("input");
    const submitButton = this.shadowRoot?.querySelector(
      'button[type="submit"]'
    );

    if (input && submitButton) {
      if (!isConnected) {
        input.setAttribute("disabled", "");
        submitButton.setAttribute("disabled", "");
        input.placeholder = (this.textConfig as any).connectMessage;
      } else {
        input.removeAttribute("disabled");
        submitButton.removeAttribute("disabled");
        input.placeholder = (this.textConfig as any).inputPlaceholder;
      }
    }
  }

  private removeConnectionMessages(): void {
    // Remove existing connection/disconnection related messages and quick buy options
    const length = this.messages.length;
    for (let i = length - 1; i >= 0; i--) {
      const msg = this.messages[i];
      const isConnectionMessage = 
        msg.type === MessageType.BOT && 
        (msg.text.includes('Connected to wallet:') ||
         msg.text === this.textConfig.connectMessage ||
         msg.text === this.textConfig.disconnectMessage ||
         msg.text === "Quick buy option:" ||  // Add this line
         msg.buttons?.type === 'quick_buy');  // Add this line
      
      if (isConnectionMessage) {
        this.messages.splice(i, 1);
      }
    }
}

  private async handleSubmit(event: Event): Promise<void> {
    event.preventDefault();

    const state = this.kaswareState.getState();
    if (!state.isConnected) {
      this.addMessage({
        id: Date.now(),
        type: MessageType.BOT,
        text: "Please connect your wallet first",
        buttons: {
          type: "connect_wallet",
          data: { action: "connect" },
        },
      });
      return;
    }

    const form = event.target as HTMLFormElement;
    const input = form.querySelector("input");

    if (!input) return;

    const value = input.value.trim();
    if (!value) return;

    input.value = "";

    this.addMessage({
      id: Date.now(),
      type: MessageType.USER,
      text: value,
    });

    if (value.startsWith("/")) {
      await this.controller.handleCommand(value);
    } else {
      await this.handleUserInput(value);
    }
  }

  private async handleClick(event: Event): Promise<void> {
    const target = event.target as HTMLElement;
    const button = target.closest("button[data-action]");

    if (!button) return;

    const action = button.getAttribute("data-action");
    const value = button.getAttribute("data-value");

    if (!action) return;

    if (!this.kaswareState.getState().isConnected && (action === 'command' || action === 'quick-buy')) {
      this.addMessage({
        id: Date.now(),
        type: MessageType.BOT,
        text: 'Please connect your wallet first',
        buttons: {
          type: 'connect_wallet',
          data: { action: 'connect' }
        }
      });
      return;
    }

    if (action === 'command' && value) {
      await this.controller.handleCommand(value);
      return;
    }

    if (action === 'quick-buy') {
      if (value) {
        await this.controller.handleCommand(`/buy ${value}`);
      }
      return;
    }

    if (action === "connect_wallet") {
      try {
        await this.kaswareState.connectWallet();
      } catch (error) {
        this.handleError(error);
      }
      return;
    }

    if (action === "disconnect_wallet") {
      try {
        await this.disconnect();
      } catch (error) {
        this.handleError(error);
      }
      return;
    }

    if (value) {
      await this.controller.handleAction(action, value);
    }
  }

  private async handleUserInput(value: string): Promise<void> {
    try {
      const state = this.controller.getState();

      // Handle amount input
      if (state.step === SwapStep.AMOUNT || state.step === SwapStep.BUY_AMOUNT) {
        const amount = parseFloat(value);
        if (isNaN(amount) || amount <= 0) {
          this.addMessage({
            id: Date.now(),
            type: MessageType.BOT,
            text: "Please enter a valid positive number.",
          });
          return;
        }
        await this.controller.handleAmount(amount);
        return;
      }

      // Handle token input
      if (state.step === SwapStep.FROM_TOKEN || 
          state.step === SwapStep.TO_TOKEN || 
          state.step === SwapStep.BUY_TOKEN) {
        
        const token = value.toUpperCase();
        const availableTokens = await this.tokenService.getTokens();
        const tokenExists = availableTokens.some(t => t.symbol === token);

        if (!tokenExists) {
          this.addMessage({
            id: Date.now(),
            type: MessageType.BOT,
            text: `Token ${token} not found. Available tokens: ${availableTokens.map(t => t.symbol).join(', ')}`
          });
          return;
        }

        // Check if token is valid for current step
        if (state.step === SwapStep.TO_TOKEN && token === state.fromToken) {
          this.addMessage({
            id: Date.now(),
            type: MessageType.BOT,
            text: "Cannot swap to the same token. Please choose a different token."
          });
          return;
        }

        if (state.step === SwapStep.BUY_TOKEN && token === 'KAS') {
          this.addMessage({
            id: Date.now(),
            type: MessageType.BOT,
            text: "Cannot buy KAS token directly. Please choose a different token."
          });
          return;
        }

        await this.controller.handleAction('select-token', token);
      }
    } catch (error) {
      this.handleError(error);
    }
}

  private addMessage(message: MessageData): void {
    this.messages.push(message);
    this.updateMessages();
    this.scrollToBottom();
  }

  private updateMessages(): void {
    const container = this.shadowRoot?.querySelector(".chat-messages");
    if (!container) return;

    requestAnimationFrame(() => {
      container.innerHTML = this.messages
        .map((message) => this.createMessageElement(message))
        .join("");
    });
  }

  private createMessageElement(message: MessageData): string {
    const messageClass = message.type === MessageType.USER ? "user" : "bot";
    const buttons = message.buttons ? this.createButtonsMarkup(message.buttons) : "";
    
    let messageText = message.text || '';
    const isHTML = typeof messageText === 'string' && (
      messageText.includes('quote-summary') || 
      messageText.includes('<a href') ||
      messageText.trim().startsWith('<')
    );
    
    return `
      <div class="message ${messageClass}" part="message-${messageClass}">
        <div class="message-text" part="message-text">
          ${isHTML ? messageText : this.escapeHtml(messageText)}
        </div>
        ${buttons}
      </div>
    `;
  }
  private createButtonsMarkup(buttons: MessageButtons): string {
    switch (buttons.type) {
      case "token_select":
        return buttons.tokens
          ? this.createTokenButtonsMarkup(buttons.tokens)
          : "";
      case 'quick_buy':
        return buttons.symbol ? this.createQuickBuyMarkup(buttons.symbol) : '';
      case "confirm":
        return this.createConfirmButtonsMarkup();
      case "connect_wallet":
        const state = this.kaswareState.getState();
        return state.isConnected
          ? this.createDisconnectButtonMarkup()
          : this.createConnectButtonMarkup();
      default:
        return "";
    }
  }
  private createQuickBuyMarkup(symbol: string): string {
    return `
      <div class="quick-actions">
        <button
          class="action-button primary"
          data-action="${this.kaswareState.getState().isConnected ? 'quick-buy' : 'connect_wallet'}"
          data-value="${this.escapeHtml(symbol)}"
        >
          🚀 Buy ${this.escapeHtml(symbol)}
        </button>
        <button
          class="action-button secondary"
          data-action="${this.kaswareState.getState().isConnected ? 'command' : 'connect_wallet'}"
          data-value="/swap"
        >
          🔄 /swap
        </button>
        <button
          class="action-button secondary"
          data-action="${this.kaswareState.getState().isConnected ? 'command' : 'connect_wallet'}"
          data-value="/buy"
        >
          💰 /buy
        </button>
      </div>
    `;
}

private createTokenButtonsMarkup(tokens: Token[]): string {
  const filteredTokens = this.config.defaultTokens?.length 
      ? tokens.filter(token => this.config.defaultTokens?.includes(token.symbol))
      : tokens;

  return `
      <div class="token-grid" part="token-grid">
          ${filteredTokens.map(token => {
              const formattedBalance = this.formatTokenBalance(token.balance);
              const isDefault = token.symbol === this.config.defaultBuyToken;
              return `
                  <button
                      class="token-button ${isDefault ? 'default-token' : ''}"
                      part="token-button"
                      data-action="select-token"
                      data-value="${this.escapeHtml(token.symbol)}"
                  >
                      <span class="token-symbol">💰 ${this.escapeHtml(token.symbol)}</span>
                      <span class="token-balance">${formattedBalance}</span>
                  </button>
              `;
          }).join('')}
      </div>
  `;
}

  private showDefaultBuyOption(): void {
    if (this.config.defaultBuyToken) {
      this.addMessage({
        id: Date.now(),
        type: MessageType.BOT,
        text: "Quick buy option:",
        buttons: {
          type: 'quick_buy',
          symbol: this.config.defaultBuyToken
        }
      });
    }
  }
  
  private static getAdditionalStyles(): string {
    return `
    .order-confirmation {
      background: #ffffff;
      border-radius: 12px;
      padding: 8px;
      border: 1px solid #e2e8f0;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
    }

    .confirmation-header {
     display: flex;
    align-items: center;
    gap: 5px;
    margin-bottom: 6px;
    padding-bottom: 3px;
    border-bottom: 1px solid #e2e8f0;
    }

    .confirmation-header .title {
      font-size: 1.1rem;
      font-weight: 600;
      color: #1e293b;
    }

    .confirmation-details {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .detail-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 8px 0;
      color: #334155;
    }

    .detail-group {
      background: #f8fafc;
      padding: 8px;
      border-radius: 8px;
      border: 1px solid #e2e8f0;
      margin: 0 0;
    }

    .group-title {
      font-weight: 600;
      margin-bottom: 12px;
      color: #475569;
    }

    .status-message, .notification-message {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 0;
      color: #475569;
      font-weight: 500;
    }

    .transaction-link {
      margin-top: 12px;
      padding-top: 12px;
      border-top: 1px solid #e2e8f0;
    }

    .transaction-link a {
      color: #2563eb;
      text-decoration: none;
      display: flex;
      align-items: center;
      gap: 6px;
      font-weight: 500;
    }

    .transaction-link a:hover {
      text-decoration: underline;
      color: #1d4ed8;
    }

    .quote-summary {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 16px;
      padding: 20px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
    }

    .quote-title {
      font-size: 1.2rem;
      font-weight: 600;
      margin-bottom: 16px;
      color: #1e293b;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .quote-details {
      background: #f8fafc;
      border-radius: 12px;
      padding: 16px;
      border: 1px solid #e2e8f0;
    }

    .quote-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 0;
      border-bottom: 1px solid #e2e8f0;
    }

    .quote-row:last-child {
      border-bottom: none;
    }

    .quote-row .label {
      color: #475569;
      font-size: 0.95rem;
      font-weight: 500;
    }

    .quote-row .value {
      color: #1e293b;
      font-weight: 600;
      font-size: 0.95rem;
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .quote-row.fee {
      background: #f1f5f9;
      margin: 8px -16px;
      padding: 12px 16px;
      border-bottom: none;
      border-top: 1px solid #e2e8f0;
    }

    .quote-confirm {
      text-align: center;
      color: #475569;
      margin-top: 16px;
      font-weight: 500;
    }

    .confirm-button {
      background: linear-gradient(135deg, #22c55e, #16a34a) !important;
      color: white;
      min-width: 120px;
      font-weight: 600;
    }

    .cancel-button {
      background: #f1f5f9 !important;
      color: #475569;
      min-width: 120px;
      border: 1px solid #e2e8f0;
      font-weight: 600;
    }

    .confirm-button:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(21, 128, 61, 0.2) !important;
    }

    .cancel-button:hover {
      background: #e2e8f0 !important;
      transform: translateY(-2px);
    }

    .quick-actions {
      display: flex;
      gap: 8px;
      padding: 12px;
    }

    .action-button {
      flex: 1;
      padding: 12px 16px;
      border-radius: 12px;
      font-weight: 600;
      font-size: 0.95rem;
      border: none;
      cursor: pointer;
      transition: all 0.2s ease;
      text-align: center;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
    }

    .action-button.primary {
      background: linear-gradient(135deg, #2563eb, #1d4ed8);
      color: white;
      min-width: 140px;
    }

    .action-button.primary:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(37, 99, 235, 0.2);
    }

    .action-button.secondary {
      background: #f8fafc;
      color: #334155;
      border: 1px solid #e2e8f0;
    }

    .action-button.secondary:hover {
      background: #f1f5f9;
      transform: translateY(-1px);
    }

    .token-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 8px;
      padding: 4px;
    }

    .token-button {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
      padding: 12px;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      transition: all 0.2s ease;
      min-width: 90px;
    }

    .token-button:hover {
      background: #f8fafc;
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
      border-color: #2563eb;
    }
      .confirm-actions {
  display: flex;
  gap: 8px;
  padding: 12px;
  width: 100%;
}

.action-button, .confirm-button, .cancel-button {
  padding: 12px 20px;
  border-radius: 12px;
  font-weight: 600;
  font-size: 0.95rem;
  border: none;
  cursor: pointer;
  transition: all 0.2s ease;
  text-align: center;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-width: 120px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
}

.confirm-button {
  background: linear-gradient(135deg, #22c55e, #16a34a) !important;
  color: white;
  flex: 1;
}

.cancel-button {
  background: #f1f5f9 !important;
  color: #475569;
  border: 1px solid #e2e8f0;
  flex: 1;
}

.confirm-button:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(21, 128, 61, 0.2);
}

.cancel-button:hover {
  background: #e2e8f0 !important;
  transform: translateY(-2px);
}

/* Dark theme adjustments */
:host([theme="dark"]) .cancel-button {
  background: rgba(31, 41, 55, 0.8) !important;
  color: #e2e8f0;
  border-color: rgba(55, 65, 81, 0.5);
}

:host([theme="dark"]) .cancel-button:hover {
  background: rgba(31, 41, 55, 0.95) !important;
}

    .token-symbol {
      font-weight: 600;
      font-size: 0.90rem;
      color: #1e293b;
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .token-balance {
      font-size: 0.875rem;
      color: #475569;
      font-weight: 500;
    }

    /* Dark theme adjustments */
    :host([theme="dark"]) .order-confirmation,
    :host([theme="dark"]) .quote-summary {
      background: rgba(31, 41, 55, 0.9);
      border-color: rgba(55, 65, 81, 0.5);
    }

    :host([theme="dark"]) .confirmation-header .title,
    :host([theme="dark"]) .quote-title {
      color: #f1f5f9;
    }

    :host([theme="dark"]) .detail-group,
    :host([theme="dark"]) .quote-details {
      background: rgba(17, 24, 39, 0.5);
      border-color: rgba(55, 65, 81, 0.5);
    }

    :host([theme="dark"]) .detail-row,
    :host([theme="dark"]) .quote-row .value {
      color: #e2e8f0;
    }

    :host([theme="dark"]) .group-title,
    :host([theme="dark"]) .status-message,
    :host([theme="dark"]) .notification-message,
    :host([theme="dark"]) .quote-row .label {
      color: #94a3b8;
    }

    :host([theme="dark"]) .action-button.secondary {
      background: rgba(31, 41, 55, 0.6);
      color: #e2e8f0;
      border-color: rgba(55, 65, 81, 0.5);
    }

    :host([theme="dark"]) .token-button {
      background: rgba(31, 41, 55, 0.6);
      border-color: rgba(55, 65, 81, 0.5);
    }

    :host([theme="dark"]) .token-symbol {
      color: #e2e8f0;
    }

    :host([theme="dark"]) .token-balance {
      color: #94a3b8;
    }

    :host([theme="dark"]) .quote-row.fee {
      background: rgba(0, 0, 0, 0.2);
      border-color: rgba(55, 65, 81, 0.5);
    }

    :host([theme="dark"]) .cancel-button {
      background: rgba(31, 41, 55, 0.8) !important;
      color: #e2e8f0;
      border-color: rgba(55, 65, 81, 0.5);
    }
    `;
}

  private formatTokenBalance(balance: string): string {
    // Convert from sompi to whole tokens (divide by 10^9)
    const sompi = BigInt(balance);
    const wholeTokens = Number(sompi) / 1_000_000_00;

    // Format the value
    if (isNaN(wholeTokens)) return "0";

    // If less than 0.01, show scientific notation or very small number
    if (wholeTokens < 0.01 && wholeTokens > 0) {
      return "< 0.01";
    }

    // For other numbers, use fixed decimal places based on size
    if (wholeTokens >= 1000000) {
      return (wholeTokens / 1000000).toFixed(2) + "M";
    }
    if (wholeTokens >= 1000) {
      return (wholeTokens / 1000).toFixed(2) + "K";
    }
    if (wholeTokens >= 1) {
      return wholeTokens.toFixed(2);
    }

    // For small numbers but >= 0.01, show more decimal places
    return wholeTokens.toFixed(4);
  }

  private createConnectButtonMarkup(): string {
    return `
      <div class="button-group" part="button-group">
        <button
          class="connect-button"
          part="connect-button"
          data-action="connect_wallet"
          data-value="connect"
        >
          ${this.escapeHtml((this.textConfig as any).connectButtonText)}
        </button>
      </div>
    `;
  }

  private createDisconnectButtonMarkup(): string {
    return `
      <div class="button-group" part="button-group">
        <button
          class="disconnect-button"
          part="disconnect-button"
          data-action="disconnect_wallet"
          data-value="disconnect"
        >
          Disconnect Wallet
        </button>
      </div>
    `;
  }

  private createConfirmButtonsMarkup(): string {
    return `
      <div class="confirm-actions" part="confirm-actions">
        <button
          class="confirm-button action-button primary"
          part="confirm-button"
          data-action="confirm"
          data-value="confirm"
        >
          ✅ ${this.escapeHtml((this.textConfig as any).confirmButtonText)}
        </button>
        <button
          class="cancel-button action-button secondary"
          part="cancel-button"
          data-action="cancel"
          data-value="cancel"
        >
          ❌ ${this.escapeHtml((this.textConfig as any).cancelButtonText)}
        </button>
      </div>
    `;
  }
  private createConnectWalletMarkup(): string {
    return `
      <div class="button-group" part="button-group">
        <button
          class="connect-button"
          part="connect-button"
          data-action="connect_wallet"
          data-value="connect"
        >
          ${this.escapeHtml((this.textConfig as any).connectButtonText)}
        </button>
      </div>
    `;
  }

  private scrollToBottom(): void {
    requestAnimationFrame(() => {
      const container = this.shadowRoot?.querySelector(
        ".chat-messages"
      ) as HTMLElement;
      if (container) {
        container.scrollTop = container.scrollHeight;
      }
    });
  }

  private escapeHtml(unsafe: string): string {
    return unsafe
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  private handleError(error: unknown): void {
    console.error("TokenSwapChat error:", error);
    this.addMessage({
      id: Date.now(),
      type: MessageType.BOT,
      text: `Error: ${
        error instanceof Error ? error.message : "An unknown error occurred"
      }`,
    });
  }

  private static getTemplateContent(): string {
    return `
      <style>${TokenSwapChat.getStyles()}</style>
      <style>${TokenSwapChat.getAdditionalStyles()}</style>
      ${TokenSwapChat.getHTML()}
    `;
  }

  private static getStyles(): string {
    return `
      :host {
        display: block;
        /* Base theme properties */
        --tsw-font-family: var(--token-swap-font-family, Inter, -apple-system, BlinkMacSystemFont, sans-serif);
        --tsw-font-size-base: var(--token-swap-font-size-base, 0.9375rem);
        --tsw-font-size-small: var(--token-swap-font-size-small, 0.875rem);
        --tsw-font-size-title: var(--token-swap-font-size-title, 1.125rem);
        
        /* Colors */
        --tsw-primary-color: var(--token-swap-primary-color, #2563eb);
        --tsw-primary-hover: var(--token-swap-primary-hover, #1d4ed8);
        --tsw-background: var(--token-swap-background, #ffffff);
        --tsw-text-color: var(--token-swap-text-color, #0a0a0a);
        --tsw-border-color: var(--token-swap-border-color, #e5e7eb);
        --tsw-message-user-bg: var(--token-swap-message-user-bg, var(--tsw-primary-color));
        --tsw-message-user-text: var(--token-swap-message-user-text, #ffffff);
        --tsw-message-bot-bg: var(--token-swap-message-bot-bg, #f3f4f6);
        --tsw-message-bot-text: var(--token-swap-message-bot-text, var(--tsw-text-color));
        
        /* UI Elements */
        --tsw-shadow: var(--token-swap-shadow, 0 4px 24px rgba(0, 0, 0, 0.08));
        --tsw-border-radius: var(--token-swap-border-radius, 16px);
        --tsw-button-radius: var(--token-swap-button-radius, 12px);
        --tsw-input-radius: var(--token-swap-input-radius, 12px);
        
        /* Dimensions */
        --tsw-height: var(--token-swap-height, 600px);
        --tsw-width: var(--token-swap-width, 440px);
        --tsw-padding: var(--token-swap-padding, 16px);
      }

      /* Dark theme */
      :host([theme="dark"]) {
        --tsw-background: var(--token-swap-dark-background, #111827);
        --tsw-text-color: var(--token-swap-dark-text, #f9fafb);
        --tsw-border-color: var(--token-swap-dark-border, #374151);
        --tsw-message-bot-bg: var(--token-swap-dark-message-bot-bg, #1f2937);
        --tsw-message-bot-text: var(--token-swap-dark-message-bot-text, #f9fafb);
        --tsw-message-user-bg: var(--token-swap-dark-message-user-bg, #3b82f6);
      }

      .chat-container {
        height: var(--tsw-height);
        width: 100%;
        max-width: var(--tsw-width);
        margin: 0 auto;
        display: flex;
        flex-direction: column;
        background: var(--tsw-background);
        border-radius: var(--tsw-border-radius);
        box-shadow: var(--tsw-shadow);
        border: 1px solid var(--tsw-border-color);
        overflow: hidden;
        transition: all 0.2s ease;
        font-family: var(--tsw-font-family);
        color: var(--tsw-text-color);
      }

      .chat-header {
        padding: var(--tsw-padding) calc(var(--tsw-padding) * 1.25);
        background: var(--tsw-background);
        border-bottom: 1px solid var(--tsw-border-color);
      }

      .chat-header h2 {
        margin: 0;
        font-size: var(--tsw-font-size-title);
        font-weight: 600;
        color: var(--tsw-text-color);
      }

      .chat-header p {
        margin: 4px 0 0;
        font-size: var(--tsw-font-size-small);
        color: var(--tsw-text-color);
        opacity: 0.7;
      }

      .chat-messages {
        flex: 1;
        overflow-y: auto;
        padding: var(--tsw-padding);
        display: flex;
        flex-direction: column;
        gap: 16px;
      }

      .message {
        max-width: 85%;
        margin-bottom: 8px;
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .message.bot {
        align-self: flex-start;
      }

      .message.user {
        align-self: flex-end;
      }

      .message-text {
        padding: 12px 16px;
        border-radius: var(--tsw-button-radius);
        font-size: var(--tsw-font-size-base);
        line-height: 1.5;
        max-width: 100%;
        word-wrap: break-word;
      }

      .message.bot .message-text {
        background: var(--tsw-message-bot-bg);
        color: var(--tsw-message-bot-text);
        border-bottom-left-radius: 4px;
      }

      .message.user .message-text {
        background: var(--tsw-message-user-bg);
        color: var(--tsw-message-user-text);
        border-bottom-right-radius: 4px;
      }

      .button-group {
        display: flex;
        flex-direction: column;
        gap: 8px;
        width: 100%;
        max-width: 200px;
        margin-top: 4px;
      }

      button {
        font-family: inherit;
        border: none;
        cursor: pointer;
        transition: all 0.2s ease;
        font-size: var(--tsw-font-size-small);
        font-weight: 500;
      }

      .connect-button, .disconnect-button {
        width: 100%;
        padding: 12px 16px;
        border-radius: var(--tsw-button-radius);
        font-weight: 600;
        text-align: center;
      }

      .connect-button {
        background: var(--tsw-primary-color);
        color: white;
      }

      .connect-button:hover:not(:disabled) {
        background: var(--tsw-primary-hover);
        transform: translateY(-1px);
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
      }

      .disconnect-button {
        background: #ef4444;
        color: white;
      }

      .disconnect-button:hover:not(:disabled) {
        background: #dc2626;
        transform: translateY(-1px);
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
      }

      .token-button {
        padding: 10px 16px;
        border-radius: var(--tsw-button-radius);
        background: var(--tsw-message-bot-bg);
        color: var(--tsw-message-bot-text);
        border: 1px solid var(--tsw-border-color);
        transition: all 0.2s ease;
      }

      .token-button:hover:not(:disabled) {
        background: var(--tsw-border-color);
        transform: translateY(-1px);
      }

      .chat-input {
        padding: var(--tsw-padding);
        display: flex;
        gap: 12px;
        background: var(--tsw-background);
        border-top: 1px solid var(--tsw-border-color);
      }

      .chat-input input {
        flex: 1;
        padding: 12px 16px;
        border: 1px solid var(--tsw-border-color);
        border-radius: var(--tsw-input-radius);
        background: var(--tsw-background);
        color: var(--tsw-text-color);
        font-size: var(--tsw-font-size-base);
        font-family: inherit;
        transition: all 0.2s ease;
      }

      .chat-input input:focus {
        outline: none;
        border-color: var(--tsw-primary-color);
        box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
      }

      .chat-input input:disabled {
        background: var(--tsw-message-bot-bg);
        cursor: not-allowed;
        opacity: 0.7;
      }

      .chat-input button[type="submit"] {
        padding: 12px;
        border-radius: var(--tsw-button-radius);
        background: var(--tsw-primary-color);
        color: white;
        transition: all 0.2s ease;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .chat-input button[type="submit"]:hover:not(:disabled) {
        background: var(--tsw-primary-hover);
        transform: translateY(-1px);
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
      }

      .chat-input button[type="submit"]:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      button:disabled {
        opacity: 0.5;
        cursor: not-allowed;
        transform: none;
        box-shadow: none;
      }

      @keyframes messageSlide {
        from {
          opacity: 0;
          transform: translateY(8px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      /* Scrollbar Styles */
      .chat-messages::-webkit-scrollbar {
        width: 6px;
      }

      .chat-messages::-webkit-scrollbar-track {
        background: transparent;
      }

      .chat-messages::-webkit-scrollbar-thumb {
        background-color: var(--tsw-border-color);
        border-radius: 3px;
      }

      .chat-messages::-webkit-scrollbar-thumb:hover {
        background-color: #999;
      }
    `;
  }

  public updateTheme(theme: Partial<TokenSwapTheme>): void {
    const root = this.shadowRoot?.host as HTMLElement;
    if (!root) return;

    if (theme.fontFamily) {
      root.style.setProperty("--token-swap-font-family", theme.fontFamily);
    }

    if (theme.fontSize) {
      if (theme.fontSize.base)
        root.style.setProperty(
          "--token-swap-font-size-base",
          theme.fontSize.base
        );
      if (theme.fontSize.small)
        root.style.setProperty(
          "--token-swap-font-size-small",
          theme.fontSize.small
        );
      if (theme.fontSize.title)
        root.style.setProperty(
          "--token-swap-font-size-title",
          theme.fontSize.title
        );
    }

    if (theme.colors) {
      if (theme.colors.primary)
        root.style.setProperty(
          "--token-swap-primary-color",
          theme.colors.primary
        );
      if (theme.colors.primaryHover)
        root.style.setProperty(
          "--token-swap-primary-hover",
          theme.colors.primaryHover
        );
      if (theme.colors.background)
        root.style.setProperty(
          "--token-swap-background",
          theme.colors.background
        );
      if (theme.colors.text)
        root.style.setProperty("--token-swap-text-color", theme.colors.text);
      if (theme.colors.border)
        root.style.setProperty(
          "--token-swap-border-color",
          theme.colors.border
        );

      if (theme.colors.messageUser) {
        if (theme.colors.messageUser.background) {
          root.style.setProperty(
            "--token-swap-message-user-bg",
            theme.colors.messageUser.background
          );
        }
        if (theme.colors.messageUser.text) {
          root.style.setProperty(
            "--token-swap-message-user-text",
            theme.colors.messageUser.text
          );
        }
      }

      if (theme.colors.messageBot) {
        if (theme.colors.messageBot.background) {
          root.style.setProperty(
            "--token-swap-message-bot-bg",
            theme.colors.messageBot.background
          );
        }
        if (theme.colors.messageBot.text) {
          root.style.setProperty(
            "--token-swap-message-bot-text",
            theme.colors.messageBot.text
          );
        }
      }
    }

    if (theme.dark) {
      if (theme.dark.background)
        root.style.setProperty(
          "--token-swap-dark-background",
          theme.dark.background
        );
      if (theme.dark.text)
        root.style.setProperty("--token-swap-dark-text", theme.dark.text);
      if (theme.dark.border)
        root.style.setProperty("--token-swap-dark-border", theme.dark.border);

      if (theme.dark.messageBot) {
        if (theme.dark.messageBot.background) {
          root.style.setProperty(
            "--token-swap-dark-message-bot-bg",
            theme.dark.messageBot.background
          );
        }
        if (theme.dark.messageBot.text) {
          root.style.setProperty(
            "--token-swap-dark-message-bot-text",
            theme.dark.messageBot.text
          );
        }
      }
    }

    if (theme.borderRadius) {
      if (theme.borderRadius.container)
        root.style.setProperty(
          "--token-swap-border-radius",
          theme.borderRadius.container
        );
      if (theme.borderRadius.button)
        root.style.setProperty(
          "--token-swap-button-radius",
          theme.borderRadius.button
        );
      if (theme.borderRadius.input)
        root.style.setProperty(
          "--token-swap-input-radius",
          theme.borderRadius.input
        );
    }

    if (theme.dimensions) {
      if (theme.dimensions.height)
        root.style.setProperty("--token-swap-height", theme.dimensions.height);
      if (theme.dimensions.width)
        root.style.setProperty("--token-swap-width", theme.dimensions.width);
      if (theme.dimensions.padding)
        root.style.setProperty(
          "--token-swap-padding",
          theme.dimensions.padding
        );
    }
  }

  private static getHTML(): string {
    return `
      <div class="chat-container" part="container">
        <div class="chat-header" part="header">
          <h2 part="title"></h2>
          <p part="subtitle"></p>
        </div>
        <div class="chat-messages" part="messages"></div>
        <form class="chat-input" part="input-form">
          <input 
            type="text" 
            part="input"
            aria-label="Message input"
          />
          <button type="submit" part="submit-button" aria-label="Send message">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M22 2L11 13M22 2L15 22L11 13M11 13L2 9" />
            </svg>
          </button>
        </form>
      </div>
    `;
  }

  public updateText(config: Partial<TokenSwapTextConfig>): void {
    const oldConfig = { ...this.textConfig };
    this.textConfig = {
      ...this.textConfig,
      ...config,
    };

    // Update visible content
    this.updateTextContent();

    // Check if connect message changed
    if (
      config.connectMessage &&
      config.connectMessage !== oldConfig.connectMessage
    ) {
      this.handleConnectMessageChange();
    }

    // If any button text changed, re-render messages to update buttons
    if (
      config.connectButtonText !== oldConfig.connectButtonText ||
      config.confirmButtonText !== oldConfig.confirmButtonText ||
      config.cancelButtonText !== oldConfig.cancelButtonText
    ) {
      this.updateMessages();
    }
  }

  private initializeContent(): void {
    const title: any = this.shadowRoot?.querySelector("h2");
    const subtitle: any = this.shadowRoot?.querySelector("p");
    const input: any = this.shadowRoot?.querySelector("input");

    if (title)
      title.textContent = this.getAttribute("title") || this.textConfig.title;
    if (subtitle)
      subtitle.textContent =
        this.getAttribute("subtitle") || this.textConfig.subtitle;
    if (input)
      input.placeholder =
        this.getAttribute("input-placeholder") ||
        this.textConfig.inputPlaceholder;

    // Initialize connect message if specified in attributes
    const connectMsg = this.getAttribute("connect-message");
    if (connectMsg) {
      this.textConfig.connectMessage = connectMsg;
    }
  }

  private updateTextContent(): void {
    const title: any = this.shadowRoot?.querySelector("h2");
    const subtitle: any = this.shadowRoot?.querySelector("p");
    const input: any = this.shadowRoot?.querySelector("input");

    if (title) title.textContent = this.textConfig.title;
    if (subtitle) subtitle.textContent = this.textConfig.subtitle;
    if (input) input.placeholder = this.textConfig.inputPlaceholder;
  }

  private handleThemeChange(theme: string): void {
    const root = this.shadowRoot?.querySelector(
      ".chat-container"
    ) as HTMLElement;
    if (!root) return;

    if (theme === "dark") {
      root.style.setProperty("--chat-bg-color", "#212529");
      root.style.setProperty("--chat-text-color", "#f8f9fa");
      root.style.setProperty("--message-bot-bg", "#343a40");
      root.style.setProperty("--message-bot-color", "#f8f9fa");
    } else {
      root.style.setProperty("--chat-bg-color", "#f8f9fa");
      root.style.setProperty("--chat-text-color", "#212529");
      root.style.setProperty("--message-bot-bg", "#ffffff");
      root.style.setProperty("--message-bot-color", "#212529");
    }
  }

  private handleDisabledChange(disabled: boolean): void {
    const container = this.shadowRoot?.querySelector(
      ".chat-container"
    ) as HTMLElement;
    if (!container) return;

    if (disabled) {
      container.setAttribute("disabled", "");
      this.addMessage({
        id: Date.now(),
        type: MessageType.BOT,
        text: "Chat is currently disabled.",
      });
    } else {
      container.removeAttribute("disabled");
    }
  }

  // Lifecycle methods
  connectedCallback(): void {
    this.setAttribute("role", "region");
    this.setAttribute("aria-label", "Token swap chat interface");

    // Initialize with attribute values if present
    const attrs = ["title", "subtitle", "connect-message", "input-placeholder"];
    attrs.forEach((attr) => {
      const value = this.getAttribute(attr);
      if (value) {
        this.attributeChangedCallback(attr, null, value);
      }
    });
  }

  disconnectedCallback(): void {
    if (this._stateChangeHandler) {
      this.kaswareState.removeEventListener(
        "stateChanged",
        this._stateChangeHandler
      );
    }
  }

  public getTextConfig(): Readonly<TokenSwapTextConfig> {
    return { ...this.textConfig };
  }

  attributeChangedCallback(
    name: string,
    oldValue: string | null,
    newValue: string | null
  ): void {
    if (oldValue === newValue) return;

    switch (name) {
      case "theme":
        this.handleThemeChange(newValue || "light");
        break;
      case "disabled":
        this.handleDisabledChange(newValue !== null);
        break;
      case "title":
        this.textConfig.title = newValue || this.textConfig.title;
        this.updateTextContent();
        break;
      case "subtitle":
        this.textConfig.subtitle = newValue || this.textConfig.subtitle;
        this.updateTextContent();
        break;
      case "connect-message":
        this.textConfig.connectMessage =
          newValue || this.textConfig.connectMessage;
        this.handleConnectMessageChange();
        break;
      case "disconnect-message":
        this.textConfig.disconnectMessage =
          newValue || this.textConfig.disconnectMessage;
        break;
      case "input-placeholder":
        this.textConfig.inputPlaceholder =
          newValue || this.textConfig.inputPlaceholder;
        this.updateTextContent();
        break;
      case "connect-button-text":
        this.textConfig.connectButtonText =
          newValue || this.textConfig.connectButtonText;
        this.updateMessages(); // Re-render to update button text
        break;
      case "confirm-button-text":
        this.textConfig.confirmButtonText =
          newValue || this.textConfig.confirmButtonText;
        this.updateMessages(); // Re-render to update button text
        break;
      case "cancel-button-text":
        this.textConfig.cancelButtonText =
          newValue || this.textConfig.cancelButtonText;
        this.updateMessages(); // Re-render to update button text
        break;
      case "default-tokens":
        if (newValue) {
          this.config.defaultTokens = newValue.split(",").map((t) => t.trim());
        }
        break;
      case "default-buy-token":
        this.config.defaultBuyToken = newValue || undefined;
        break;
    }
  }

  // Public API methods
  public async connect(): Promise<void> {
    try {
      await this.kaswareState.connectWallet();
    } catch (error) {
      this.handleError(error);
    }
  }

  public async disconnect(): Promise<void> {
    try {
      localStorage.removeItem("kasware_connection");
      await this.kaswareState.disconnect();
      this.updateInputState(false);

      // Clear any existing messages and show disconnect message
      this.removeConnectionMessages();
      this.addMessage({
        id: Date.now(),
        type: MessageType.BOT,
        text: (this.textConfig as any).disconnectMessage,
        buttons: {
          type: "connect_wallet",
          data: { action: "connect" },
        },
      });
    } catch (error) {
      this.handleError(error);
    }
  }

  public getHistory(): ReadonlyArray<MessageData> {
    return [...this.messages];
  }

  public async reset(): Promise<void> {
    this.messages.length = 0;
    this.updateMessages();
    await this.controller.reset();
  }
}

// Register the custom element
customElements.define("token-swap-chat", TokenSwapChat);
