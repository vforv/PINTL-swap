import { SwapConfig, SwapResult, KaswareState, Token, KaspaBalance, KRC20Balance, TokenC, SwapParams } from "types";

declare global {
    interface Window {
      kasware: {
        requestAccounts(): Promise<string[]>;
        getAccounts(): Promise<string[]>;
        getBalance(): Promise<{ confirmed: number; unconfirmed: number; total: number; }>;
        getKRC20Balance(): Promise<Array<{
          balance: string;
          dec: string;
          locked: string;
          opScoreMod: string;
          tick: string;
        }>>;
        sendKaspa(
          address: string,
          amount: bigint,
          priorityFee?: number
        ): Promise<string>;
        signKRC20Transaction(
          inscribeJsonString: string,
          type: number,
          destAddr?: string,
          priorityFee?: number
        ): Promise<string>;
        disconnect(origin: string): Promise<void>;
        on(event: 'accountsChanged', handler: (accounts: string[]) => void): void;
        on(event: 'networkChanged', handler: (network: string) => void): void;
        removeListener(event: string, handler: Function): void;
        getPublicKey(): Promise<string>;
        signMessage(message: string): Promise<string>;
      };
    }
  }

  
  export class KaswareClientService {
    private static instance: KaswareClientService | null = null;
    private isInitialized: boolean = false;
    private readonly config: SwapConfig = {
      minterAddress: {
        KAS: "kaspa:qpgmt2dn8wcqf0436n0kueap7yx82n7raurlj6aqjc3t3wm9y5ssqtg9e4lsm",
        KRC20: "kaspa:qz9cqmddjppjyth8rngevfs767m5nvm0480nlgs5ve8d6aegv4g9xzu2tgg0u",
        CUSDT: "kaspa:qpy03sxk3z22pacz2vkn2nrqeglvptugyqy54xal2skha6xh0cr7wjueueg79",
        CUSDC: "kaspa:qpy03sxk3z22pacz2vkn2nrqeglvptugyqy54xal2skha6xh0cr7wjueueg79",
        CETH: "kaspa:qpy03sxk3z22pacz2vkn2nrqeglvptugyqy54xal2skha6xh0cr7wjueueg79",
        CBTC: "kaspa:qpy03sxk3z22pacz2vkn2nrqeglvptugyqy54xal2skha6xh0cr7wjueueg79",
        CXCHNG: "kaspa:qpy03sxk3z22pacz2vkn2nrqeglvptugyqy54xal2skha6xh0cr7wjueueg79"
      },
      priorityFee: 0.00002,
      networkId: "mainnet",
      backendUrl: "https://api.safunet.com/v1/Prophet"
    };
  
    private constructor() {
      if (KaswareClientService.instance) {
        return KaswareClientService.instance;
      }
  
      KaswareClientService.instance = this;
      return this;
    }
  
    static getInstance(): KaswareClientService {
      if (!KaswareClientService.instance) {
        KaswareClientService.instance = new KaswareClientService();
      }
      return KaswareClientService.instance;
    }
  
    async initialize(): Promise<void> {
      if (this.isInitialized) return;
  
      // if (typeof window.kasware === 'undefined') {
      //   throw new Error('KasWare wallet not detected. Please install KasWare wallet extension.');
      // }
  
      this.isInitialized = true;
    }

    async getOrderQuote(fromToken: string, toToken: string, amount: string): Promise<any> {
      try {
        const response = await fetch(`${this.config.backendUrl}/quote`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fromToken, toToken, amount })
        });
  
        if (!response.ok) throw new Error('Failed to get quote');
        return await response.json();
      } catch (error: any) {
        throw new Error(`Quote failed: ${error.message}`);
      }
    }
  
    async getOrderStatus(orderId: string): Promise<{ status: string }> {
      try {
        const response = await fetch(`${this.config.backendUrl}/order-status`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderId })
        });
  
        if (!response.ok) throw new Error('Failed to get order status');
        return await response.json();
      } catch (error: any) {
        throw new Error(`Status check failed: ${error.message}`);
      }
    }
  
    async connectWallet(): Promise<string[]> {
      await this.initialize();
      try {
        const accounts = await window.kasware.requestAccounts();
        return accounts;
      } catch (error) {
        console.error('Error connecting to KasWare wallet:', error);
        throw new Error('Failed to connect to wallet');
      }
    }
  
    async getCurrentAccount(): Promise<string | null> {
      await this.initialize();
      try {
        const accounts = await window.kasware.getAccounts();
        return accounts[0] || null;
      } catch (error) {
        console.error('Error getting current account:', error);
        return null;
      }
    }
  
    async getBalance(): Promise<KaspaBalance> {
      await this.initialize();
      try {
        const balance = await window.kasware.getBalance();
        return balance;
      } catch (error) {
        console.error('Error getting balance:', error);
        throw new Error('Failed to get balance');
      }
    }
  
    async getKRC20Balances(): Promise<KRC20Balance[]> {
      await this.initialize();
      try {
        const balances = await window.kasware.getKRC20Balance();
        return balances;
      } catch (error) {
        console.error('Error getting KRC20 balances:', error);
        throw new Error('Failed to get KRC20 balances');
      }
    }
  
    async executeSwap(fromToken: string, toToken: string, amount: string): Promise<SwapResult> {
      await this.initialize();
      const account = await this.getCurrentAccount();
      if (!account) throw new Error('No account connected');
      try {
        if (fromToken.toUpperCase().trim() === "KAS") {
          return await this.executeKASToTokenSwap(toToken, amount);
        } else {
          return await this.executeTokenSwap(fromToken, toToken, amount);
        }
      } catch (error) {
        console.error('Error executing swap:', error);
        throw new Error('Swap execution failed');
      }
    }
  
    private async executeKASToTokenSwap(toToken: string, amount: string): Promise<SwapResult> {
      try {
        const minterAddress = this.config.minterAddress["KAS"] || this.config.minterAddress.KRC20;
        const currentAccount = await this.getCurrentAccount();

        
        if (!currentAccount) {
          throw new Error('No account connected');
        }
  
        // Convert amount to Sompi (KAS * 100000000)
        const sompiAmount: any = Math.floor(parseFloat(amount) * 100000000);

        
        let txid: any
        try {
          txid = await window.kasware.sendKaspa(
            minterAddress,
            sompiAmount
          );
          txid = JSON.parse(txid)
          console.log(txid);
        } catch (e) {
          console.log(e);
          return {
            success: false,
            txHash: ""
          };
        }
  
        // Notify backend of the transaction
        let publicKey;
        try {
          publicKey = await window.kasware.getPublicKey();
        } catch (e) {
          console.log(e);
          throw new Error('cannot get public key');
        }


        const submittedOrderData = await this.notifyBackendOfTransaction({
          transactionHash: txid.id,
          fromToken: "KAS",
          toToken,
          amount,
          fromAddress: currentAccount,
          publicKey
        });
  
        return {
          success: true,
          txHash: txid.id,
          orderId: submittedOrderData.orderId
        };
      } catch (error) {
        return {
          success: false,
          txHash: '',
          error: error instanceof Error ? error.message : 'Unknown error occurred'
        };
      }
    }
  
    private async executeTokenSwap(fromToken: string, toToken: string, amount: string): Promise<SwapResult> {
      try {
        const minterAddress = this.config.minterAddress[fromToken.toUpperCase().trim()] || this.config.minterAddress.KRC20;
        const currentAccount = await this.getCurrentAccount();
        
        if (!currentAccount) {
          throw new Error('No account connected');
        }

        const sompiAmount: any = Math.floor(parseFloat(amount) * 100000000).toString();
        let txid: any
        try {
          txid = await window.kasware.signKRC20Transaction(
            JSON.stringify({
              p: "KRC-20",
              op: "transfer",
              tick: fromToken,
              amt: sompiAmount,
              to: minterAddress
            }),
            4, // type 4 for token transfer
            minterAddress,
            this.config.priorityFee
          );
          txid = JSON.parse(txid)
          console.log(txid);
        } catch (e) {
          console.log(e);
          return {
            success: false,
            txHash: ""
          };
        }

        let publicKey: string;
        try {
          publicKey = await window.kasware.getPublicKey();
        } catch (e) {
          throw new Error('cannot get public key');
        }
  
        const submittedOrderData = await this.notifyBackendOfTransaction({
          transactionHash: txid.revealId,
          fromToken,
          toToken,
          amount,
          fromAddress: currentAccount,
          publicKey
        });
  
        return {
          success: true,
          txHash: txid.revealId,
          orderId: submittedOrderData.orderId
        };
      } catch (error) {
        return {
          success: false,
          txHash: '',
          error: error instanceof Error ? error.message : 'Unknown error occurred'
        };
      }
    }
  
    private async notifyBackendOfTransaction(params: SwapParams): Promise<{orderId: string, status: string}> {
      try {
        // 1. Prepare order and get message hash
        const prepareResponse = await fetch(`${this.config.backendUrl}/prepare-order`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(params)
        });
  
        if (!prepareResponse.ok) {
          throw new Error('Failed to prepare order');
        }
  
        const prepareResult = await prepareResponse.json();
     
        if (prepareResult.status != 'prepared') {
          throw new Error(prepareResult.error || 'Order preparation failed');
        }
  
        // 2. Sign the message hash
        const messageHash = prepareResult.messageHash;
        let signature: string;
        try {
          signature = await window.kasware.signMessage(messageHash);
        } catch (e) {
          console.error('Error signing message:', e);
          throw new Error('Failed to sign order');
        }
  
        // 3. Submit the signed order
        const submitResponse = await fetch(`${this.config.backendUrl}/submit-order`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            orderParams: prepareResult.orderParams,
            fromAddress: params.fromAddress,
            publicKey: params.publicKey,
            signature
          })
        });
  
        if (!submitResponse.ok) {
          throw new Error('Failed to submit signed order');
        }
  
        const submitResult = await submitResponse.json();
        return submitResult
  
      } catch (error) {
        console.error('Error in order process:', error);
        throw error;
      }
    }
  
    async disconnect(origin: string): Promise<void> {
      await this.initialize();
      try {
        await window.kasware.disconnect(origin);
        this.isInitialized = false;
      } catch (error) {
        console.error('Error disconnecting wallet:', error);
        throw new Error('Failed to disconnect wallet');
      }
    }

    async getDexAvailableTokens(): Promise<Token[]> {
      try {
        const response = await fetch(`${this.config.backendUrl}/assets/KAS`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          }
        });
  
        if (!response.ok) {
          throw new Error('Failed to fetch available tokens');
        }
  
        const data = await response.json();
        
        return data.assets.map((token: any) => ({
          symbol: token.symbol,
          decimals: token.decimals,
          balance: '0'  // Default balance since this is just listing available tokens
        }));
      } catch (error) {
        console.error('Error fetching available tokens:', error);
        throw error;
      }
    }
  
    subscribeToAccountChanges(callback: (accounts: string[]) => void): void {
      if (window.kasware) {
        window.kasware.on('accountsChanged', callback);
      }
    }
  
    subscribeToNetworkChanges(callback: (network: string) => void): void {
      if (window.kasware) {
        window.kasware.on('networkChanged', callback);
      }
    }
  
    async getSwapStatus(txHash: string): Promise<any> {
      try {
        const response = await fetch(`${this.config.backendUrl}/swapStatus/${txHash}`);
        if (!response.ok) {
          throw new Error('Failed to fetch swap status');
        }
        return await response.json();
      } catch (error) {
        console.error('Error getting swap status:', error);
        throw error;
      }
    }
  }