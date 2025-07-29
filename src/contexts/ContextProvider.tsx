import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletAdapterNetwork, WalletError } from '@solana/wallet-adapter-base';
import {
    PhantomWalletAdapter,
    SolflareWalletAdapter,
    BackpackWalletAdapter,
    SlopeWalletAdapter,
    TorusWalletAdapter,
    LedgerWalletAdapter,
    TrustWalletAdapter,
    CoinbaseWalletAdapter,
    GlowWalletAdapter,
    ExodusWalletAdapter,
    MathWalletAdapter,
    Coin98WalletAdapter,
    CloverWalletAdapter,
    SafePalWalletAdapter,
    UnsafeBurnerWalletAdapter
} from '@solana/wallet-adapter-wallets';
import { Cluster, clusterApiUrl } from '@solana/web3.js';
import { FC, ReactNode, useCallback, useMemo } from 'react';
import { AutoConnectProvider, useAutoConnect } from './AutoConnectProvider';
import { notify } from "../utils/notifications";
import { NetworkConfigurationProvider, useNetworkConfiguration } from './NetworkConfigurationProvider';
import dynamic from "next/dynamic";

const ReactUIWalletModalProviderDynamic = dynamic(
  async () =>
    (await import("@solana/wallet-adapter-react-ui")).WalletModalProvider,
  { ssr: false }
);

const WalletContextProvider: FC<{ children: ReactNode }> = ({ children }) => {
    const { autoConnect } = useAutoConnect();
    const { networkConfiguration } = useNetworkConfiguration();
    const network = networkConfiguration as WalletAdapterNetwork;
    
    // Use custom RPC endpoint from environment variables or fallback to default
    const endpoint = useMemo(() => {
        const customEndpoint = process.env.NEXT_PUBLIC_SOLANA_RPC_ENDPOINT;
        if (customEndpoint) {
            console.log('Using custom RPC endpoint:', customEndpoint);
            return customEndpoint;
        }
        const defaultEndpoint = clusterApiUrl(network);
        console.log('Using default RPC endpoint:', defaultEndpoint);
        return defaultEndpoint;
    }, [network]);

    console.log('Network:', network);
    console.log('Final Endpoint:', endpoint);

    const wallets = useMemo(
        () => [
            // Primary wallets for mobile and desktop
            new PhantomWalletAdapter(),
            new SolflareWalletAdapter({ network }),
            // new BackpackWalletAdapter(), // Temporarily disabled due to SSR issues
            new CoinbaseWalletAdapter(),
            new TrustWalletAdapter(),
            
            // Popular mobile wallets (some disabled due to SSR issues)
            // new GlowWalletAdapter(),
            // new ExodusWalletAdapter(),
            // new Coin98WalletAdapter(),
            // new MathWalletAdapter(),
            
            // Additional desktop wallets (disabled due to SSR issues)
            // new SlopeWalletAdapter(),
            // new CloverWalletAdapter(),
            // new SafePalWalletAdapter(),
            // new TorusWalletAdapter({
            //     options: {
            //         clientId: process.env.NEXT_PUBLIC_TORUS_CLIENT_ID || 'default'
            //     }
            // }),
            // new LedgerWalletAdapter(),
            
            // UnsafeBurnerWalletAdapter removed - use real wallet for balance detection
        ],
        [network]
    );

    const onError = useCallback(
        (error: WalletError) => {
            console.error('Wallet error:', error);
            
            // Handle specific wallet errors
            if (error.name === 'WalletNotReadyError') {
                notify({ 
                    type: 'error', 
                    message: 'Wallet is not ready. Please make sure the wallet extension is installed and active.' 
                });
            } else if (error.name === 'WalletConnectionError') {
                notify({ 
                    type: 'error', 
                    message: 'Failed to connect to wallet. Please try again.' 
                });
            } else if (error.name === 'WalletNotFoundError') {
                notify({ 
                    type: 'error', 
                    message: 'Wallet not found. Please install the wallet extension first.' 
                });
            } else if (error.name === 'WalletDisconnectedError') {
                notify({ 
                    type: 'info', 
                    message: 'Wallet disconnected successfully.' 
                });
            } else {
                notify({ 
                    type: 'error', 
                    message: error.message ? `${error.name}: ${error.message}` : error.name 
                });
            }
        },
        []
    );

    return (
        <ConnectionProvider endpoint={endpoint}>
            <WalletProvider wallets={wallets} onError={onError} autoConnect={autoConnect}>
                <ReactUIWalletModalProviderDynamic>
                    {children}
                </ReactUIWalletModalProviderDynamic>
			</WalletProvider>
        </ConnectionProvider>
    );
};

export const ContextProvider: FC<{ children: ReactNode }> = ({ children }) => {
    return (
        <>
            <NetworkConfigurationProvider>
                <AutoConnectProvider>
                    <WalletContextProvider>{children}</WalletContextProvider>
                </AutoConnectProvider>
            </NetworkConfigurationProvider>
        </>
    );
};
