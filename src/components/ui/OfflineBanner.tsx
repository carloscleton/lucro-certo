import { WifiOff, Wifi } from 'lucide-react';
import { useNetworkStatus } from '../../hooks/useNetworkStatus';

export function OfflineBanner() {
    const { isOnline, wasOffline } = useNetworkStatus();

    // Show "back online" briefly
    if (wasOffline && isOnline) {
        return (
            <div className="flex items-center justify-center gap-2 px-4 py-2 bg-emerald-500 text-white text-sm font-medium animate-in slide-in-from-top duration-300">
                <Wifi size={16} />
                <span>Conexão restabelecida! ✓</span>
            </div>
        );
    }

    // Show offline warning
    if (!isOnline) {
        return (
            <div className="flex items-center justify-center gap-3 px-4 py-2.5 bg-gradient-to-r from-red-600 to-orange-500 text-white text-sm font-medium shadow-lg animate-in slide-in-from-top duration-300">
                <div className="flex items-center gap-2">
                    <WifiOff size={16} className="animate-pulse" />
                    <span>Sem conexão com a internet</span>
                </div>
                <span className="text-white/70">•</span>
                <span className="text-white/80 text-xs">Algumas funções podem não funcionar corretamente</span>
            </div>
        );
    }

    return null;
}
