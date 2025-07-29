import { FC, useEffect, useState, useCallback } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { SendToken } from './SendToken';
import { SwapToken } from './SwapToken';
import { Staking } from './Staking';
import { TransactionHistory } from './TransactionHistory';
import { TradingChart } from './TradingChart';
import { OrderBook } from './OrderBook';
import { RecentTrades } from './RecentTrades';
import { MarketOverview } from './MarketOverview';
import { InteractivePortfolioAnalytics } from './InteractivePortfolioAnalytics';
import { TransactionHistoryDashboard } from './TransactionHistoryDashboard';
import { NotificationCenter } from './NotificationCenter';
import { RealTimeMarketDashboard } from './RealTimeMarketDashboard';
import { useNetworkConfiguration } from '../contexts/NetworkConfigurationProvider';
import { SOLSCAN_CONFIG, TOKENS } from '../config/tokens';
import useTokenBalanceStore from '../stores/useTokenBalanceStore';
import { BalanceTracker } from './BalanceTracker';
import { motion } from 'framer-motion';

type TabType = 'overview' | 'trade' | 'stake' | 'send' | 'history' | 'analytics' | 'portfolio' | 'notifications' | 'market';

interface PriceData {
  SOL: { price: number; change24h: number };
  GOLD: { price: number; change24h: number };
}

interface MarketStats {
  totalVolume24h: number;
  totalLiquidity: number;
  activeUsers: number;
  totalTransactions: number;
}

export const AdvancedDashboard: FC = () => {
  const wallet = useWallet();
  const { connection } = useConnection();
  const { networkConfiguration } = useNetworkConfiguration();
  const { balances, getAllTokenBalances } = useTokenBalanceStore();
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [priceData, setPriceData] = useState<PriceData>({
    SOL: { price: 100, change24h: 5.2 },
    GOLD: { price: 0.12, change24h: -2.1 }
  });
  const [marketStats, setMarketStats] = useState<MarketStats>({
    totalVolume24h: 1250000,
    totalLiquidity: 8500000,
    activeUsers: 1247,
    totalTransactions: 15678
  });

  useEffect(() => {
    if (wallet.publicKey) {
      console.log('🔄 AdvancedDashboard: Wallet connected, fetching balances...', wallet.publicKey.toString());
      getAllTokenBalances(wallet.publicKey, connection);
      
      // Aggressive refresh for GOLD detection
      const timeouts = [
        setTimeout(() => {
          console.log('🔄 AdvancedDashboard: Secondary refresh (3s)');
          getAllTokenBalances(wallet.publicKey, connection);
        }, 3000),
        setTimeout(() => {
          console.log('🔄 AdvancedDashboard: Tertiary refresh (8s)');
          getAllTokenBalances(wallet.publicKey, connection);
        }, 8000),
        setTimeout(() => {
          console.log('🔄 AdvancedDashboard: Final refresh (15s)');
          getAllTokenBalances(wallet.publicKey, connection);
        }, 15000)
      ];
      
      return () => {
        timeouts.forEach(timeout => clearTimeout(timeout));
      };
    }
  }, [wallet.publicKey, connection, getAllTokenBalances]);

  // Mock price updates
  useEffect(() => {
    const interval = setInterval(() => {
      setPriceData(prev => ({
        SOL: {
          price: prev.SOL.price + (Math.random() - 0.5) * 2,
          change24h: prev.SOL.change24h + (Math.random() - 0.5) * 0.5
        },
        GOLD: {
          price: prev.GOLD.price + (Math.random() - 0.5) * 0.01,
          change24h: prev.GOLD.change24h + (Math.random() - 0.5) * 0.3
        }
      }));
      
      setMarketStats(prev => ({
        totalVolume24h: prev.totalVolume24h + Math.floor(Math.random() * 10000),
        totalLiquidity: prev.totalLiquidity + Math.floor(Math.random() * 5000),
        activeUsers: prev.activeUsers + Math.floor(Math.random() * 10),
        totalTransactions: prev.totalTransactions + Math.floor(Math.random() * 20)
      }));
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const handleSuccess = () => {
    if (wallet.publicKey) {
      getAllTokenBalances(wallet.publicKey, connection);
    }
  };

  const getSolscanUrl = (address: string) => {
    const network = networkConfiguration === 'mainnet-beta' ? '' : `?cluster=${networkConfiguration}`;
    return `${SOLSCAN_CONFIG.baseUrl}/account/${address}${network}`;
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  const formatPrice = (price: number) => {
    return price < 1 ? price.toFixed(4) : price.toFixed(2);
  };

  const getPortfolioValue = () => {
    return (balances.SOL * priceData.SOL.price) + (balances.GOLD * priceData.GOLD.price);
  };

  const tabs = [
    { id: 'overview' as TabType, label: 'Overview', icon: '📊' },
    { id: 'trade' as TabType, label: 'Trade', icon: '🔄' },
    { id: 'stake' as TabType, label: 'Stake', icon: '🔒' },
    { id: 'send' as TabType, label: 'Send', icon: '📤' },
    { id: 'history' as TabType, label: 'History', icon: '📋' },
    { id: 'analytics' as TabType, label: 'Analytics', icon: '📈' },
    { id: 'portfolio' as TabType, label: 'Portfolio', icon: '💼' },
    { id: 'notifications' as TabType, label: 'Alerts', icon: '🔔' },
    { id: 'market' as TabType, label: 'Market', icon: '🌐' },
  ];

  const renderActiveComponent = () => {
    switch (activeTab) {
      case 'overview':
        return (
          <div className="space-y-6">
            {/* Balance Tracker for Real-time Detection */}
            <BalanceTracker refreshInterval={5000} />
            
            {/* Portfolio Overview */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-gradient-to-br from-blue-900/50 to-blue-800/30 rounded-xl p-6 border border-blue-500/30"
              >
                <div className="text-blue-300 text-sm mb-2">Portfolio Value</div>
                <div className="text-2xl font-bold text-white">${getPortfolioValue().toFixed(2)}</div>
                <div className="text-green-400 text-sm">+12.5% (24h)</div>
              </motion.div>
              
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="bg-gradient-to-br from-yellow-900/50 to-yellow-800/30 rounded-xl p-6 border border-yellow-500/30"
              >
                <div className="text-yellow-300 text-sm mb-2">SOL Balance</div>
                <div className="text-2xl font-bold text-white">{balances.SOL.toFixed(4)}</div>
                <div className="text-gray-400 text-sm">${(balances.SOL * priceData.SOL.price).toFixed(2)}</div>
              </motion.div>
              
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="bg-gradient-to-br from-orange-900/50 to-orange-800/30 rounded-xl p-6 border border-orange-500/30"
              >
                <div className="text-orange-300 text-sm mb-2">GOLD Balance</div>
                <div className="text-2xl font-bold text-white">{balances.GOLD.toFixed(4)}</div>
                <div className="text-gray-400 text-sm">${(balances.GOLD * priceData.GOLD.price).toFixed(2)}</div>
              </motion.div>
              
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="bg-gradient-to-br from-green-900/50 to-green-800/30 rounded-xl p-6 border border-green-500/30"
              >
                <div className="text-green-300 text-sm mb-2">24h P&L</div>
                <div className="text-2xl font-bold text-white">+$127.45</div>
                <div className="text-green-400 text-sm">+8.2%</div>
              </motion.div>
            </div>

            {/* Market Data */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-gray-900/50 rounded-xl p-6 border border-gray-700">
                <h3 className="text-lg font-semibold text-white mb-4">Live Prices</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <img src="/solanaLogo.png" alt="SOL" className="w-8 h-8 rounded-full" />
                      <div>
                        <div className="text-white font-medium">SOL</div>
                        <div className="text-gray-400 text-sm">Solana</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-white font-semibold">${formatPrice(priceData.SOL.price)}</div>
                      <div className={`text-sm ${priceData.SOL.change24h >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {priceData.SOL.change24h >= 0 ? '+' : ''}{priceData.SOL.change24h.toFixed(2)}%
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <img src="/logo.jpg" alt="GOLD" className="w-8 h-8 rounded-full" />
                      <div>
                        <div className="text-white font-medium">GOLD</div>
                        <div className="text-gray-400 text-sm">Goldium</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-white font-semibold">${formatPrice(priceData.GOLD.price)}</div>
                      <div className={`text-sm ${priceData.GOLD.change24h >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {priceData.GOLD.change24h >= 0 ? '+' : ''}{priceData.GOLD.change24h.toFixed(2)}%
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-gray-900/50 rounded-xl p-6 border border-gray-700">
                <h3 className="text-lg font-semibold text-white mb-4">Market Stats</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-3 bg-gray-800/50 rounded-lg">
                    <div className="text-2xl font-bold text-blue-400">${formatNumber(marketStats.totalVolume24h)}</div>
                    <div className="text-gray-400 text-sm">24h Volume</div>
                  </div>
                  <div className="text-center p-3 bg-gray-800/50 rounded-lg">
                    <div className="text-2xl font-bold text-green-400">${formatNumber(marketStats.totalLiquidity)}</div>
                    <div className="text-gray-400 text-sm">Total Liquidity</div>
                  </div>
                  <div className="text-center p-3 bg-gray-800/50 rounded-lg">
                    <div className="text-2xl font-bold text-yellow-400">{formatNumber(marketStats.activeUsers)}</div>
                    <div className="text-gray-400 text-sm">Active Users</div>
                  </div>
                  <div className="text-center p-3 bg-gray-800/50 rounded-lg">
                    <div className="text-2xl font-bold text-purple-400">{formatNumber(marketStats.totalTransactions)}</div>
                    <div className="text-gray-400 text-sm">Transactions</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-gray-900/50 rounded-xl p-6 border border-gray-700">
              <h3 className="text-lg font-semibold text-white mb-4">Quick Actions</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
                <button 
                  onClick={() => setActiveTab('trade')}
                  className="group relative p-4 bg-gradient-to-r from-blue-600 to-blue-700 rounded-lg text-white font-medium hover:from-blue-700 hover:to-blue-800 transition-all duration-300 overflow-hidden hover:scale-105 hover:shadow-lg hover:shadow-blue-500/30 animate-morphing"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-400/0 to-cyan-400/0 group-hover:from-blue-400/20 group-hover:to-cyan-400/20 transition-all duration-300 animate-hologram"></div>
                  <div className="relative z-10 flex flex-col items-center justify-center gap-2">
                    <span className="group-hover:animate-twinkle group-hover:scale-110 transition-transform duration-300 text-xl">🔄</span>
                    <span className="text-sm">Swap</span>
                  </div>
                </button>
                <button 
                  onClick={() => setActiveTab('send')}
                  className="group relative p-4 bg-gradient-to-r from-green-600 to-green-700 rounded-lg text-white font-medium hover:from-green-700 hover:to-green-800 transition-all duration-300 overflow-hidden hover:scale-105 hover:shadow-lg hover:shadow-green-500/30 animate-morphing animation-delay-500"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-green-400/0 to-emerald-400/0 group-hover:from-green-400/20 group-hover:to-emerald-400/20 transition-all duration-300 animate-hologram"></div>
                  <div className="relative z-10 flex flex-col items-center justify-center gap-2">
                    <span className="group-hover:animate-twinkle group-hover:scale-110 transition-transform duration-300 text-xl">📤</span>
                    <span className="text-sm">Send</span>
                  </div>
                </button>
                <button 
                  onClick={() => setActiveTab('stake')}
                  className="group relative p-4 bg-gradient-to-r from-purple-600 to-purple-700 rounded-lg text-white font-medium hover:from-purple-700 hover:to-purple-800 transition-all duration-300 overflow-hidden hover:scale-105 hover:shadow-lg hover:shadow-purple-500/30 animate-morphing animation-delay-1000"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-purple-400/0 to-pink-400/0 group-hover:from-purple-400/20 group-hover:to-pink-400/20 transition-all duration-300 animate-hologram"></div>
                  <div className="relative z-10 flex flex-col items-center justify-center gap-2">
                    <span className="group-hover:animate-twinkle group-hover:scale-110 transition-transform duration-300 text-xl">🔒</span>
                    <span className="text-sm">Stake</span>
                  </div>
                </button>
                <button 
                  onClick={() => setActiveTab('history')}
                  className="group relative p-4 bg-gradient-to-r from-orange-600 to-orange-700 rounded-lg text-white font-medium hover:from-orange-700 hover:to-orange-800 transition-all duration-300 overflow-hidden hover:scale-105 hover:shadow-lg hover:shadow-orange-500/30 animate-morphing animation-delay-1500"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-orange-400/0 to-yellow-400/0 group-hover:from-orange-400/20 group-hover:to-yellow-400/20 transition-all duration-300 animate-hologram"></div>
                  <div className="relative z-10 flex flex-col items-center justify-center gap-2">
                    <span className="group-hover:animate-twinkle group-hover:scale-110 transition-transform duration-300 text-xl">📋</span>
                    <span className="text-sm">History</span>
                  </div>
                </button>
                <button 
                  onClick={() => setActiveTab('portfolio')}
                  className="group relative p-4 bg-gradient-to-r from-indigo-600 to-indigo-700 rounded-lg text-white font-medium hover:from-indigo-700 hover:to-indigo-800 transition-all duration-300 overflow-hidden hover:scale-105 hover:shadow-lg hover:shadow-indigo-500/30 animate-morphing animation-delay-2000"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-indigo-400/0 to-purple-400/0 group-hover:from-indigo-400/20 group-hover:to-purple-400/20 transition-all duration-300 animate-hologram"></div>
                  <div className="relative z-10 flex flex-col items-center justify-center gap-2">
                    <span className="group-hover:animate-twinkle group-hover:scale-110 transition-transform duration-300 text-xl">💼</span>
                    <span className="text-sm">Portfolio</span>
                  </div>
                </button>
                <button 
                  onClick={() => setActiveTab('notifications')}
                  className="group relative p-4 bg-gradient-to-r from-red-600 to-red-700 rounded-lg text-white font-medium hover:from-red-700 hover:to-red-800 transition-all duration-300 overflow-hidden hover:scale-105 hover:shadow-lg hover:shadow-red-500/30 animate-morphing animation-delay-2500"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-red-400/0 to-pink-400/0 group-hover:from-red-400/20 group-hover:to-pink-400/20 transition-all duration-300 animate-hologram"></div>
                  <div className="relative z-10 flex flex-col items-center justify-center gap-2">
                    <span className="group-hover:animate-twinkle group-hover:scale-110 transition-transform duration-300 text-xl">🔔</span>
                    <span className="text-sm">Alerts</span>
                  </div>
                </button>
                <button 
                  onClick={() => {
                    if (wallet.publicKey) {
                      console.log('🔄 Manual refresh triggered by user');
                      getAllTokenBalances(wallet.publicKey, connection);
                      setTimeout(() => getAllTokenBalances(wallet.publicKey, connection), 2000);
                    }
                  }}
                  className="group relative p-4 bg-gradient-to-r from-cyan-600 to-cyan-700 rounded-lg text-white font-medium hover:from-cyan-700 hover:to-cyan-800 transition-all duration-300 overflow-hidden hover:scale-105 hover:shadow-lg hover:shadow-cyan-500/30 animate-morphing animation-delay-3000"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-cyan-400/0 to-blue-400/0 group-hover:from-cyan-400/20 group-hover:to-blue-400/20 transition-all duration-300 animate-hologram"></div>
                  <div className="relative z-10 flex flex-col items-center justify-center gap-2">
                    <span className="group-hover:animate-twinkle group-hover:scale-110 transition-transform duration-300 text-xl">🔄</span>
                    <span className="text-sm">Refresh</span>
                  </div>
                </button>
                <button 
                  onClick={() => setActiveTab('market')}
                  className="group relative p-4 bg-gradient-to-r from-teal-600 to-teal-700 rounded-lg text-white font-medium hover:from-teal-700 hover:to-teal-800 transition-all duration-300 overflow-hidden hover:scale-105 hover:shadow-lg hover:shadow-teal-500/30 animate-morphing animation-delay-3000"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-teal-400/0 to-cyan-400/0 group-hover:from-teal-400/20 group-hover:to-cyan-400/20 transition-all duration-300 animate-hologram"></div>
                  <div className="relative z-10 flex flex-col items-center justify-center gap-2">
                    <span className="group-hover:animate-twinkle group-hover:scale-110 transition-transform duration-300 text-xl">🌐</span>
                    <span className="text-sm">Market</span>
                  </div>
                </button>
              </div>
            </div>
            
            {/* Market Overview */}
            <MarketOverview />
          </div>
        );
      case 'trade':
        return (
          <div className="space-y-6">
            {/* Main Trading Interface */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
              <div className="xl:col-span-1">
                 <SwapToken onSuccess={handleSuccess} />
               </div>
              <div className="xl:col-span-2">
                <TradingChart symbol="SOL" timeframe="1H" />
              </div>
            </div>
            
            {/* Order Book and Recent Trades */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <OrderBook symbol="SOL/GOLD" />
              <RecentTrades symbol="SOL/GOLD" />
            </div>
           </div>
         );
      case 'stake':
        return <Staking onSuccess={handleSuccess} />;
      case 'send':
        return <SendToken onSuccess={handleSuccess} />;
      case 'history':
        return <TransactionHistoryDashboard />;
      case 'analytics':
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <TradingChart symbol="SOL" timeframe="1D" />
              <TradingChart symbol="GOLD" timeframe="1D" />
            </div>
            
            {/* Portfolio Performance */}
            <div className="bg-gray-900/50 rounded-xl p-6 border border-gray-700">
              <h3 className="text-lg font-semibold text-white mb-4">Portfolio Performance</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center p-4 bg-gray-800/50 rounded-lg">
                  <div className="text-2xl font-bold text-green-400">+24.5%</div>
                  <div className="text-gray-400 text-sm">7 Days</div>
                </div>
                <div className="text-center p-4 bg-gray-800/50 rounded-lg">
                  <div className="text-2xl font-bold text-blue-400">+12.8%</div>
                  <div className="text-gray-400 text-sm">30 Days</div>
                </div>
                <div className="text-center p-4 bg-gray-800/50 rounded-lg">
                  <div className="text-2xl font-bold text-yellow-400">+156.2%</div>
                  <div className="text-gray-400 text-sm">All Time</div>
                </div>
              </div>
            </div>
            
            {/* Trading Activity */}
            <div className="bg-gray-900/50 rounded-xl p-6 border border-gray-700">
              <h3 className="text-lg font-semibold text-white mb-4">Trading Activity</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <div className="text-xl font-bold text-white">47</div>
                  <div className="text-gray-400 text-sm">Total Trades</div>
                </div>
                <div className="text-center">
                  <div className="text-xl font-bold text-green-400">89.4%</div>
                  <div className="text-gray-400 text-sm">Win Rate</div>
                </div>
                <div className="text-center">
                  <div className="text-xl font-bold text-blue-400">$2,847</div>
                  <div className="text-gray-400 text-sm">Total Volume</div>
                </div>
                <div className="text-center">
                  <div className="text-xl font-bold text-yellow-400">$127</div>
                  <div className="text-gray-400 text-sm">Avg. Profit</div>
                </div>
              </div>
            </div>
          </div>
        );
      case 'portfolio':
        return <InteractivePortfolioAnalytics />;
      case 'notifications':
        return <NotificationCenter />;
      case 'market':
        return <RealTimeMarketDashboard />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 relative overflow-hidden">
      {/* Animated Background */}
      <div className="absolute inset-0 opacity-30">
        <div className="absolute top-0 left-0 w-96 h-96 bg-purple-500 rounded-full mix-blend-multiply filter blur-xl animate-pulse"></div>
        <div className="absolute top-0 right-0 w-96 h-96 bg-yellow-500 rounded-full mix-blend-multiply filter blur-xl animate-pulse animation-delay-2000"></div>
        <div className="absolute bottom-0 left-1/2 w-96 h-96 bg-blue-500 rounded-full mix-blend-multiply filter blur-xl animate-pulse animation-delay-4000"></div>
      </div>
      
      {/* Enhanced Animated Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* Large pulsing orbs */}
        <div className="absolute top-20 left-10 w-32 h-32 bg-gradient-to-r from-purple-500/20 to-pink-500/20 rounded-full animate-pulse blur-xl"></div>
        <div className="absolute top-40 right-20 w-24 h-24 bg-gradient-to-r from-blue-500/20 to-cyan-500/20 rounded-full animate-pulse blur-xl" style={{ animationDelay: '1s' }}></div>
        <div className="absolute bottom-20 left-20 w-40 h-40 bg-gradient-to-r from-yellow-500/20 to-orange-500/20 rounded-full animate-pulse blur-xl" style={{ animationDelay: '2s' }}></div>
        <div className="absolute bottom-40 right-10 w-28 h-28 bg-gradient-to-r from-green-500/20 to-emerald-500/20 rounded-full animate-pulse blur-xl" style={{ animationDelay: '3s' }}></div>
        
        {/* Medium floating orbs */}
         {[...Array(8)].map((_, i) => (
           <div
             key={`orb-${i}`}
             className="absolute w-16 h-16 bg-gradient-to-r from-purple-400/10 to-blue-400/10 rounded-full animate-drift blur-lg"
             style={{
               left: `${Math.random() * 100}%`,
               top: `${Math.random() * 100}%`,
               animationDelay: `${Math.random() * 5}s`,
               animationDuration: `${5 + Math.random() * 3}s`
             }}
           />
         ))}
        
        {/* Small floating particles */}
         {[...Array(30)].map((_, i) => (
           <div
             key={`particle-${i}`}
             className="absolute w-1 h-1 bg-white/30 rounded-full animate-twinkle"
             style={{
               left: `${Math.random() * 100}%`,
               top: `${Math.random() * 100}%`,
               animationDelay: `${Math.random() * 5}s`,
               animationDuration: `${3 + Math.random() * 4}s`
             }}
           />
         ))}
        
        {/* Shooting stars */}
        {[...Array(3)].map((_, i) => (
          <div
            key={`star-${i}`}
            className="absolute w-1 h-20 bg-gradient-to-b from-white/50 to-transparent animate-pulse"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 50}%`,
              transform: 'rotate(45deg)',
              animationDelay: `${Math.random() * 10}s`,
              animationDuration: `${2 + Math.random() * 3}s`
            }}
          />
        ))}
      </div>
      
      <div className="container mx-auto px-4 py-6 relative z-10">
        {/* Header */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between mb-8 bg-gray-900/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700/50 shadow-2xl animate-aurora"
        >
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
          >
            <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-400 via-yellow-400 to-purple-400 bg-clip-text text-transparent mb-2 animate-gradient">🌟 Goldium DApp ✨</h1>
            <p className="text-gray-300 bg-gray-800/50 px-3 py-1 rounded-full border border-gray-600 inline-block neon-orange">Advanced SOL-GOLD Trading Platform</p>
          </motion.div>
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
            className="flex items-center gap-4"
          >
            <div className="text-right bg-gray-800/50 px-4 py-2 rounded-lg border border-gray-600">
              <div className="text-sm text-gray-400">Network</div>
              <div className={`font-medium ${
                networkConfiguration === 'mainnet-beta' ? 'text-green-400' : 'text-yellow-400'
              }`}>
                {networkConfiguration === 'mainnet-beta' ? 'Mainnet' : 'Devnet'}
              </div>
            </div>
            <WalletMultiButton className="bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105" />
          </motion.div>
        </motion.div>

        {!wallet.publicKey ? (
          <div className="max-w-2xl mx-auto bg-gray-800/50 backdrop-blur-sm rounded-xl shadow-lg p-8 text-center border border-gray-700">
            <div className="text-6xl mb-6">🚀</div>
            <h2 className="text-2xl font-bold mb-4 text-white">Welcome to Goldium DApp</h2>
            <p className="text-gray-300 mb-8 text-lg">
              The most advanced SOL-GOLD trading platform on Solana
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
              <div className="p-4 bg-gray-900/50 rounded-lg">
                <div className="text-2xl mb-2">⚡</div>
                <div className="text-white font-medium">Lightning Fast</div>
                <div className="text-gray-400 text-sm">Sub-second transactions</div>
              </div>
              <div className="p-4 bg-gray-900/50 rounded-lg">
                <div className="text-2xl mb-2">🔒</div>
                <div className="text-white font-medium">Secure Staking</div>
                <div className="text-gray-400 text-sm">Earn rewards safely</div>
              </div>
              <div className="p-4 bg-gray-900/50 rounded-lg">
                <div className="text-2xl mb-2">📊</div>
                <div className="text-white font-medium">Real-time Data</div>
                <div className="text-gray-400 text-sm">Live market updates</div>
              </div>
            </div>
            <WalletMultiButton className="bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-white font-medium py-3 px-8 rounded-lg transition-all duration-200 text-lg" />
          </div>
        ) : (
          <>
            {/* Wallet Info */}
            <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700 mb-6">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-4 mb-4 md:mb-0">
                  <div className="w-12 h-12 bg-gradient-to-r from-yellow-500 to-orange-500 rounded-full flex items-center justify-center text-white font-bold text-lg">
                    {wallet.publicKey.toBase58().slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <div className="text-white font-medium">Connected Wallet</div>
                    <div className="text-gray-400 text-sm font-mono">
                      {wallet.publicKey.toBase58().slice(0, 8)}...{wallet.publicKey.toBase58().slice(-8)}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-center">
                    <div className="text-blue-400 font-bold text-lg">{balances.SOL.toFixed(4)}</div>
                    <div className="text-gray-400 text-xs">SOL</div>
                  </div>
                  <div className="text-center">
                    <div className="text-yellow-400 font-bold text-lg">{balances.GOLD.toFixed(4)}</div>
                    <div className="text-gray-400 text-xs">GOLD</div>
                  </div>
                  <a
                    href={getSolscanUrl(wallet.publicKey.toBase58())}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group relative btn btn-sm bg-blue-600 hover:bg-blue-700 text-white border-none transition-all duration-300 hover:scale-105 hover:shadow-lg hover:shadow-blue-500/30 animate-cyber-pulse overflow-hidden"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-blue-400/0 to-cyan-400/0 group-hover:from-blue-400/20 group-hover:to-cyan-400/20 transition-all duration-300 animate-hologram"></div>
                    <div className="relative z-10 flex items-center gap-1">
                      <span className="group-hover:animate-twinkle">🔍</span>
                      <span>Solscan</span>
                    </div>
                  </a>
                </div>
              </div>
            </div>

            {/* Navigation Tabs */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="flex justify-center mb-8"
            >
              <div className="bg-gray-800/30 backdrop-blur-lg rounded-xl p-2 border border-gray-600/50 shadow-2xl">
                <div className="flex flex-wrap gap-1">
                  {tabs.map((tab, index) => (
                    <motion.button
                      key={tab.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.5 + index * 0.1 }}
                      whileHover={{ scale: 1.05, y: -2 }}
                      whileTap={{ scale: 0.95 }}
                      className={`relative px-4 py-2 rounded-lg font-medium transition-all duration-300 ${
                        activeTab === tab.id
                          ? 'bg-gradient-to-r from-purple-600 via-blue-600 to-purple-600 text-white shadow-lg'
                          : 'text-gray-300 hover:text-yellow-400 hover:bg-yellow-500/10 hover:shadow-lg'
                      }`}
                      onClick={() => setActiveTab(tab.id)}
                    >
                      <motion.span 
                        className="mr-2"
                        animate={activeTab === tab.id ? { rotate: [0, 10, -10, 0] } : {}}
                        transition={{ duration: 0.5 }}
                      >
                        {tab.icon}
                      </motion.span>
                      <span className="hidden sm:inline">{tab.label}</span>
                      {activeTab === tab.id && (
                        <motion.div
                          layoutId="activeTab"
                          className="absolute inset-0 bg-gradient-to-r from-purple-600/20 to-blue-600/20 rounded-lg"
                          transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                        />
                      )}
                    </motion.button>
                  ))}
                </div>
              </div>
            </motion.div>

            {/* Active Component */}
            <div className="max-w-6xl mx-auto">
              {renderActiveComponent()}
            </div>
          </>
        )}
      </div>
    </div>
  );
};