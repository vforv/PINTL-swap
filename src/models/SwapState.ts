import { PriceQuote, SwapStep } from "../types";

export class SwapState {
    private step: SwapStep = SwapStep.NONE;
    private fromToken: string | null = null;
    private toToken: string | null = null;
    private amount: number | null = null;
    private quote: PriceQuote | null = null;
  
    public reset(): void {
      this.step = SwapStep.NONE;
      this.fromToken = null;
      this.toToken = null;
      this.amount = null;
      this.quote = null;
    }
  
    public getState(): {
      step: SwapStep;
      fromToken: string | null;
      toToken: string | null;
      amount: number | null;
      quote: PriceQuote | null;
    } {
      return {
        step: this.step,
        fromToken: this.fromToken,
        toToken: this.toToken,
        amount: this.amount,
        quote: this.quote
      };
    }
  
    public setStep(step: SwapStep): void {
      this.step = step;
    }
  
    public setFromToken(token: string): void {
      this.fromToken = token;
    }
  
    public setToToken(token: string): void {
      this.toToken = token;
    }
  
    public setAmount(amount: number): void {
      this.amount = amount;
    }
  
    public setQuote(quote: PriceQuote): void {
      this.quote = quote;
    }
  }