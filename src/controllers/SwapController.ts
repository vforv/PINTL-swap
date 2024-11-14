import { ITokenService } from "../interfaces/ITokenService";
import { SwapState } from "../models/SwapState";
import {
  MessageData,
  MessageType,
  SwapStep,
  Token,
} from "../types";
import { EventEmitter } from "./EventEmitter";

export class SwapController extends EventEmitter {
  private state = new SwapState();

  constructor(private readonly tokenService: ITokenService) {
    super();
  }

  public getState(): ReturnType<SwapState["getState"]> {
    return this.state.getState();
  }

  public async handleCommand(command: string): Promise<void> {
    try {
      // Check for buy command with token parameter
      if (command.startsWith("/buy ")) {
        const token = command.split(" ")[1]?.toUpperCase();
        if (token) {
          this.state.setStep(SwapStep.BUY_AMOUNT);
          this.state.setToToken(token);

          // Verify token exists
          const availableTokens = await this.tokenService.getTokens();
          const tokenExists = availableTokens.some((t) => t.symbol === token);

          if (!tokenExists) {
            this.emit("message", {
              id: Date.now(),
              type: MessageType.BOT,
              text: `Token ${token} not found. Available tokens: ${availableTokens
                .map((t) => t.symbol)
                .join(", ")}`,
            } as MessageData);
            this.state.reset();
            return;
          }

          if (token === "KAS") {
            this.emit("message", {
              id: Date.now(),
              type: MessageType.BOT,
              text: "Cannot buy KAS token directly",
            } as MessageData);
            this.state.reset();
            return;
          }

          this.emit("message", {
            id: Date.now(),
            type: MessageType.BOT,
            text: `Selected ${token} to buy.\nPlease enter the amount of KAS you want to spend:`,
          } as MessageData);
          return;
        }
      }

      // Original switch for basic commands
      switch (command) {
        case "/swap":
          this.state.setStep(SwapStep.FROM_TOKEN);
          const tokens = await this.tokenService.getTokens();
          this.emit("message", {
            id: Date.now(),
            type: MessageType.BOT,
            text: this.createTokenSelectionMessage(SwapStep.FROM_TOKEN, tokens),
            buttons: {
              type: "token_select",
              tokens,
            },
          } as MessageData);
          break;

        case "/buy":
          this.state.setStep(SwapStep.BUY_TOKEN);
          const buyableTokens = (await this.tokenService.getTokens()).filter(
            (t) => t.symbol !== "KAS"
          );
          this.emit("message", {
            id: Date.now(),
            type: MessageType.BOT,
            text: this.createTokenSelectionMessage(
              SwapStep.BUY_TOKEN,
              buyableTokens
            ),
            buttons: {
              type: "token_select",
              tokens: buyableTokens,
            },
          } as MessageData);
          break;

        default:
          this.emit("message", {
            id: Date.now(),
            type: MessageType.BOT,
            text: "Unknown command. Available commands: /swap, /buy [TOKEN]",
          } as MessageData);
      }
    } catch (error) {
      this.handleError(error);
    }
  }
  private createTokenSelectionMessage(step: SwapStep, tokens: Token[]): string {
    switch (step) {
      case SwapStep.FROM_TOKEN:
        return "🔍 Select or type the token you want to swap from:";
      case SwapStep.TO_TOKEN:
        return "🎯 Select or type the token you want to swap to:";
      case SwapStep.BUY_TOKEN:
        return "💎 Select or type the token you want to buy:";
      default:
        return "🔍 Select a token:";
    }
  }
  public async handleAction(action: string, value: string): Promise<void> {
    try {
      const state = this.state.getState();

      switch (action) {
        case "select-token":
          await this.handleTokenSelection(value);
          break;
        case "confirm":
          await this.handleConfirmation();
          break;
        case "cancel":
          this.handleCancel();
          break;
        default:
          throw new Error(`Unknown action: ${action}`);
      }
    } catch (error) {
      this.handleError(error);
    }
  }

  private async handleTokenSelection(token: string): Promise<void> {
    const state = this.state.getState();

    switch (state.step) {
      case SwapStep.FROM_TOKEN:
        this.state.setFromToken(token);
        this.state.setStep(SwapStep.TO_TOKEN);

        const availableTokens = (await this.tokenService.getTokens()).filter(
          (t) => t.symbol !== token
        );

        this.emit("message", {
          id: Date.now(),
          type: MessageType.BOT,
          text: `Selected ${token} to swap from.\n${this.createTokenSelectionMessage(
            SwapStep.TO_TOKEN,
            availableTokens
          )}`,
          buttons: {
            type: "token_select",
            tokens: availableTokens,
          },
        } as MessageData);
        break;

      case SwapStep.TO_TOKEN:
        this.state.setToToken(token);
        this.state.setStep(SwapStep.AMOUNT);
        const state = this.state.getState()
        this.emit("message", {
          id: Date.now(),
          type: MessageType.BOT,
          text: `Selected ${token} to buy.\nPlease enter the amount of ${state.fromToken} you want to spend:`,
        } as MessageData);
        break;

      case SwapStep.BUY_TOKEN:
        this.state.setToToken(token);
        this.state.setStep(SwapStep.BUY_AMOUNT);
        this.emit("message", {
          id: Date.now(),
          type: MessageType.BOT,
          text: `Selected ${token} to buy.\nPlease enter the amount of KAS you want to spend:`,
        } as MessageData);
        break;

      default:
        throw new Error("Invalid state for token selection");
    }
  }

  public async handleAmount(amount: number): Promise<void> {
    try {
      const state = this.state.getState();

      if (
        state.step !== SwapStep.AMOUNT &&
        state.step !== SwapStep.BUY_AMOUNT
      ) {
        throw new Error("Invalid state for amount input");
      }

      this.state.setAmount(amount);

      const fromToken =
        state.step === SwapStep.AMOUNT ? state.fromToken! : "KAS";
      const toToken = state.toToken!;

      const quote = await this.tokenService.getPriceQuote(
        fromToken,
        toToken,
        amount.toString()
      );
      this.state.setQuote(quote);
      this.state.setStep(
        state.step === SwapStep.AMOUNT ? SwapStep.CONFIRM : SwapStep.BUY_CONFIRM
      );
      const waitQuoute = await this.createQuoteMessage(
        fromToken,
        toToken,
        amount.toString()
      );
      this.emit("message", waitQuoute);
    } catch (error) {
      this.handleError(error);
    }
  }
  private getTransactionLink(hash: string): string {
    return `🔎 <a href="https://kas.fyi/transaction/${hash}">View Transaction</a>`;
  }
  private async handleConfirmation(): Promise<void> {
    try {
      const state = this.state.getState();
      if (
        state.step !== SwapStep.CONFIRM &&
        state.step !== SwapStep.BUY_CONFIRM
      ) {
        throw new Error("Invalid state for confirmation");
      }

      const result: any =
        state.step === SwapStep.CONFIRM
          ? await this.tokenService.executeSwap(
              state.fromToken!,
              state.toToken!,
              state.amount!
            )
          : await this.tokenService.executeBuy(state.toToken!, state.amount!);

      if (result.success && result.orderId) {
        const orderStatusData = {
          txHash: result.txHash,
          fromToken: state.fromToken || "KAS",
          toToken: state.toToken!,
          amount: state.amount!,
          toAmount: state.quote?.toAmount,
          status: "submitted",
          orderId: result.orderId,
          lastChecked: Date.now(),
        };

        localStorage.setItem(
          `order_${result.txHash}`,
          JSON.stringify(orderStatusData)
        );

        const txLink = this.getTransactionLink(result.txHash);
        this.emit("message", {
          id: Date.now(),
          type: MessageType.BOT,
          text: `<div class="order-confirmation">
          <div class="confirmation-header">
            <span class="icon">✅</span>
            <span class="title">Order Submitted Successfully</span>
          </div>
          <div class="confirmation-details">
            <div class="detail-row">
              <span class="label">Order ID:</span>
              <span class="value">${result.orderId}</span>
            </div>
            <div class="detail-group">
              <div class="group-title">Swap Details</div>
              <div class="detail-row">
                <span class="label">From:</span>
                <span class="value">${state.amount} ${state.fromToken || "KAS"}</span>
              </div>
              <div class="detail-row">
                <span class="label">To:</span>
                <span class="value">${state.quote?.toAmount} ${state.toToken}</span>
              </div>
            </div>
            <div class="status-message">
              <span class="icon">🔄</span>
              <span>Your order is being processed by the DEX</span>
            </div>
            <div class="notification-message">
              <span class="icon">🔔</span>
              <span>You'll be notified when the order completes</span>
            </div>
          </div>
          <div class="transaction-link">
            ${txLink}
          </div>
        </div>`,
        });

        
      } else {
        throw new Error(result.error || "Transaction failed");
      }

      this.state.reset();
    } catch (error) {
      this.handleError(error);
    }
  }
 
  public async startStatusCheck() {
    const processedMessages = new Set();
    
    const checkStatus = async () => {
      try {
        const orderKeys = Object.keys(localStorage).filter(key => key.startsWith("order_"));
        console.log(orderKeys)
        for (const key of orderKeys) {
          try {
            const orderData = localStorage.getItem(key);
            if (!orderData) continue;
  
            const order = JSON.parse(orderData);
            const status: any = await this.tokenService.checkOrderStatus(order.orderId);
            
            // Create unique message identifier
            const messageId = `${order.orderId}_${status}`;
            
            if (status !== order.status && 
                status.trim() !== 'unknown' && 
                !processedMessages.has(messageId)) {
              
              processedMessages.add(messageId);
              
              const txLink = this.getTransactionLink(order.txHash);
              const messages: any = {
                pending: `⏳ Your transaction has been verified and is now processing with DEX. Swapping ${order.amount} ${order.fromToken} to ${order.toToken}...\n\n${txLink}`,
                completed: `✅ Your swap of ${order.amount} ${order.fromToken} to ${order.toAmount} ${order.toToken} has been completed successfully!\n\n${txLink}`,
                failed: `❌ Your swap of ${order.amount} ${order.fromToken} to ${order.toToken} has failed. Please try again.\n\n${txLink}`,
                refunded: `↩️ Your swap of ${order.amount} ${order.fromToken} has been refunded.\n\n${txLink}`,
              };
              
              this.emit("message", {
                id: Date.now(),
                type: MessageType.BOT,
                text: messages[status] || `Status: ${status}`,
              });
  
              if (["completed", "failed", "refunded"].includes(status)) {
                localStorage.removeItem(key);
                processedMessages.delete(messageId);
              } else {
                localStorage.setItem(key, JSON.stringify({
                  ...order,
                  status,
                  lastChecked: Date.now()
                }));
              }
            }
          } catch (error) {
            console.error(`Error processing order ${key}:`, error);
          }
        }
      } catch (error) {
        console.error("Status check error:", error);
      }
    };
  
    setInterval(checkStatus, 10000);
  }
  private handleCancel(): void {
    this.state.reset();
    this.emit("message", {
      id: Date.now(),
      type: MessageType.BOT,
      text: "Transaction cancelled.",
    } as MessageData);
  }

  private async createQuoteMessage(
    fromToken: string,
    toToken: string,
    amount: string
  ): Promise<MessageData> {
    try {
      const {
        fromAmount,
        toAmount,
        exchangeRate,
        fee,
        slippage,
        chainDecimal,
        priceImpact,
      } = await this.tokenService.getPriceQuote(fromToken, toToken, amount);

      const totalFee = fee;
      const minReceived =
        (Number(toAmount) * (1 - Number(slippage) / 100)) /
        Math.pow(10, chainDecimal);
      const rate = (Number(toAmount) / Number(fromAmount)).toFixed(6);

      return {
        id: Date.now(),
        type: MessageType.BOT,
        text: `<div class="quote-summary">
            <div class="quote-title">💱 Swap Summary</div>
            <div class="quote-details">
              <div class="quote-row">
                <span class="label">From:</span>
                <span class="value">💰 ${fromAmount} ${fromToken}</span>
              </div>
              <div class="quote-row">
                <span class="label">To:</span>
                <span class="value">🎯 ${toAmount} ${toToken}</span>
              </div>
              <div class="quote-row">
                <span class="value">📊 1 ${fromToken} = ${rate} ${toToken}</span>
              </div>
              <div class="quote-row">
                <span class="label">Price Impact:</span>
                <span class="value">📉 ${priceImpact}%</span>
              </div>
              <div class="quote-row fee">
                <span class="label">Min Received:</span>
                <span class="value">🔒 ${minReceived.toFixed(
                  4
                )} ${toToken}</span>
              </div>
              <div class="quote-row fee">
                <span class="label">Service Fee:</span>
                <span class="value">🏷️ ${totalFee.toFixed(4)} ${toToken}</span>
              </div>
            </div>
            <div class="quote-confirm">Ready to complete this swap? 🚀</div>
          </div>`,
        buttons: {
          type: "confirm",
        },
      } as MessageData;
    } catch (error: any) {
      throw new Error(`Failed to get quote: ${error.message}`);
    }
  }

  private handleError(error: unknown): void {
    console.error("SwapController error:", error);
    this.emit("error", {
      id: Date.now(),
      type: MessageType.BOT,
      text: `Error: ${
        error instanceof Error ? error.message : "Unknown error occurred"
      }`,
    } as MessageData);
    this.state.reset();
  }

  public async reset(): Promise<void> {
    this.state.reset();
  }
}
