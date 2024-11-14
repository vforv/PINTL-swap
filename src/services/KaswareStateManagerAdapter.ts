import { PriceQuote, SwapResult, Token } from "types";
import { KaswareClientService } from "./KaswareClientService";
import { ITokenService } from "interfaces/ITokenService";
import { KaswareStateManager } from "./KaswareStateManager";

export class KaswareStateManagerAdapter implements ITokenService {
    constructor(private kaswareState: KaswareStateManager) {
      this.initializeAvailableTokens();
    }
    private availableTokens: Map<string, boolean> = new Map();
    private lastFetchTime: number = 0;
    private readonly FETCH_INTERVAL = 5 * 60 * 1000; // 5 minutes
  
    async getTokens(): Promise<Token[]> {
      const state = this.kaswareState.getState();
      const tokens: Token[] = [];
      if (state.balance) {
        tokens.push({
          symbol: 'KAS',
          balance: state.balance.total.toString(),
          decimals: 8
        });
      }
      
      state.krc20Balances?.forEach(token => {
        tokens.push({
          symbol: token.tick,
          balance: token.balance,
          decimals: parseInt(token.dec)
        });
      });
      
      return tokens;
    }

    private async initializeAvailableTokens(): Promise<void> {
      await this.updateAvailableTokens();
      setInterval(() => this.updateAvailableTokens(), this.FETCH_INTERVAL);
  }

  private async updateAvailableTokens(): Promise<void> {
      try {
          const kaswareService = KaswareClientService.getInstance();
          const tokens = await kaswareService.getDexAvailableTokens();
          
          this.availableTokens.clear();
          tokens.forEach(token => {
              this.availableTokens.set(token.symbol.toUpperCase(), true);
          });
          this.lastFetchTime = Date.now();
      } catch (error) {
          console.error('Failed to update available tokens:', error);
      }
  }

    async isTokenAvailable(token: string): Promise<boolean> {
      if (Date.now() - this.lastFetchTime > this.FETCH_INTERVAL) {
          await this.updateAvailableTokens();
      }
      return this.availableTokens.has(token.toUpperCase()) || token.toUpperCase() === 'KAS';
  }
  
    async getPriceQuote(fromToken: string, toToken: string, amount: string): Promise<PriceQuote> {
      const kaswareService = KaswareClientService.getInstance();
      const quote = await kaswareService.getOrderQuote(fromToken, toToken, amount.toString());
      return {
        fromAmount: amount,
        toAmount: Number(quote.quote.outAmount) / Math.pow(10, quote.quote.chainDecimal),
        exchangeRate: quote.quote.priceImpact,
        fee: Number(quote.quote.serviceFee) / Math.pow(10, quote.quote.chainDecimal),
        slippage: quote.quote.slippage,
        chainDecimal: quote.quote.chainDecimal,
        priceImpact: quote.quote.priceImpact
      };
    }
  
    async executeSwap(fromToken: string, toToken: string, amount: number): Promise<SwapResult> {
      try {
        const kaswareService = KaswareClientService.getInstance();
        const txHash = await kaswareService.executeSwap(fromToken,
          toToken,
          amount.toString());
        
        // If we get here, we have a txHash and the transaction was successful
        return txHash;
      } catch (error) {
        // If there's an error, we still need to return a valid SwapResult
        return {
          success: false,
          txHash: '', // Empty string instead of undefined
          error: error instanceof Error ? error.message : 'Unknown error occurred'
        };
      }
    }
  
    async executeBuy(token: string, amount: number): Promise<SwapResult> {
      // Reuse executeSwap logic for buying
      return this.executeSwap('KAS', token, amount);
    }

    
  
    async checkOrderStatus(orderId: string): Promise<string> {
      const kaswareService = KaswareClientService.getInstance();
      const { status } = await kaswareService.getOrderStatus(orderId);
      return status;
    }
  }