import { ITokenService } from "interfaces/ITokenService";

export enum MessageType {
    USER = 'user',
    BOT = 'bot'
  }
  
  export enum SwapStep {
    NONE = 'none',
    FROM_TOKEN = 'from_token',
    TO_TOKEN = 'to_token',
    AMOUNT = 'amount',
    CONFIRM = 'confirm',
    BUY_TOKEN = 'buy_token',
    BUY_AMOUNT = 'buy_amount',
    BUY_CONFIRM = 'buy_confirm'
  }
  export interface KRC20Balance {
    balance: string;
    dec: string;
    locked: string;
    opScoreMod: string;
    tick: string;
  }
  export interface TokenSwapConfig {
    defaultTokens?: string[];
    defaultBuyToken?: string;
  }

  export interface OrderStatus {
    orderId: string;
    status: string;
    fromToken: string;
    toToken: string;
    fromAmount: string;
    toAmount: string;
    lastChecked: number;
  }

  export interface QuoteMessageData extends MessageData {
    quote?: {
      fromAmount: string;
      fromToken: string;
      toAmount: string;
      toToken: string;
      exchangeRate: string;
      fee: string;
    };
  }

  export interface KaspaBalance {
    confirmed: number;
    unconfirmed: number;
    total: number;
  }
  export interface Token {
    symbol: string;
    contractAddress?: string;
    decimals: number;
    index?: number;
    balance: string;
  }
  export interface KaswareState {
    balance: KaspaBalance | null;
    krc20Balances: KRC20Balance[] | null;
  }

  export interface TokenC {
    symbol: string;
    balance: string;
    decimals: number;
  }
  export interface SwapResult {
    success: boolean;
    txHash: string;
    orderId?: string;
    error?: string;
  }
  
  export interface PriceQuote {
    fromAmount: string;
    toAmount: number;
    exchangeRate: number;
    fee: number;
    slippage: string;
    chainDecimal: number;
    priceImpact: number;
  }
  
  export interface ButtonConfig {
    text: string;
    action: string;
    value?: string;
    class?: string;
  }
  
  export interface MessageButtons {
    type: 'token_select' | 'confirm' | 'connect_wallet' | 'quick_buy'; // Add 'quick_buy' to existing types
    data?: any;
    tokens?: Token[];
    symbol?: string; // Add this for quick buy
  }
  
  export interface MessageData {
    id: number;
    type: MessageType;
    text: string;
    buttons?: MessageButtons;
  }
  
  export interface KaswareState {
    account: string | null;
    isConnected: boolean;
    balance: {
      confirmed: number;
      unconfirmed: number;
      total: number;
    } | null;
    krc20Balances: Array<{
      balance: string;
      dec: string;
      locked: string;
      opScoreMod: string;
      tick: string;
    }> | null;
    isLoading: boolean;
    error: string | null;
  }
  export interface SwapParams {
    transactionHash: string;
    fromToken: string;
    toToken: string;
    amount: string;
    fromAddress: string;
    publicKey: string;
  }
  export interface SwapConfig {
    minterAddress: {
      KAS: string;
      KRC20: string;
      CUSDT: string;
      CUSDC: string;
      CETH: string;
      CBTC: string;
      CXCHNG: string;
      [key: string]: string;
    };
    priorityFee: number;
    networkId: string;
    backendUrl: string;
  }

  export interface TokenSwapTheme {
    fontFamily?: string;
    fontSize?: {
      base?: string;
      small?: string;
      title?: string;
    };
    colors?: {
      primary?: string;
      primaryHover?: string;
      background?: string;
      text?: string;
      border?: string;
      messageUser?: {
        background?: string;
        text?: string;
      };
      messageBot?: {
        background?: string;
        text?: string;
      };
    };
    dark?: {
      background?: string;
      text?: string;
      border?: string;
      messageBot?: {
        background?: string;
        text?: string;
      };
    };
    borderRadius?: {
      container?: string;
      button?: string;
      input?: string;
    };
    dimensions?: {
      height?: string;
      width?: string;
      padding?: string;
    };
  }

  export interface TokenSwapTextConfig {
    title?: string;
    subtitle?: string;
    connectMessage?: string;
    disconnectMessage?: string;
    inputPlaceholder?: string;
    connectButtonText?: string;
    confirmButtonText?: string;
    cancelButtonText?: string;
  }