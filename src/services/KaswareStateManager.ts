import { KaswareClientService } from "./KaswareClientService";

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
  
  export class KaswareStateManager extends EventTarget {
    private static instance: KaswareStateManager;
    private kaswareService: KaswareClientService;
    private state: KaswareState;
  
    private constructor() {
      super();
      this.kaswareService = KaswareClientService.getInstance();
      this.state = {
        account: null,
        isConnected: false,
        balance: null,
        krc20Balances: null,
        isLoading: false,
        error: null,
      };
  
      this.initialize();
    }
  
    static getInstance(): KaswareStateManager {
      if (!KaswareStateManager.instance) {
        KaswareStateManager.instance = new KaswareStateManager();
      }
      return KaswareStateManager.instance;
    }
  
    private initialize(): void {
      this.kaswareService.subscribeToAccountChanges(this.handleAccountsChanged.bind(this));
      
      // Check initial connection
      this.kaswareService.getCurrentAccount().then(account => {
        if (account) {
          this.handleAccountsChanged([account]);
        }
      });
    }
  
    private setState(newState: Partial<KaswareState>): void {
      this.state = { ...this.state, ...newState };
      this.dispatchEvent(new CustomEvent('stateChanged', { 
        detail: this.state 
      }));
    }
  
    public getState(): KaswareState {
      return { ...this.state };
    }
  
    public async connectWallet(): Promise<void> {
      this.setState({ isLoading: true, error: null });
      try {
        const accounts = await this.kaswareService.connectWallet();
        if (accounts.length > 0) {
          this.setState({
            account: accounts[0],
            isConnected: true,
            isLoading: false,
          });
          await this.refreshBalances();
        }
      } catch (error) {
        this.setState({
          error: 'Failed to connect wallet',
          isLoading: false,
        });
        throw error;
      }
    }
  
    public async refreshBalances(): Promise<void> {
      if (!this.state.account) return;
  
      try {
        const [balance, krc20Balances] = await Promise.all([
          this.kaswareService.getBalance(),
          this.kaswareService.getKRC20Balances(),
        ]);
  
        this.setState({
          balance,
          krc20Balances,
        });
      } catch (error) {
        this.setState({
          error: 'Failed to fetch balances',
        });
        throw error;
      }
    }
  
    private handleAccountsChanged(accounts: string[]): void {
      if (accounts.length === 0) {
        this.setState({
          account: null,
          isConnected: false,
          balance: null,
          krc20Balances: null,
        });
      } else {
        this.setState({
          account: accounts[0],
          isConnected: true,
        });
        this.refreshBalances().catch(console.error);
      }
    }
  
    public async disconnect(): Promise<void> {
      try {
        await this.kaswareService.disconnect(window.location.origin);
        this.setState({
          account: null,
          isConnected: false,
          balance: null,
          krc20Balances: null,
        });
      } catch (error) {
        this.setState({
          error: 'Failed to disconnect wallet',
        });
        throw error;
      }
    }
  
    public async signSwapTransaction(swapData: {
      fromToken: string;
      toToken: string;
      amount: string;
      slippage: number;
    }): Promise<string> {
      const swap = await this.kaswareService.executeSwap(swapData.fromToken, swapData.toToken, swapData.amount)
      return swap.txHash;
    }
  }