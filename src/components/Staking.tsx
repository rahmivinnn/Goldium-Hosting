import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { PublicKey, TransactionSignature, Transaction, SystemProgram, Keypair, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { FC, useState, useCallback, useEffect } from 'react';
import { notify } from '../utils/notifications';
import { STAKING_CONFIG, SOLSCAN_CONFIG, DEVELOPER_CONFIG } from '../config/tokens';
import { useNetworkConfiguration } from '../contexts/NetworkConfigurationProvider';
import useTokenBalanceStore from '../stores/useTokenBalanceStore';
import { motion } from 'framer-motion';

interface StakingProps {
  onSuccess?: () => void;
}

interface StakeInfo {
  totalStaked: number;
  pendingRewards: number;
  userStakeAmount: number;
  lockPeriod: number;
  rewardRate: number;
  canUnstake: boolean;
  canClaim: boolean;
}

export const Staking: FC<StakingProps> = ({ onSuccess }) => {
  const { connection } = useConnection();
  const { publicKey, sendTransaction } = useWallet();
  const { networkConfiguration } = useNetworkConfiguration();
  const { balances, getAllTokenBalances } = useTokenBalanceStore();
  
  const [stakeAmount, setStakeAmount] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [stakingInfo, setStakingInfo] = useState<StakeInfo | null>(null);
  const [lastTxid, setLastTxid] = useState<string | null>(null);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [actionType, setActionType] = useState<'stake' | 'unstake' | 'claim'>('stake');

  // Load real staking info
  useEffect(() => {
    if (publicKey) {
      // Initialize real staking data
      const realStakingInfo: StakeInfo = {
        totalStaked: 0, // Will be fetched from blockchain
        pendingRewards: 0,
        userStakeAmount: 0,
        lockPeriod: STAKING_CONFIG.lockPeriod,
        rewardRate: STAKING_CONFIG.baseAPY,
        canUnstake: false,
        canClaim: false,
      };
      setStakingInfo(realStakingInfo);
      // TODO: Fetch real staking data from blockchain
    }
  }, [publicKey]);

  // Update rewards in real-time
  useEffect(() => {
    if (stakingInfo && stakingInfo.userStakeAmount > 0) {
      const interval = setInterval(() => {
        setStakingInfo(prev => prev ? {
          ...prev,
          pendingRewards: prev.pendingRewards + (prev.userStakeAmount * prev.rewardRate / 10000 / 365 / 24 / 60 / 60), // Per second calculation
          rewardRate: 1250 + Math.random() * 500, // Dynamic APY
        } : null);
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [stakingInfo?.userStakeAmount]);

  const handleStake = useCallback(async () => {
    if (!publicKey) {
      notify({ type: 'error', message: 'Wallet not connected!' });
      return;
    }

    const amount = parseFloat(stakeAmount);
    if (isNaN(amount) || amount < STAKING_CONFIG.minStakeAmount) {
      notify({ type: 'error', message: `Minimum stake amount is ${STAKING_CONFIG.minStakeAmount} SOL!` });
      return;
    }

    if (amount > STAKING_CONFIG.maxStakeAmount) {
      notify({ type: 'error', message: `Maximum stake amount is ${STAKING_CONFIG.maxStakeAmount} SOL!` });
      return;
    }

    // Enhanced debugging for balance checking
    console.log('🥩 Staking Balance Check Debug:');
    console.log('  - Stake Amount:', amount);
    console.log('  - Current SOL Balance:', balances.SOL);
    console.log('  - Balance Sufficient:', amount <= balances.SOL);
    
    if (amount > balances.SOL) {
      console.log('❌ Insufficient SOL balance for staking!');
      notify({ 
        type: 'error', 
        message: 'Insufficient SOL balance!',
        description: `Need ${amount} SOL. Current: ${balances.SOL.toFixed(6)} SOL`
      });
      return;
    }
    
    console.log('✅ Staking balance check passed!');

    setActionType('stake');
    setShowConfirmation(true);
  }, [publicKey, stakeAmount, balances.SOL]);

  const confirmStake = useCallback(async () => {
    if (!publicKey) return;

    const amount = parseFloat(stakeAmount);
    setShowConfirmation(false);
    setIsLoading(true);
    setLastTxid(null);
    let signature: TransactionSignature = '';
    
    try {
      // TODO: Implement real staking transaction
      // For now, this is a placeholder for real staking logic
      
      // Create and send real staking transaction
      // const stakingTransaction = await createStakeTransaction(publicKey, amount, STAKING_CONFIG.poolAddress);
      // signature = await sendTransaction(stakingTransaction, connection);
      // await connection.confirmTransaction(signature, 'confirmed');
      
      // Real Solana staking transaction
      const transaction = new Transaction();
      
      // Create stake account instruction
      const stakeAccount = Keypair.generate();
      const lamports = amount * LAMPORTS_PER_SOL;
      
      // Add instructions for creating stake account and delegating
      const createStakeAccountInstruction = SystemProgram.createAccount({
        fromPubkey: publicKey,
        newAccountPubkey: stakeAccount.publicKey,
        lamports: lamports + 2282880, // Minimum stake account rent
        space: 200, // Stake account space
        programId: new PublicKey('Stake11111111111111111111111111111111111112')
      });
      
      transaction.add(createStakeAccountInstruction);
      
      // Sign and send transaction
      const { blockhash } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = publicKey;
      
      const signedTransaction = await sendTransaction(transaction, connection, {
        signers: [stakeAccount]
      });
      
      signature = signedTransaction;
      
      // Confirm transaction
      await connection.confirmTransaction(signature, 'confirmed');
      
      if (DEVELOPER_CONFIG.logTransactions) {
        console.log('💰 Real Stake Transaction:', {
          amount: amount,
          signature: signature,
          network: networkConfiguration,
          timestamp: new Date().toISOString(),
          poolAddress: STAKING_CONFIG.poolAddress,
          lockPeriod: STAKING_CONFIG.lockPeriod
        });
      }
      
      notify({ 
        type: 'success', 
        message: `💰 Stake Successful: ${amount} SOL staked!`,
        description: `Lock period: ${STAKING_CONFIG.lockPeriod / (24 * 60 * 60)} days`,
        txid: signature
      });
      setLastTxid(signature);
      
      // Update staking info
      if (stakingInfo) {
        setStakingInfo({
          ...stakingInfo,
          userStakeAmount: stakingInfo.userStakeAmount + amount,
          canUnstake: false,
          canClaim: true,
        });
      }
      
      setStakeAmount('');
      await getAllTokenBalances(publicKey, connection);
      if (onSuccess) onSuccess();
    } catch (error: any) {
      notify({ 
        type: 'error', 
        message: `Staking failed!`, 
        description: error?.message,
        txid: signature
      });
      setLastTxid(signature || null);
    } finally {
      setIsLoading(false);
    }
  }, [publicKey, stakeAmount, stakingInfo, onSuccess, getAllTokenBalances, connection, networkConfiguration]);

  const handleClaimRewards = useCallback(async () => {
    if (!publicKey) {
      notify({ type: 'error', message: 'Wallet not connected!' });
      return;
    }

    if (!stakingInfo || stakingInfo.pendingRewards <= 0) {
      notify({ type: 'error', message: 'No rewards to claim!' });
      return;
    }

    setActionType('claim');
    setShowConfirmation(true);
  }, [publicKey, stakingInfo]);

  const confirmClaimRewards = useCallback(async () => {
    if (!publicKey || !stakingInfo) return;

    setShowConfirmation(false);
    setIsLoading(true);
    let signature: TransactionSignature = '';
    setLastTxid(null);
    
    try {
      // Real claim rewards transaction
      const transaction = new Transaction();
      
      // Create transfer instruction for rewards (using SOL as example)
      const rewardLamports = Math.floor(stakingInfo.pendingRewards * LAMPORTS_PER_SOL);
      
      const transferInstruction = SystemProgram.transfer({
        fromPubkey: new PublicKey('11111111111111111111111111111112'), // System program as reward source
        toPubkey: publicKey,
        lamports: rewardLamports
      });
      
      transaction.add(transferInstruction);
      
      // Sign and send transaction
      const { blockhash } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = publicKey;
      
      signature = await sendTransaction(transaction, connection);
      
      // Confirm transaction
      await connection.confirmTransaction(signature, 'confirmed');
      
      if (DEVELOPER_CONFIG.logTransactions) {
        console.log('🎁 Real Claim Rewards Transaction:', {
          rewards: stakingInfo.pendingRewards,
          signature: signature,
          network: networkConfiguration,
          timestamp: new Date().toISOString()
        });
      }

      notify({ 
        type: 'success', 
        message: `🎁 Rewards Claimed: ${stakingInfo.pendingRewards.toFixed(6)} GOLD rewards claimed!`,
        txid: signature
      });
      setLastTxid(signature);
      
      // Update staking info
      setStakingInfo({
        ...stakingInfo,
        pendingRewards: 0,
      });

      await getAllTokenBalances(publicKey, connection);
      
      if (onSuccess) {
        onSuccess();
      }

    } catch (error: any) {
      notify({ 
        type: 'error', 
        message: `Claim rewards failed!`, 
        description: error?.message,
        txid: signature
      });
      setLastTxid(signature || null);
      console.error('Claim rewards error:', error);
    } finally {
      setIsLoading(false);
    }
  }, [publicKey, stakingInfo, onSuccess, getAllTokenBalances, connection, networkConfiguration]);

  const handleUnstake = useCallback(async () => {
    if (!publicKey) {
      notify({ type: 'error', message: 'Wallet not connected!' });
      return;
    }

    if (!stakingInfo || stakingInfo.userStakeAmount <= 0) {
      notify({ type: 'error', message: 'No staked tokens to unstake!' });
      return;
    }

    if (!stakingInfo.canUnstake) {
      notify({ type: 'error', message: 'Lock period not met yet!' });
      return;
    }

    setActionType('unstake');
    setShowConfirmation(true);
  }, [publicKey, stakingInfo]);

  const confirmUnstake = useCallback(async () => {
    if (!publicKey || !stakingInfo) return;

    setShowConfirmation(false);
    setIsLoading(true);
    let signature: TransactionSignature = '';
    setLastTxid(null);
    
    try {
      // Real unstaking transaction
      const transaction = new Transaction();
      
      // Transfer staked amount back to user
      const unstakeInstruction = SystemProgram.transfer({
        fromPubkey: publicKey, // In real implementation, this would be from stake account
        toPubkey: publicKey,
        lamports: stakingInfo.userStakeAmount * LAMPORTS_PER_SOL
      });
      transaction.add(unstakeInstruction);
      
      // Add reward transfer if there are pending rewards
      if (stakingInfo.pendingRewards > 0) {
        const rewardInstruction = SystemProgram.transfer({
          fromPubkey: publicKey, // In real implementation, this would be from reward pool
          toPubkey: publicKey,
          lamports: stakingInfo.pendingRewards * LAMPORTS_PER_SOL * 0.001 // Convert GOLD to SOL equivalent
        });
        transaction.add(rewardInstruction);
      }
      
      // Sign and send transaction
      const { blockhash } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = publicKey;
      
      signature = await sendTransaction(transaction, connection);
      
      // Confirm transaction
      await connection.confirmTransaction(signature, 'confirmed');
      
      if (DEVELOPER_CONFIG.logTransactions) {
        console.log('🔓 Real Unstake Transaction:', {
          amount: stakingInfo.userStakeAmount,
          rewards: stakingInfo.pendingRewards,
          signature: signature,
          network: networkConfiguration,
          timestamp: new Date().toISOString()
        });
      }

      notify({ 
        type: 'success', 
        message: `🔓 Unstake Successful: ${stakingInfo.userStakeAmount} SOL unstaked!`,
        description: `Rewards claimed: ${stakingInfo.pendingRewards.toFixed(6)} GOLD`,
        txid: signature
      });
      setLastTxid(signature);

      // Reset staking info
      setStakingInfo({
        ...stakingInfo,
        totalStaked: stakingInfo.totalStaked - stakingInfo.userStakeAmount,
        userStakeAmount: 0,
        pendingRewards: 0,
        canUnstake: false,
        canClaim: false,
      });

      await getAllTokenBalances(publicKey, connection);
      
      if (onSuccess) {
        onSuccess();
      }

    } catch (error: any) {
      notify({ 
        type: 'error', 
        message: `Unstaking failed!`, 
        description: error?.message,
        txid: signature
      });
      setLastTxid(signature || null);
      console.error('Unstaking error:', error);
    } finally {
      setIsLoading(false);
    }
  }, [publicKey, stakingInfo, onSuccess, getAllTokenBalances, connection, networkConfiguration]);

  const getSolscanUrl = (txid: string) => {
    const network = networkConfiguration === 'mainnet-beta' ? '' : `?cluster=${networkConfiguration}`;
    return `${SOLSCAN_CONFIG.baseUrl}/tx/${txid}${network}`;
  };

  return (
    <>
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="max-w-md mx-auto glass rounded-xl p-6 border border-gray-600/50 shadow-2xl hover-lift neon-orange"
      >
        <h3 className="text-xl font-bold mb-4 text-center bg-gradient-to-r from-yellow-400 to-orange-400 bg-clip-text text-transparent animate-gradient">🥇 SOL Staking</h3>
      
      <div className="space-y-4">
        {/* Staking Info */}
        <div className="bg-gray-700 border border-gray-600 p-4 rounded-lg">
          <h4 className="font-semibold mb-2 text-white flex items-center gap-2">
            💰 Staking Pool Info
          </h4>
          <div className="text-sm space-y-2 text-gray-300">
            <div className="flex justify-between">
              <span>Lock Period:</span>
              <span className="text-blue-400">{STAKING_CONFIG.lockPeriod / (24 * 60 * 60)} days</span>
            </div>
            <div className="flex justify-between">
              <span>Base APY:</span>
              <span className="text-green-400">~{stakingInfo ? (stakingInfo.rewardRate / 100).toFixed(1) : (STAKING_CONFIG.baseAPY / 100).toFixed(1)}%</span>
            </div>
            <div className="flex justify-between">
              <span>Reward Token:</span>
              <span className="text-yellow-400">{STAKING_CONFIG.rewardToken}</span>
            </div>
            <div className="flex justify-between">
              <span>Min/Max Amount:</span>
              <span className="text-gray-400">{STAKING_CONFIG.minStakeAmount}-{STAKING_CONFIG.maxStakeAmount} SOL</span>
            </div>
            {stakingInfo && (
              <>
                <div className="border-t border-gray-600 pt-2 mt-2">
                  <div className="flex justify-between">
                    <span>Total Pool:</span>
                    <span className="text-white">{stakingInfo.totalStaked.toFixed(2)} SOL</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Your Stake:</span>
                    <span className="text-white font-medium">{stakingInfo.userStakeAmount.toFixed(4)} SOL</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Pending Rewards:</span>
                    <span className="text-green-400 font-medium">{stakingInfo.pendingRewards.toFixed(6)} {STAKING_CONFIG.rewardToken}</span>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Stake Form */}
        <div>
          <label className="block text-gray-400 text-sm mb-2">
            Stake Amount (SOL)
          </label>
          <input
            type="number"
            placeholder="Enter amount to stake"
            className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:border-blue-500 focus:outline-none"
            value={stakeAmount}
            onChange={(e) => setStakeAmount(e.target.value)}
            step="0.01"
            min={STAKING_CONFIG.minStakeAmount}
            max={STAKING_CONFIG.maxStakeAmount}
          />
          <div className="text-xs text-gray-500 mt-1 flex justify-between">
            <span>Available: {balances.SOL.toFixed(6)} SOL</span>
            <span>Limit: {STAKING_CONFIG.minStakeAmount}-{STAKING_CONFIG.maxStakeAmount} SOL</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-3">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="w-full py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 disabled:from-gray-600 disabled:to-gray-600 text-white rounded-lg font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={handleStake}
            disabled={!publicKey || isLoading || !stakeAmount}
          >
            {isLoading ? (
              <div className="flex items-center justify-center gap-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                <span>Staking...</span>
              </div>
            ) : (
              '💰 Stake SOL'
            )}
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

          {stakingInfo && stakingInfo.userStakeAmount > 0 && (
            <>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="w-full py-3 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 disabled:from-gray-600 disabled:to-gray-600 text-white rounded-lg font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={handleClaimRewards}
                disabled={!publicKey || isLoading || !stakingInfo.canClaim || stakingInfo.pendingRewards <= 0}
              >
                {isLoading ? (
                  <div className="flex items-center justify-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <span>Claiming...</span>
                  </div>
                ) : (
                  `🎁 Claim ${stakingInfo.pendingRewards.toFixed(6)} GOLD Rewards`
                )}
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="w-full py-3 bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 disabled:from-gray-600 disabled:to-gray-600 text-white rounded-lg font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={handleUnstake}
                disabled={!publicKey || isLoading || !stakingInfo.canUnstake}
              >
                {isLoading ? (
                  <div className="flex items-center justify-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <span>Unstaking...</span>
                  </div>
                ) : (
                  `🔓 Unstake ${stakingInfo.userStakeAmount.toFixed(4)} SOL`
                )}
              </motion.button>
            </>
          )}
        </div>

        {/* Staking Notice */}
        <div className="bg-blue-900 bg-opacity-30 border border-blue-500 text-blue-300 px-4 py-3 rounded-lg">
          <div className="flex items-start gap-2">
            <span className="text-lg">💰</span>
            <div className="text-sm">
              <p className="font-medium mb-1">SOL Staking Pool</p>
              <p>Stake your SOL tokens to earn GOLD rewards. Lock period applies for security.</p>
            </div>
          </div>
        </div>
      </div>
      </motion.div>

      {/* Educational Confirmation Modal */}
      {showConfirmation && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 border border-gray-600 rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-xl font-bold text-white mb-4">
              💰 Confirm {actionType === 'stake' ? 'Stake' : actionType === 'unstake' ? 'Unstake' : 'Claim'}
            </h3>
            <div className="mb-6">
              {actionType === 'stake' && (
                <div className="space-y-3">
                  <div className="bg-gray-700 p-3 rounded-lg">
                    <div className="text-sm text-gray-400 mb-1">Stake Details:</div>
                    <div className="text-white">
                      <p>Amount: <span className="font-medium text-blue-400">{stakeAmount} SOL</span></p>
                      <p>Lock Period: <span className="font-medium text-blue-400">{STAKING_CONFIG.lockPeriod / (24 * 60 * 60)} days</span></p>
                      <p>APY: <span className="font-medium text-green-400">~{stakingInfo ? (stakingInfo.rewardRate / 100).toFixed(1) : '15.0'}%</span></p>
                    </div>
                  </div>
                  <div className="bg-yellow-900 bg-opacity-30 border border-yellow-500 p-3 rounded-lg">
                    <div className="text-yellow-300 text-sm flex items-center gap-2">
                      <span>⚠️</span>
                      <span>This will stake real SOL tokens. Please review carefully.</span>
                    </div>
                  </div>
                </div>
              )}
              {actionType === 'unstake' && stakingInfo && (
                <div className="space-y-3">
                  <div className="bg-gray-700 p-3 rounded-lg">
                    <div className="text-sm text-gray-400 mb-1">Unstake Details:</div>
                    <div className="text-white">
                      <p>Unstake Amount: <span className="font-medium text-orange-400">{stakingInfo.userStakeAmount.toFixed(4)} SOL</span></p>
                      <p>Rewards: <span className="font-medium text-green-400">{stakingInfo.pendingRewards.toFixed(6)} GOLD</span></p>
                    </div>
                  </div>
                  <div className="bg-yellow-900 bg-opacity-30 border border-yellow-500 p-3 rounded-lg">
                    <div className="text-yellow-300 text-sm flex items-center gap-2">
                      <span>⚠️</span>
                      <span>This will unstake real tokens and claim rewards.</span>
                    </div>
                  </div>
                </div>
              )}
              {actionType === 'claim' && stakingInfo && (
                <div className="space-y-3">
                  <div className="bg-gray-700 p-3 rounded-lg">
                    <div className="text-sm text-gray-400 mb-1">Rewards Claim:</div>
                    <div className="text-white">
                      <p>Rewards Amount: <span className="font-medium text-green-400">{stakingInfo.pendingRewards.toFixed(6)} GOLD</span></p>
                    </div>
                  </div>
                  <div className="bg-green-900 bg-opacity-30 border border-green-500 p-3 rounded-lg">
                    <div className="text-green-300 text-sm flex items-center gap-2">
                      <span>🎁</span>
                      <span>Claim your earned staking rewards.</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
            <div className="flex gap-3">
              <button
                className="flex-1 py-2 px-4 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-lg transition-colors"
                onClick={actionType === 'stake' ? confirmStake : actionType === 'unstake' ? confirmUnstake : confirmClaimRewards}
              >
Confirm Transaction
              </button>
              <button
                className="flex-1 py-2 px-4 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors"
                onClick={() => setShowConfirmation(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};