import { create } from 'zustand';
import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { getAccount, getAssociatedTokenAddress } from '@solana/spl-token';
import { TOKENS } from '../config/tokens';

interface State {
  balances: TokenBalance;
  isLoading: boolean;
}

interface TokenBalance {
  SOL: number;
  GOLD: number;
}

interface TokenBalanceStore extends State {
  balances: TokenBalance;
  isLoading: boolean;
  getTokenBalance: (publicKey: PublicKey, connection: Connection, tokenSymbol: keyof TokenBalance) => Promise<void>;
  getAllTokenBalances: (publicKey: PublicKey, connection: Connection) => Promise<void>;
}

const useTokenBalanceStore = create<TokenBalanceStore>((set, get) => ({
  balances: {
    SOL: 0,
    GOLD: 0,
  },
  isLoading: false,
  
  getTokenBalance: async (publicKey, connection, tokenSymbol) => {
    set({ isLoading: true });
    
    try {
      let balance = 0;
      
      if (tokenSymbol === 'SOL') {
        // Get SOL balance with retry
        for (let i = 0; i < 3; i++) {
          try {
            const solBalance = await connection.getBalance(publicKey, 'confirmed');
            balance = solBalance / LAMPORTS_PER_SOL;
            console.log(`SOL balance fetched (attempt ${i + 1}):`, balance);
            break;
          } catch (error) {
            console.warn(`SOL balance fetch attempt ${i + 1} failed:`, error);
            if (i === 2) throw error;
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
      } else if (tokenSymbol === 'GOLD') {
        // Get GOLD token balance with retry
        const tokenMint = new PublicKey(TOKENS.GOLD.mint);
        console.log('GOLD token mint address:', TOKENS.GOLD.mint);
        
        for (let i = 0; i < 3; i++) {
          try {
            const tokenAccount = await getAssociatedTokenAddress(tokenMint, publicKey);
            console.log(`GOLD token account address (attempt ${i + 1}):`, tokenAccount.toBase58());
            
            // Check if token account exists
            const accountInfo = await connection.getAccountInfo(tokenAccount, 'confirmed');
            if (accountInfo) {
              const tokenAccountInfo = await getAccount(connection, tokenAccount);
              balance = Number(tokenAccountInfo.amount) / Math.pow(10, TOKENS.GOLD.decimals);
              console.log(`GOLD balance fetched (attempt ${i + 1}):`, balance);
            } else {
              console.log(`GOLD token account does not exist (attempt ${i + 1})`);
              balance = 0;
            }
            break;
          } catch (error) {
            console.warn(`GOLD balance fetch attempt ${i + 1} failed:`, error);
            if (i === 2) {
              console.log('GOLD token account does not exist or error occurred, setting balance to 0');
              balance = 0;
            } else {
              await new Promise(resolve => setTimeout(resolve, 1000));
            }
          }
        }
      }
      
      set((state) => ({
        balances: {
          ...state.balances,
          [tokenSymbol]: balance,
        },
        isLoading: false,
      }));
      
      console.log(`✅ ${tokenSymbol} balance updated successfully:`, balance);
    } catch (error) {
      console.error(`❌ Error getting ${tokenSymbol} balance:`, error);
      set({ isLoading: false });
    }
  },
  
  getAllTokenBalances: async (publicKey, connection) => {
    console.log('🔄 Starting getAllTokenBalances...');
    console.log('📍 Wallet publicKey:', publicKey?.toBase58());
    console.log('🌐 Connection endpoint:', connection?.rpcEndpoint);
    
    if (!publicKey) {
      console.error('❌ No wallet publicKey provided');
      set({ isLoading: false });
      return;
    }
    
    if (!connection) {
      console.error('❌ No connection provided');
      set({ isLoading: false });
      return;
    }
    
    set({ isLoading: true });
    
    try {
      // Get SOL balance with retry
      let solAmount = 0;
      for (let i = 0; i < 3; i++) {
        try {
          const solBalance = await connection.getBalance(publicKey, 'confirmed');
          solAmount = solBalance / LAMPORTS_PER_SOL;
          console.log(`SOL balance fetched (attempt ${i + 1}):`, solAmount);
          break;
        } catch (error) {
          console.warn(`SOL balance fetch attempt ${i + 1} failed:`, error);
          if (i === 2) throw error;
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
      
      // Get GOLD balance with retry and enhanced validation
      let goldAmount = 0;
      const tokenMint = new PublicKey(TOKENS.GOLD.mint);
      console.log('GOLD token mint address:', TOKENS.GOLD.mint);
      
      for (let i = 0; i < 3; i++) {
        try {
          const tokenAccount = await getAssociatedTokenAddress(tokenMint, publicKey);
          console.log(`GOLD token account address (attempt ${i + 1}):`, tokenAccount.toBase58());
          
          // Enhanced validation: Check if token account exists and has data
          const accountInfo = await connection.getAccountInfo(tokenAccount, 'confirmed');
          if (accountInfo && accountInfo.data && accountInfo.data.length > 0) {
            // Verify account owner is SPL Token program
            const TOKEN_PROGRAM_ID = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
            if (accountInfo.owner.equals(TOKEN_PROGRAM_ID)) {
              const tokenAccountInfo = await getAccount(connection, tokenAccount);
              goldAmount = Number(tokenAccountInfo.amount) / Math.pow(10, TOKENS.GOLD.decimals);
              console.log(`GOLD balance fetched (attempt ${i + 1}):`, goldAmount);
            } else {
              console.log(`GOLD token account owner is not SPL Token program (attempt ${i + 1})`);
              goldAmount = 0;
            }
          } else {
            console.log(`GOLD token account does not exist or has no data (attempt ${i + 1})`);
            goldAmount = 0;
          }
          break;
        } catch (error) {
          console.warn(`GOLD balance fetch attempt ${i + 1} failed:`, error);
          if (i === 2) {
            console.log('GOLD token account does not exist or error occurred, setting balance to 0');
            goldAmount = 0;
          } else {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
      }
      
      set({
        balances: {
          SOL: solAmount,
          GOLD: goldAmount,
        },
        isLoading: false,
      });
      
      console.log('✅ All token balances updated successfully:');
      console.log('  - SOL Balance:', solAmount.toFixed(6), 'SOL');
      console.log('  - GOLD Balance:', goldAmount.toFixed(6), 'GOLD');
      console.log('  - Last Updated:', new Date().toLocaleTimeString());
      console.log('  - Wallet Address:', publicKey.toBase58().slice(0, 8) + '...');
      
      // Show success notification
      console.log('🎉 Balance update completed!');
      console.log(`💰 Current balances - SOL: ${solAmount}, GOLD: ${goldAmount}`);
      
      // Trigger a custom event for UI notifications
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('balanceUpdated', {
          detail: { SOL: solAmount, GOLD: goldAmount }
        }));
      }
    } catch (error) {
      console.error('❌ Error getting all token balances:', error);
      set({ isLoading: false });
    }
  },
}));

export default useTokenBalanceStore;