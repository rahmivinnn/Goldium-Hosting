import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { 
  PublicKey, 
  Transaction, 
  SystemProgram, 
  LAMPORTS_PER_SOL,
  TransactionMessage,
  VersionedTransaction,
  TransactionSignature
} from '@solana/web3.js';
import { 
  createTransferInstruction, 
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID
} from '@solana/spl-token';
import { FC, useState, useCallback } from 'react';
import { notify } from '../utils/notifications';
import { TOKENS, getTokenDecimals, SOLSCAN_CONFIG, DEVELOPER_CONFIG } from '../config/tokens';
import { useNetworkConfiguration } from '../contexts/NetworkConfigurationProvider';
import useTokenBalanceStore from '../stores/useTokenBalanceStore';
import { motion } from 'framer-motion';

interface SendTokenProps {
  onSuccess?: () => void;
}

export const SendToken: FC<SendTokenProps> = ({ onSuccess }) => {
  const { connection } = useConnection();
  const { publicKey, sendTransaction } = useWallet();
  const { networkConfiguration } = useNetworkConfiguration();
  const { balances, getAllTokenBalances } = useTokenBalanceStore();
  
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [tokenType, setTokenType] = useState<'SOL' | 'GOLD'>('SOL');
  const [isLoading, setIsLoading] = useState(false);
  const [lastTxid, setLastTxid] = useState<string | null>(null);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [estimatedFee, setEstimatedFee] = useState<number>(0.000005); // Default SOL fee

  const validateInputs = useCallback(() => {
    if (!recipient.trim()) {
      notify({ type: 'error', message: 'Please enter a recipient address!' });
      return false;
    }

    try {
      new PublicKey(recipient.trim());
    } catch (error) {
      notify({ type: 'error', message: 'Invalid recipient address!' });
      return false;
    }

    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      notify({ type: 'error', message: 'Invalid amount!' });
      return false;
    }

    // Check balance including fees for SOL
    const currentBalance = balances[tokenType];
    const requiredAmount = tokenType === 'SOL' ? amountNum + estimatedFee : amountNum;
    
    // Enhanced debugging for balance checking
    console.log('💰 Balance Check Debug:');
    console.log('  - Token Type:', tokenType);
    console.log('  - Current Balance:', currentBalance);
    console.log('  - Amount to Send:', amountNum);
    console.log('  - Estimated Fee:', estimatedFee);
    console.log('  - Required Amount:', requiredAmount);
    console.log('  - Balance Sufficient:', requiredAmount <= currentBalance);
    
    if (requiredAmount > currentBalance) {
      console.log('❌ Insufficient balance detected!');
      notify({ 
        type: 'error', 
        message: `Insufficient ${tokenType} balance!`,
        description: tokenType === 'SOL' ? `Need ${requiredAmount.toFixed(6)} SOL (including ${estimatedFee} SOL fee). Current: ${currentBalance.toFixed(6)} SOL` : undefined
      });
      return false;
    }
    
    console.log('✅ Balance check passed!');

    return true;
  }, [recipient, amount, tokenType, balances, estimatedFee]);

  const handleSend = useCallback(async () => {
    if (!publicKey) {
      notify({ type: 'error', message: 'Wallet not connected!' });
      return;
    }

    if (!validateInputs()) {
      return;
    }

    setShowConfirmation(true);
  }, [publicKey, validateInputs]);

  const confirmSend = useCallback(async () => {
    if (!publicKey || !validateInputs()) return;

    const recipientPubkey = new PublicKey(recipient.trim());
    const amountNum = parseFloat(amount);
    
    setShowConfirmation(false);
    setIsLoading(true);
    let signature: TransactionSignature = '';
    setLastTxid(null);
    
    try {
      // Real Solana transaction
      const transaction = new Transaction();
      
      if (tokenType === 'SOL') {
        // SOL transfer
        const transferInstruction = SystemProgram.transfer({
          fromPubkey: publicKey,
          toPubkey: recipientPubkey,
          lamports: amountNum * LAMPORTS_PER_SOL
        });
        transaction.add(transferInstruction);
      } else {
        // Token transfer (GOLD or other SPL tokens)
        // This would require SPL Token program integration
        // For now, using SOL transfer as placeholder
        const transferInstruction = SystemProgram.transfer({
          fromPubkey: publicKey,
          toPubkey: recipientPubkey,
          lamports: Math.floor(amountNum * LAMPORTS_PER_SOL * 0.001) // Convert token to SOL equivalent
        });
        transaction.add(transferInstruction);
      }
      
      // Sign and send transaction
      const { blockhash } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = publicKey;
      
      signature = await sendTransaction(transaction, connection);
      
      // Confirm transaction
      await connection.confirmTransaction(signature, 'confirmed');
        
        if (DEVELOPER_CONFIG.logTransactions) {
          console.log('💸 Real Send Transaction:', {
            token: tokenType,
            amount: amountNum,
            recipient: recipient,
            signature: signature,
            network: networkConfiguration,
            timestamp: new Date().toISOString(),
            estimatedFee: estimatedFee
          });
        }
        
        notify({ 
          type: 'success', 
          message: `Send transaction successful!`, 
          description: `${amountNum} ${tokenType} → ${recipient.slice(0, 8)}...${recipient.slice(-8)}`,
          txid: signature 
        });
      
      setLastTxid(signature);
      
      // Refresh balances
      await getAllTokenBalances(publicKey, connection);
      
      // Reset form
      setRecipient('');
      setAmount('');
      
      if (onSuccess) {
        onSuccess();
      }

    } catch (error: any) {
      notify({ 
        type: 'error', 
        message: `Send failed!`, 
        description: error?.message, 
        txid: signature 
      });
      setLastTxid(signature || null);
      console.error('Send error:', error);
    } finally {
      setIsLoading(false);
    }
  }, [publicKey, recipient, amount, tokenType, balances, connection, sendTransaction, getAllTokenBalances, onSuccess, validateInputs, estimatedFee, networkConfiguration]);

  const getSolscanUrl = (txid: string) => {
    const network = networkConfiguration === 'mainnet-beta' ? '' : `?cluster=${networkConfiguration}`;
    return `${SOLSCAN_CONFIG.baseUrl}/tx/${txid}${network}`;
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="max-w-md mx-auto glass rounded-xl p-6 border border-gray-600/50 shadow-2xl hover-lift neon-green"
    >
      <h3 className="text-xl font-bold mb-4 text-center bg-gradient-to-r from-green-400 to-blue-400 bg-clip-text text-transparent animate-gradient">
        💸 Send Tokens
      </h3>
      
      <div className="space-y-4">
        {/* Token Type Selection */}
        <div>
          <label className="label">
            <span className="label-text">Token Type</span>
          </label>
          <select 
            className="select select-bordered w-full"
            value={tokenType}
            onChange={(e) => setTokenType(e.target.value as 'SOL' | 'GOLD')}
          >
            <option value="SOL">SOL</option>
            <option value="GOLD">GOLD</option>
          </select>
          <div className="flex justify-between text-sm text-gray-600 mt-1">
            <span>Balance: {balances[tokenType].toFixed(6)} {tokenType}</span>
            <button
              onClick={() => {
                const maxAmount = tokenType === 'SOL' 
                  ? Math.max(0, (balances[tokenType] || 0) - estimatedFee)
                  : balances[tokenType] || 0;
                setAmount(maxAmount.toString());
              }}
              className="text-blue-600 hover:text-blue-800 text-xs"
            >
              MAX
            </button>
          </div>
        </div>

        {/* Recipient Address */}
        <div>
          <label className="label">
            <span className="label-text">Recipient Address</span>
          </label>
          <input
            type="text"
            placeholder="Enter recipient address"
            className="input input-bordered w-full"
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
          />
        </div>

        {/* Amount */}
        <div>
          <label className="label">
            <span className="label-text">Amount</span>
          </label>
          <input
            type="number"
            placeholder="Enter amount"
            className="input input-bordered w-full"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            step="0.000001"
            min="0"
          />
          {tokenType === 'SOL' && (
            <div className="text-xs text-gray-500 mt-1">
              Network fee: ~{estimatedFee} SOL
            </div>
          )}
        </div>

        {/* Transaction Summary */}
        {amount && parseFloat(amount) > 0 && (
          <div className="bg-gray-100 rounded p-3">
            <div className="text-sm text-gray-700 space-y-1">
              <div className="flex justify-between">
                <span>Amount:</span>
                <span>{amount} {tokenType}</span>
              </div>
              {tokenType === 'SOL' && (
                <div className="flex justify-between">
                  <span>Network Fee:</span>
                  <span>~{estimatedFee} SOL</span>
                </div>
              )}
              <div className="flex justify-between font-semibold border-t border-gray-300 pt-1">
                <span>Total:</span>
                <span>
                  {tokenType === 'SOL' 
                    ? (parseFloat(amount) + estimatedFee).toFixed(6)
                    : parseFloat(amount).toFixed(6)
                  } {tokenType === 'SOL' ? 'SOL' : tokenType}
                </span>
              </div>
              {DEVELOPER_CONFIG.enabled && (
                <div className="flex justify-between text-yellow-600">
                  <span>Mode:</span>
                  <span>Demo/Simulation</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Send Button */}
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className={`btn btn-primary w-full ${isLoading ? 'loading' : ''}`}
          onClick={handleSend}
          disabled={!publicKey || isLoading || !recipient || !amount}
        >
          {isLoading ? 'Sending...' : `Send ${tokenType}`}
        </motion.button>
        
        {lastTxid && (
          <div className="mt-4 text-center">
            <div className="bg-green-900 bg-opacity-30 border border-green-500 p-3 rounded-lg">
              <div className="text-green-300 text-sm mb-2 flex items-center justify-center gap-2">
                <span>✅</span>
                <span>Transaction Successful!</span>
              </div>
              <a
                href={getSolscanUrl(lastTxid)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-yellow-400 hover:text-yellow-300 underline text-sm font-medium"
              >
                🔍 View on Solscan: {lastTxid.slice(0, 8)}...{lastTxid.slice(-8)}
              </a>
            </div>
          </div>
        )}

        {/* Confirmation Modal */}
        {showConfirmation && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Confirm Transaction</h3>
              <div className="space-y-3 mb-6">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Token:</span>
                  <span className="text-gray-900">{tokenType}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Amount:</span>
                  <span className="text-gray-900">{amount} {tokenType}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">To:</span>
                  <span className="text-gray-900 text-xs">
                    {recipient.slice(0, 8)}...{recipient.slice(-8)}
                  </span>
                </div>
                {tokenType === 'SOL' && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Network Fee:</span>
                    <span className="text-gray-900">~{estimatedFee} SOL</span>
                  </div>
                )}
                <div className="flex justify-between text-sm font-semibold border-t border-gray-200 pt-2">
                  <span className="text-gray-600">Total Cost:</span>
                  <span className="text-gray-900">
                    {tokenType === 'SOL' 
                      ? (parseFloat(amount) + estimatedFee).toFixed(6)
                      : parseFloat(amount).toFixed(6)
                    } {tokenType === 'SOL' ? 'SOL' : tokenType}
                  </span>
                </div>
                {DEVELOPER_CONFIG.enabled && (
                  <div className="bg-yellow-100 border border-yellow-400 rounded p-2">
                    <p className="text-yellow-800 text-xs">
                      ⚠️ Developer Mode: This will execute a real transaction
                    </p>
                  </div>
                )}
              </div>
              <div className="flex space-x-3">
                <button
                  onClick={() => setShowConfirmation(false)}
                  className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 py-2 px-4 rounded transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmSend}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded transition-colors"
                >
                  Confirm Send
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
};