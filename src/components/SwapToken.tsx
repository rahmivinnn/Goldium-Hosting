import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { PublicKey, TransactionSignature, VersionedTransaction } from '@solana/web3.js';
import { FC, useState, useCallback, useEffect } from 'react';
import { notify } from '../utils/notifications';
import { TOKENS, JUPITER_CONFIG, SWAP_CONFIG, SOLSCAN_CONFIG, DEVELOPER_CONFIG, NETWORKS } from '../config/tokens';
import { useNetworkConfiguration } from '../contexts/NetworkConfigurationProvider';
import useTokenBalanceStore from '../stores/useTokenBalanceStore';
import { SwapClient } from '../utils/swapClient';

interface QuoteResponse {
  inputMint: string;
  inAmount: string;
  outputMint: string;
  outAmount: string;
  otherAmountThreshold: string;
  swapMode: string;
  slippageBps: number;
  platformFee: any;
  priceImpactPct: string;
  routePlan: any[];
  contextSlot: number;
  timeTaken: number;
}

interface SwapTokenProps {
  onSuccess?: () => void;
}

export const SwapToken: FC<SwapTokenProps> = ({ onSuccess }) => {
  const { connection } = useConnection();
  const { publicKey, sendTransaction } = useWallet();
  const { networkConfiguration } = useNetworkConfiguration();
  const { balances, getAllTokenBalances } = useTokenBalanceStore();
  
  const [fromToken, setFromToken] = useState<'SOL' | 'GOLD'>('SOL');
  const [toToken, setToToken] = useState<'SOL' | 'GOLD'>('GOLD');
  const [amount, setAmount] = useState('');
  const [quote, setQuote] = useState<QuoteResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isGettingQuote, setIsGettingQuote] = useState(false);
  const [lastTxid, setLastTxid] = useState<string | null>(null);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [slippage, setSlippage] = useState(50); // 0.5% default slippage
  const [useSmartContract, setUseSmartContract] = useState(false); // Toggle between Jupiter and Smart Contract
  const [swapClient, setSwapClient] = useState<SwapClient | null>(null);

  // Initialize swap client
  useEffect(() => {
    if (publicKey && connection) {
      const client = new SwapClient(connection, { publicKey, signTransaction: () => Promise.resolve() });
      setSwapClient(client);
    }
  }, [publicKey, connection]);

  // Get quote when amount or tokens change
  useEffect(() => {
    if (amount && parseFloat(amount) > 0) {
      const debounceTimer = setTimeout(() => {
        getQuote();
      }, 500); // Debounce API calls
      return () => clearTimeout(debounceTimer);
    } else {
      setQuote(null);
    }
  }, [amount, fromToken, toToken, slippage]);

  const getQuote = useCallback(async () => {
    if (!amount || parseFloat(amount) <= 0) return;

    setIsGettingQuote(true);
    try {
      const inputMint = fromToken === 'SOL' ? TOKENS.SOL.mint : TOKENS.GOLD.mint;
      const outputMint = toToken === 'SOL' ? TOKENS.SOL.mint : TOKENS.GOLD.mint;
      const inputAmount = Math.floor(parseFloat(amount) * Math.pow(10, TOKENS[fromToken].decimals));

      // Call Jupiter API for real quote
      const quoteUrl = `${JUPITER_CONFIG.apiUrl}/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${inputAmount}&slippageBps=${slippage}`;
      
      const response = await fetch(quoteUrl);
      if (!response.ok) {
        throw new Error(`Jupiter API error: ${response.status}`);
      }
      
      const quoteData: QuoteResponse = await response.json();
      setQuote(quoteData);
      
      if (DEVELOPER_CONFIG.logTransactions) {
        console.log('🔄 Real Quote Generated:', {
          from: fromToken,
          to: toToken,
          amount: amount,
          inputAmount,
          outputAmount: quoteData.outAmount,
          priceImpact: quoteData.priceImpactPct,
          slippage: slippage / 100
        });
      }
      
    } catch (error) {
      console.error('Error getting quote:', error);
      notify({ 
        type: 'error', 
        message: 'Failed to get quote', 
        description: 'Please try again or check your connection'
      });
      setQuote(null);
    } finally {
      setIsGettingQuote(false);
    }
  }, [amount, fromToken, toToken, slippage]);

  const handleSmartContractSwap = useCallback(async () => {
    if (!publicKey || !swapClient) {
      notify({ type: 'error', message: 'Wallet not connected or smart contract not available!' });
      return;
    }

    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      notify({ type: 'error', message: 'Invalid amount!' });
      return;
    }

    setIsLoading(true);
    
    try {
      const fromAmountLamports = amountNum * Math.pow(10, TOKENS[fromToken].decimals);
      const fromMint = fromToken === 'SOL' ? TOKENS.SOL.mint : TOKENS.GOLD.mint;
      const toMint = toToken === 'SOL' ? TOKENS.SOL.mint : TOKENS.GOLD.mint;
      
      // Get quote from smart contract
      const contractQuote = await swapClient.getSwapQuote(
        fromAmountLamports,
        fromToken
      );
      
      if (!contractQuote) {
        throw new Error('Unable to get quote from smart contract');
      }
      
      // Execute swap
      const signature = await swapClient.swap(
        fromAmountLamports,
        contractQuote.amountOut * (1 - slippage / 10000), // Apply slippage
        fromToken,
        toToken
      );
      
      notify({ 
        type: 'success', 
        message: 'Smart Contract Swap successful!',
        description: `Trackable on Solscan (${networkConfiguration}): ${SWAP_CONFIG.programId.slice(0, 8)}...${SWAP_CONFIG.programId.slice(-8)}`,
        txid: signature 
      });
      
      setLastTxid(signature);
      
      if (DEVELOPER_CONFIG.logTransactions) {
        console.log('🔗 Smart Contract Swap:', {
          from: fromToken,
          to: toToken,
          amount: amount,
          signature: signature,
          programId: SWAP_CONFIG.programId,
          network: networkConfiguration,
          solscanUrl: currentNetworkConfig.transactionUrl(signature),
          programUrl: currentNetworkConfig.programUrls.swap
        });
      }
      
      // Refresh balances
      await getAllTokenBalances(publicKey, connection);
      
      // Reset form
      setAmount('');
      setQuote(null);
      
      if (onSuccess) {
        onSuccess();
      }
      
    } catch (error: any) {
      const errorSignature = error?.signature || null;
      notify({ 
        type: 'error', 
        message: 'Smart Contract Swap failed!',
        description: error?.message || 'Unknown error occurred',
        txid: errorSignature
      });
      setLastTxid(errorSignature);
      console.error('Smart Contract Swap error:', error);
    } finally {
      setIsLoading(false);
    }
  }, [publicKey, swapClient, amount, fromToken, toToken, slippage, connection, getAllTokenBalances, onSuccess]);

  const handleSwap = useCallback(async () => {
    if (!publicKey || (!quote && !useSmartContract) || !connection) {
      notify({ type: 'error', message: 'Wallet not connected or no quote available!' });
      return;
    }

    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      notify({ type: 'error', message: 'Invalid amount!' });
      return;
    }

    // Check balance
    const currentBalance = balances[fromToken];
    
    // Enhanced debugging for balance checking
    console.log('🔄 Swap Balance Check Debug:');
    console.log('  - From Token:', fromToken);
    console.log('  - Swap Amount:', amountNum);
    console.log('  - Current Balance:', currentBalance);
    console.log('  - Balance Sufficient:', amountNum <= currentBalance);
    
    if (amountNum > currentBalance) {
      console.log('❌ Insufficient balance for swap!');
      notify({ 
        type: 'error', 
        message: `Insufficient ${fromToken} balance!`,
        description: `Need ${amountNum} ${fromToken}. Current: ${currentBalance.toFixed(6)} ${fromToken}`
      });
      return;
    }
    
    console.log('✅ Swap balance check passed!');

    if (useSmartContract) {
      await handleSmartContractSwap();
    } else {
      // Show confirmation dialog for Jupiter swap
      setShowConfirmation(true);
    }
  }, [publicKey, quote, amount, fromToken, balances, connection, useSmartContract, handleSmartContractSwap]);

  const confirmSwap = useCallback(async () => {
    if (!publicKey || !quote || !connection) return;

    setShowConfirmation(false);
    setIsLoading(true);
    let signature: TransactionSignature = '';
    setLastTxid(null);
    
    try {
      // Get swap transaction from Jupiter
      const swapResponse = await fetch(`${JUPITER_CONFIG.apiUrl}/swap`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          quoteResponse: quote,
          userPublicKey: publicKey.toString(),
          wrapAndUnwrapSol: true,
        }),
      });

      if (!swapResponse.ok) {
        throw new Error(`Jupiter swap API error: ${swapResponse.status}`);
      }

      const { swapTransaction } = await swapResponse.json();
      
      // Deserialize the transaction
      const swapTransactionBuf = Buffer.from(swapTransaction, 'base64');
      const transaction = VersionedTransaction.deserialize(new Uint8Array(swapTransactionBuf));
      
      // Send transaction
      signature = await sendTransaction(transaction, connection);
      
      // Confirm transaction
      const confirmation = await connection.confirmTransaction(signature, 'confirmed');
      
      if (confirmation.value.err) {
        throw new Error('Transaction failed');
      }
      
      if (DEVELOPER_CONFIG.logTransactions) {
        console.log('🔄 Real Swap Transaction:', {
          from: fromToken,
          to: toToken,
          amount: amount,
          quote: quote,
          signature: signature,
          network: networkConfiguration
        });
      }
      
      notify({ 
         type: 'success', 
         message: `Swap completed!`, 
         description: `${amount} ${fromToken} → ${outputAmount.toFixed(6)} ${toToken}`,
         txid: signature 
       });
      
      setLastTxid(signature);
      // Refresh balances
      await getAllTokenBalances(publicKey, connection);
      
      // Reset form
      setAmount('');
      setQuote(null);
      
      if (onSuccess) {
        onSuccess();
      }

    } catch (error: any) {
      notify({ 
        type: 'error', 
        message: `Swap failed!`, 
        description: error?.message || 'Unknown error occurred', 
        txid: signature 
      });
      setLastTxid(signature || null);
      console.error('Swap error:', error);
    } finally {
      setIsLoading(false);
    }
  }, [publicKey, quote, amount, fromToken, toToken, connection, getAllTokenBalances, onSuccess, networkConfiguration, sendTransaction]);

  const switchTokens = () => {
    setFromToken(toToken);
    setToToken(fromToken);
    setAmount('');
    setQuote(null);
  };

  const outputAmount = quote ? parseFloat(quote.outAmount) / Math.pow(10, TOKENS[toToken].decimals) : 0;
  const priceImpact = quote ? parseFloat(quote.priceImpactPct) : 0;
  
  // Get current network configuration for Solscan URLs
  const currentNetworkConfig = SOLSCAN_CONFIG.getNetworkConfig(networkConfiguration as keyof typeof NETWORKS);
  
  const getSolscanUrl = (txid: string) => {
    return currentNetworkConfig.transactionUrl(txid);
  };

  return (
    <div className="max-w-md mx-auto glass rounded-xl p-6 border border-gray-600/50 shadow-2xl hover-lift">
      <div className="text-center mb-6">
        <div className="text-4xl mb-2 animate-bounce">🔄</div>
        <h3 className="text-xl font-bold bg-gradient-to-r from-purple-400 to-yellow-400 bg-clip-text text-transparent mb-2 animate-gradient">Swap Tokens</h3>
        <p className="text-gray-300 text-sm">Exchange tokens using Jupiter aggregator</p>
      </div>
      
      <div className="space-y-4">
        {/* Swap Method Selection */}
        <div className="glass rounded-lg p-4 mb-4 border border-gray-600/30 hover:border-orange-500/50 transition-all duration-300 neon-orange animate-morphing hover-glow">
          <label className="block text-gray-300 text-sm font-medium mb-3 animate-pulse-glow">
            Swap Method
          </label>
          <div className="flex gap-2 mb-3">
            <button
              onClick={() => setUseSmartContract(false)}
              className={`flex-1 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-300 button-cyber hover-lift ${
                !useSmartContract
                  ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg neon-blue animate-glow'
                  : 'bg-gray-700 hover:bg-gray-600 text-gray-300 hover-scale'
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <span className="animate-twinkle">🚀</span>
                <span>Jupiter Aggregator</span>
              </div>
            </button>
            <button
              onClick={() => setUseSmartContract(true)}
              className={`flex-1 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-300 button-cyber hover-lift ${
                useSmartContract
                  ? 'bg-gradient-to-r from-orange-600 to-yellow-600 text-white shadow-lg neon-orange animate-glow'
                  : 'bg-gray-700 hover:bg-gray-600 text-gray-300 hover-scale'
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <span className="animate-twinkle animation-delay-1000">🔗</span>
                <span>Smart Contract</span>
              </div>
            </button>
          </div>
          <div className="text-xs text-gray-400 text-center animate-cyber-pulse">
            {!useSmartContract ? (
              <span className="animate-shimmer">✨ Best rates via Jupiter aggregator</span>
            ) : (
              <span className="animate-hologram">🔍 Trackable on Solscan: {SWAP_CONFIG.programId.slice(0, 8)}...{SWAP_CONFIG.programId.slice(-8)}</span>
            )}
          </div>
        </div>

        {/* Slippage Settings */}
        <div className="glass rounded-lg p-4 mb-6 border border-gray-600/30 hover:border-orange-500/50 transition-all duration-300 neon-orange animate-morphing animation-delay-2000 hover-glow">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-yellow-400 animate-twinkle">⚙️</span>
              <span className="text-white font-medium animate-pulse-glow">Slippage Tolerance</span>
            </div>
            <span className="text-orange-400 text-sm font-bold animate-cyber-pulse">{(slippage / 100).toFixed(1)}%</span>
          </div>
          <div className="flex gap-2 mb-2">
            {[10, 50, 100].map((value) => (
              <button
                key={value}
                onClick={() => setSlippage(value)}
                className={`px-3 py-1 rounded text-sm transition-all duration-300 button-cyber hover-lift ${
                  slippage === value 
                    ? 'bg-gradient-to-r from-orange-600 to-yellow-600 text-white shadow-lg neon-orange animate-glow' 
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600 hover-scale'
                }`}
              >
                {(value / 100).toFixed(1)}%
              </button>
            ))}
          </div>
          <div className="relative">
            <input
              type="range"
              min="10"
              max="500"
              step="10"
              value={slippage}
              onChange={(e) => setSlippage(parseInt(e.target.value))}
              className="w-full h-3 bg-gradient-to-r from-gray-700 via-gray-600 to-gray-700 rounded-lg appearance-none cursor-pointer slider hover-scale transition-all duration-300"
              style={{
                background: `linear-gradient(to right, 
                  rgba(249, 115, 22, 0.3) 0%, 
                  rgba(249, 115, 22, 0.6) ${(slippage - 10) / 490 * 100}%, 
                  rgba(75, 85, 99, 0.5) ${(slippage - 10) / 490 * 100}%, 
                  rgba(75, 85, 99, 0.5) 100%)`
              }}
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>0.1%</span>
              <span>2.5%</span>
              <span>5.0%</span>
            </div>
          </div>
        </div>

        {/* From Token */}
        <div className="glass rounded-lg p-4 mb-4 border border-gray-600/30 hover:border-purple-500/50 transition-all duration-300 neon-purple animate-morphing animation-delay-1000 hover-glow">
          <div className="flex justify-between items-center mb-2">
            <label className="text-gray-300 text-sm font-medium animate-pulse-glow">Exchange From</label>
            <span className="text-gray-300 text-sm bg-gray-800/50 px-3 py-1 rounded-full animate-cyber-pulse hover-scale">
              Available: <span className="text-purple-400 font-bold">{balances[fromToken].toFixed(6)}</span> {fromToken}
            </span>
          </div>
          <div className="flex items-center space-x-3">
            <select 
              className="flex-1 px-4 py-3 bg-gradient-to-r from-purple-600/20 to-blue-600/20 border border-gray-600 hover:border-purple-500 rounded-lg text-white focus:border-purple-400 focus:outline-none transition-all duration-300 shadow-lg hover:shadow-purple-500/20 button-cyber hover-lift"
              value={fromToken}
              onChange={(e) => setFromToken(e.target.value as 'SOL' | 'GOLD')}
            >
              <option value="SOL">◎ SOL - Solana</option>
              <option value="GOLD">🥇 GOLD - Goldium</option>
            </select>
          </div>
        </div>

        {/* Amount Input */}
        <div className="glass rounded-lg p-4 mb-4 border border-gray-600/30 hover:border-yellow-500/50 transition-all duration-300 neon-gold animate-morphing animation-delay-3000 hover-glow">
          <label className="block text-gray-300 text-sm font-medium mb-3 animate-pulse-glow">
            Swap Amount
          </label>
          <div className="flex gap-2">
            <input
              type="number"
              placeholder="Enter amount to swap"
              className="flex-1 px-4 py-3 bg-gradient-to-r from-yellow-600/10 to-orange-600/10 border border-gray-600 hover:border-yellow-500 rounded-lg text-white text-xl font-medium placeholder-gray-400 focus:border-yellow-400 focus:outline-none focus:text-yellow-400 transition-all duration-300 shadow-lg hover:shadow-yellow-500/20 button-cyber hover-lift animate-hologram"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              step="0.000001"
              min="0"
            />
            <button
              onClick={() => {
                setAmount(balances[fromToken].toString());
              }}
              className="px-4 py-3 bg-gradient-to-r from-yellow-600 to-orange-600 hover:from-yellow-700 hover:to-orange-700 text-white rounded-lg text-sm font-medium transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-yellow-500/30 button-cyber hover-lift animate-glow neon-gold"
            >
              <span className="animate-twinkle">MAX</span>
            </button>
          </div>
        </div>

        {/* Switch Direction Button */}
        <div className="flex justify-center">
          <button 
            className="p-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-full transition-all duration-300 transform hover:scale-110 hover:rotate-180 shadow-lg hover:shadow-indigo-500/30 button-cyber hover-lift animate-glow neon-purple disabled:opacity-50"
            onClick={switchTokens}
            disabled={isLoading}
            title="Switch exchange direction"
          >
            <span className="text-xl animate-twinkle">↕️</span>
          </button>
        </div>

        {/* To Token */}
        <div className="glass rounded-lg p-4 mb-4 border border-gray-600/30 hover:border-green-500/50 transition-all duration-300 neon-green animate-morphing animation-delay-4000 hover-glow">
          <div className="flex justify-between items-center mb-2">
            <label className="text-gray-300 text-sm font-medium animate-pulse-glow">Exchange To</label>
            <span className="text-gray-300 text-sm bg-gray-800/50 px-3 py-1 rounded-full animate-cyber-pulse hover-scale">
              Available: <span className="text-green-400 font-bold">{balances[toToken].toFixed(6)}</span> {toToken}
            </span>
          </div>
          <div className="flex items-center space-x-3">
            <select 
              className="flex-1 px-4 py-3 bg-gradient-to-r from-green-600/20 to-blue-600/20 border border-gray-600 hover:border-green-500 rounded-lg text-white focus:border-green-400 focus:outline-none transition-all duration-300 shadow-lg hover:shadow-green-500/20 button-cyber hover-lift"
              value={toToken}
              onChange={(e) => setToToken(e.target.value as 'SOL' | 'GOLD')}
            >
              <option value="SOL">◎ SOL - Solana</option>
              <option value="GOLD">🥇 GOLD - Goldium</option>
            </select>
          </div>
        </div>

        {/* Output Amount Display */}
        <div className="glass rounded-lg p-4 mb-4 border border-gray-600/30 hover:border-blue-500/50 transition-all duration-300 neon-blue animate-morphing animation-delay-5000 hover-glow">
          <label className="block text-gray-300 text-sm font-medium mb-3 animate-pulse-glow">
            You'll receive
          </label>
          <div className="px-4 py-3 bg-gradient-to-r from-blue-600/10 to-purple-600/10 border border-gray-600 rounded-lg text-white shadow-lg button-cyber hover-lift animate-hologram">
            {isGettingQuote ? (
              <div className="flex items-center gap-2">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-400 animate-cyber-pulse"></div>
                <span className="text-blue-300 animate-pulse-glow">Calculating best rate...</span>
              </div>
            ) : (
              <span className="text-green-400 text-xl font-bold animate-glow">{outputAmount > 0 ? outputAmount.toFixed(6) : '0.000000'} {toToken}</span>
            )}
          </div>
        </div>

        {/* Quote Display */}
        {(quote || (useSmartContract && amount && outputAmount > 0)) && (
          <div className="glass rounded-lg p-4 border border-gray-600/30 hover:border-green-500/50 transition-all duration-300 neon-green animate-morphing animation-delay-6000 hover-glow">
            <div className="flex justify-between items-center mb-3">
              <span className="text-gray-300 text-sm font-medium animate-pulse-glow">Swap Details</span>
              <span className={`text-xs px-3 py-1 rounded-full animate-cyber-pulse ${
                useSmartContract 
                  ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30 neon-orange'
                  : 'bg-blue-500/20 text-blue-400 border border-blue-500/30 neon-blue'
              }`}>
                {useSmartContract ? '🔗 Smart Contract' : '🚀 Jupiter'}
              </span>
            </div>
            
            <div className="flex justify-between items-center mb-2">
              <span className="text-gray-400">Exchange Rate:</span>
              <span className="text-white">1 {fromToken} = {amount && outputAmount > 0 ? (outputAmount / parseFloat(amount)).toFixed(6) : '0'} {toToken}</span>
            </div>
            
            {!useSmartContract && quote && (
              <>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-gray-400">Price Impact:</span>
                  <span className="text-blue-400">
                    {priceImpact.toFixed(2)}%
                  </span>
                </div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-gray-400">Route:</span>
                  <span className="text-purple-400 font-medium text-xs">
                    {quote.routePlan ? `${quote.routePlan.length} hop(s)` : 'Direct'}
                  </span>
                </div>
              </>
            )}
            
            {useSmartContract && (
              <>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-gray-400">Program ID:</span>
                  <span className="text-orange-400 font-medium text-xs font-mono">
                    {SWAP_CONFIG.programId.slice(0, 8)}...{SWAP_CONFIG.programId.slice(-8)}
                  </span>
                </div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-gray-400">Fee Rate:</span>
                  <span className="text-yellow-400 font-medium">
                    {SWAP_CONFIG.feeRate}%
                  </span>
                </div>
              </>
            )}
            
            <div className="flex justify-between items-center">
              <span className="text-gray-400">Minimum Received:</span>
              <span className="text-blue-400 font-medium">
                {amount && outputAmount > 0 ? (outputAmount * (1 - slippage / 10000)).toFixed(6) : '0'} {toToken}
              </span>
            </div>
            
            <div className="text-xs text-gray-500 mt-2">
              {useSmartContract ? (
                <div className="flex flex-col items-center justify-center gap-1">
                  <div className="flex items-center gap-2">
                    <span>🔍</span>
                    <span>Trackable on Solscan ({networkConfiguration})</span>
                  </div>
                  <a 
                    href={currentNetworkConfig.programUrls.swap} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-blue-400 hover:text-blue-300 underline"
                  >
                    View Program
                  </a>
                </div>
              ) : (
                <span>⚡ Powered by Jupiter aggregator for best rates</span>
              )}
            </div>
          </div>
        )}

        {/* Swap Button */}
        <button
          className={`w-full py-4 px-6 rounded-xl font-bold text-lg transition-all duration-300 transform hover:scale-105 shadow-2xl disabled:from-gray-600/50 disabled:to-gray-600/50 disabled:text-gray-400 disabled:cursor-not-allowed disabled:opacity-50 text-white animate-gradient button-cyber hover-lift ${
            useSmartContract
              ? 'bg-gradient-to-r from-orange-600 via-yellow-600 to-orange-600 hover:from-orange-700 hover:via-yellow-700 hover:to-orange-700 neon-orange hover:shadow-orange-500/50 animate-glow'
              : 'bg-gradient-to-r from-purple-600 via-blue-600 to-purple-600 hover:from-purple-700 hover:via-blue-700 hover:to-purple-700 neon-purple hover:shadow-purple-500/50 animate-glow'
          }`}
          onClick={handleSwap}
          disabled={!publicKey || isLoading || !amount || (!quote && !useSmartContract) || isGettingQuote}
        >
          {isLoading ? (
            <div className="flex items-center justify-center space-x-3">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white animate-cyber-pulse"></div>
              <span className="animate-pulse-glow">{useSmartContract ? 'Smart Contract Swapping...' : 'Jupiter Swapping...'}</span>
            </div>
          ) : isGettingQuote ? (
            <div className="flex items-center justify-center space-x-2">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white animate-cyber-pulse"></div>
              <span className="animate-pulse-glow">Getting Quote...</span>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center gap-1">
              <div className="flex items-center justify-center space-x-2">
                <span className="animate-twinkle">{useSmartContract ? '🔗' : '🚀'}</span>
                <span className="animate-shimmer">Swap {fromToken} for {toToken}</span>
                <span className="animate-twinkle animation-delay-1000">{useSmartContract ? '🔗' : '🚀'}</span>
              </div>
              <div className="text-xs opacity-80">
                {useSmartContract ? (
                  <span className="animate-hologram">📊 Trackable on Solscan ({networkConfiguration}): {SWAP_CONFIG.programId.slice(0, 8)}...{SWAP_CONFIG.programId.slice(-8)}</span>
                ) : (
                  <span className="animate-shimmer">⚡ Best rates via Jupiter aggregator</span>
                )}
              </div>
            </div>
          )}
        </button>

        {/* Transaction Link */}
        {lastTxid && (
          <div className="mt-4 text-center">
            <div className="glass bg-green-900/30 border border-green-500 p-4 rounded-lg neon-green animate-glow hover-glow">
              <div className="text-green-300 text-sm mb-2 flex items-center justify-center gap-2 animate-pulse-glow">
                <span className="animate-twinkle">✅</span>
                <span>Transaction Successful!</span>
              </div>
              <a
                href={getSolscanUrl(lastTxid)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-yellow-400 hover:text-yellow-300 underline text-sm font-medium button-cyber hover-lift animate-shimmer"
              >
                🔍 View on Solscan: {lastTxid.slice(0, 8)}...{lastTxid.slice(-8)}
              </a>
            </div>
          </div>
        )}
      </div>

      {/* Educational Confirmation Modal */}
      {showConfirmation && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 animate-morphing">
          <div className="glass bg-gray-800/90 border border-gray-600/50 rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl neon-purple animate-glow hover-glow">
            <h3 className="text-xl font-bold text-white mb-4 animate-pulse-glow flex items-center gap-2">
              <span className="animate-twinkle">🔄</span>
              <span>Confirm Swap</span>
            </h3>
            <div className="space-y-3 mb-6">
              <div className="glass bg-gray-700/50 p-4 rounded-lg border border-gray-600/30 hover-glow">
                <div className="text-sm text-gray-400 mb-2 animate-pulse-glow">Swap Details:</div>
                <div className="flex justify-between text-white mb-1">
                  <span>From:</span>
                  <span className="font-medium animate-shimmer">{amount} {fromToken}</span>
                </div>
                <div className="flex justify-between text-white mb-1">
                  <span>To:</span>
                  <span className="font-medium text-green-400 animate-glow">{outputAmount.toFixed(6)} {toToken}</span>
                </div>
                <div className="flex justify-between text-white mb-1">
                  <span>Rate:</span>
                  <span className="font-medium animate-cyber-pulse">{(outputAmount / parseFloat(amount)).toFixed(6)} {toToken}/{fromToken}</span>
                </div>
                <div className="flex justify-between text-white mb-1">
                  <span>Price Impact:</span>
                  <span className="font-medium animate-hologram">{quote?.priceImpactPct ? `${parseFloat(quote.priceImpactPct).toFixed(2)}%` : 'N/A'}</span>
                </div>
                <div className="flex justify-between text-white">
                  <span>Slippage Tolerance:</span>
                  <span className="font-medium text-orange-400 animate-glow">{(slippage / 100).toFixed(1)}%</span>
                </div>
              </div>
              <div className="glass bg-yellow-900/30 border border-yellow-500/50 p-3 rounded-lg neon-gold hover-glow">
                <div className="text-yellow-300 text-sm flex items-center gap-2 animate-pulse-glow">
                  <span className="animate-twinkle">⚠️</span>
                  <span>This transaction will swap real tokens. Please review carefully before confirming.</span>
                </div>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirmation(false)}
                className="flex-1 py-3 px-4 bg-gray-600/80 hover:bg-gray-700/80 text-white rounded-lg transition-all duration-300 button-cyber hover-lift hover-scale"
              >
                <span className="animate-shimmer">Cancel</span>
              </button>
              <button
                onClick={confirmSwap}
                className="flex-1 py-3 px-4 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-lg transition-all duration-300 button-cyber hover-lift animate-glow neon-purple"
              >
                <span className="animate-shimmer">Confirm Swap</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};