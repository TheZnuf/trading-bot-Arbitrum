import React, { useState, useEffect } from 'react';
import { Play, Pause, Settings, TrendingDown, DollarSign, ShoppingCart, AlertCircle, RefreshCw } from 'lucide-react';

const DCABotManager = () => {
  const [isRunning, setIsRunning] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [globalSettings, setGlobalSettings] = useState({
    dropPercentage: 2,
    checkInterval: 60,
    slippageTolerance: 1,
    rpcUrl: '',
    privateKey: ''
  });

  const [pairs, setPairs] = useState([
    {
      id: 1,
      name: 'WBTC',
      address: '0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f',
      decimals: 8,
      purchaseAmount: '1000',
      maxPurchases: 10,
      fee: 3000,
      enabled: true,
      currentPrice: null,
      lastPurchasePrice: null,
      purchaseCount: 0,
      balance: '0',
      priceChange: 0
    },
    {
      id: 2,
      name: 'WETH',
      address: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1',
      decimals: 18,
      purchaseAmount: '500',
      maxPurchases: 15,
      fee: 500,
      enabled: true,
      currentPrice: null,
      lastPurchasePrice: null,
      purchaseCount: 0,
      balance: '0',
      priceChange: 0
    },
    {
      id: 3,
      name: 'LINK',
      address: '0xf97f4df75117a78c1A5a0DBb814Af92458539FB4',
      decimals: 18,
      purchaseAmount: '300',
      maxPurchases: 20,
      fee: 3000,
      enabled: true,
      currentPrice: null,
      lastPurchasePrice: null,
      purchaseCount: 0,
      balance: '0',
      priceChange: 0
    },
    {
      id: 4,
      name: 'AVAX',
      address: '0x565609fAF65B92F7be02468acF86f8979423e514',
      decimals: 18,
      purchaseAmount: '400',
      maxPurchases: 12,
      fee: 3000,
      enabled: true,
      currentPrice: null,
      lastPurchasePrice: null,
      purchaseCount: 0,
      balance: '0',
      priceChange: 0
    },
    {
      id: 5,
      name: 'SOL',
      address: '0xb74Da9FE2F96B9E0a5f4A3cf0b92dd2bEC617124',
      decimals: 9,
      purchaseAmount: '600',
      maxPurchases: 10,
      fee: 10000,
      enabled: true,
      currentPrice: null,
      lastPurchasePrice: null,
      purchaseCount: 0,
      balance: '0',
      priceChange: 0
    },
    {
      id: 6,
      name: 'LDO',
      address: '0x13Ad51ed4F1B7e9Dc168d8a00cB3f4dDD85EfA60',
      decimals: 18,
      purchaseAmount: '250',
      maxPurchases: 15,
      fee: 3000,
      enabled: true,
      currentPrice: null,
      lastPurchasePrice: null,
      purchaseCount: 0,
      balance: '0',
      priceChange: 0
    }
  ]);

  const [logs, setLogs] = useState([
    { time: new Date().toLocaleTimeString(), type: 'info', message: 'Bot prêt à démarrer' }
  ]);

  const addLog = (type, message) => {
    const newLog = {
      time: new Date().toLocaleTimeString(),
      type,
      message
    };
    setLogs(prev => [newLog, ...prev].slice(0, 50));
  };

  const updatePair = (id, updates) => {
    setPairs(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
  };

  const togglePair = (id) => {
    setPairs(prev => prev.map(p => 
      p.id === id ? { ...p, enabled: !p.enabled } : p
    ));
  };

  const startBot = () => {
    if (!globalSettings.rpcUrl || !globalSettings.privateKey) {
      addLog('error', '❌ Configuration manquante! Vérifiez RPC URL et clé privée.');
      setShowSettings(true);
      return;
    }
    setIsRunning(true);
    addLog('success', '▶️ Bot démarré!');
  };

  const stopBot = () => {
    setIsRunning(false);
    addLog('info', '⏸️ Bot arrêté');
  };

  const simulatePriceUpdate = () => {
    setPairs(prev => prev.map(p => {
      const mockPrice = Math.random() * 1000 + 100;
      const lastPrice = p.lastPurchasePrice || mockPrice;
      const change = ((mockPrice - lastPrice) / lastPrice) * 100;
      return {
        ...p,
        currentPrice: mockPrice,
        priceChange: change
      };
    }));
  };

  useEffect(() => {
    if (isRunning) {
      const interval = setInterval(() => {
        simulatePriceUpdate();
        addLog('info', '🔄 Vérification des prix...');
      }, globalSettings.checkInterval * 1000);
      return () => clearInterval(interval);
    }
  }, [isRunning, globalSettings.checkInterval]);

  const totalBudget = pairs.reduce((sum, p) => 
    p.enabled ? sum + (parseFloat(p.purchaseAmount) * p.maxPurchases) : sum, 0
  );

  const totalPurchases = pairs.reduce((sum, p) => sum + p.purchaseCount, 0);

  const exportConfig = () => {
    const config = {
      globalSettings,
      pairs: pairs.map(({ currentPrice, lastPurchasePrice, purchaseCount, balance, priceChange, ...rest }) => rest)
    };
    const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'dca-bot-config.json';
    a.click();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-white p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold mb-2">🤖 DCA Bot Manager</h1>
            <p className="text-gray-400">Gestion multi-paires sur Arbitrum</p>
          </div>
          <div className="flex gap-4">
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="px-6 py-3 bg-slate-700 hover:bg-slate-600 rounded-lg flex items-center gap-2 transition"
            >
              <Settings size={20} />
              Paramètres
            </button>
            {!isRunning ? (
              <button
                onClick={startBot}
                className="px-6 py-3 bg-green-600 hover:bg-green-500 rounded-lg flex items-center gap-2 transition font-semibold"
              >
                <Play size={20} />
                Démarrer
              </button>
            ) : (
              <button
                onClick={stopBot}
                className="px-6 py-3 bg-red-600 hover:bg-red-500 rounded-lg flex items-center gap-2 transition font-semibold"
              >
                <Pause size={20} />
                Arrêter
              </button>
            )}
          </div>
        </div>

        {/* Settings Panel */}
        {showSettings && (
          <div className="bg-slate-800 rounded-lg p-6 mb-6 border border-slate-700">
            <h2 className="text-2xl font-bold mb-4">⚙️ Configuration Globale</h2>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm text-gray-400 mb-2">RPC URL Arbitrum</label>
                <input
                  type="text"
                  value={globalSettings.rpcUrl}
                  onChange={(e) => setGlobalSettings({...globalSettings, rpcUrl: e.target.value})}
                  placeholder="https://arb-mainnet.g.alchemy.com/v2/..."
                  className="w-full px-4 py-2 bg-slate-700 rounded border border-slate-600 focus:border-purple-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-2">Clé Privée</label>
                <input
                  type="password"
                  value={globalSettings.privateKey}
                  onChange={(e) => setGlobalSettings({...globalSettings, privateKey: e.target.value})}
                  placeholder="0x..."
                  className="w-full px-4 py-2 bg-slate-700 rounded border border-slate-600 focus:border-purple-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-2">% de baisse pour achat</label>
                <input
                  type="number"
                  value={globalSettings.dropPercentage}
                  onChange={(e) => setGlobalSettings({...globalSettings, dropPercentage: parseFloat(e.target.value)})}
                  className="w-full px-4 py-2 bg-slate-700 rounded border border-slate-600 focus:border-purple-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-2">Intervalle (secondes)</label>
                <input
                  type="number"
                  value={globalSettings.checkInterval}
                  onChange={(e) => setGlobalSettings({...globalSettings, checkInterval: parseInt(e.target.value)})}
                  className="w-full px-4 py-2 bg-slate-700 rounded border border-slate-600 focus:border-purple-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-2">Slippage toléré (%)</label>
                <input
                  type="number"
                  value={globalSettings.slippageTolerance}
                  onChange={(e) => setGlobalSettings({...globalSettings, slippageTolerance: parseFloat(e.target.value)})}
                  className="w-full px-4 py-2 bg-slate-700 rounded border border-slate-600 focus:border-purple-500 outline-none"
                />
              </div>
              <div className="flex items-end">
                <button
                  onClick={exportConfig}
                  className="w-full px-4 py-2 bg-purple-600 hover:bg-purple-500 rounded transition"
                >
                  📥 Exporter la config
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Stats Overview */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
            <div className="text-gray-400 text-sm mb-1">Budget Total Max</div>
            <div className="text-2xl font-bold">${totalBudget.toLocaleString()}</div>
          </div>
          <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
            <div className="text-gray-400 text-sm mb-1">Paires Actives</div>
            <div className="text-2xl font-bold">{pairs.filter(p => p.enabled).length}/{pairs.length}</div>
          </div>
          <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
            <div className="text-gray-400 text-sm mb-1">Achats Effectués</div>
            <div className="text-2xl font-bold">{totalPurchases}</div>
          </div>
          <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
            <div className="text-gray-400 text-sm mb-1">Statut</div>
            <div className="text-2xl font-bold flex items-center gap-2">
              {isRunning ? (
                <><div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div> Actif</>
              ) : (
                <><div className="w-3 h-3 bg-gray-500 rounded-full"></div> Arrêté</>
              )}
            </div>
          </div>
        </div>

        {/* Pairs Grid */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          {pairs.map(pair => (
            <div
              key={pair.id}
              className={`bg-slate-800 rounded-lg p-6 border-2 transition ${
                pair.enabled ? 'border-purple-500' : 'border-slate-700 opacity-50'
              }`}
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-2xl font-bold mb-1">{pair.name}</h3>
                  <div className="text-sm text-gray-400">Balance: {parseFloat(pair.balance).toFixed(4)}</div>
                </div>
                <button
                  onClick={() => togglePair(pair.id)}
                  className={`px-4 py-2 rounded transition ${
                    pair.enabled 
                      ? 'bg-green-600 hover:bg-green-500' 
                      : 'bg-slate-600 hover:bg-slate-500'
                  }`}
                >
                  {pair.enabled ? 'ON' : 'OFF'}
                </button>
              </div>

              {pair.currentPrice && (
                <div className="mb-4 p-3 bg-slate-700 rounded">
                  <div className="text-sm text-gray-400">Prix actuel</div>
                  <div className="text-xl font-bold">${pair.currentPrice.toFixed(2)}</div>
                  {pair.lastPurchasePrice && (
                    <div className={`text-sm mt-1 ${pair.priceChange < 0 ? 'text-red-400' : 'text-green-400'}`}>
                      {pair.priceChange > 0 ? '+' : ''}{pair.priceChange.toFixed(2)}% depuis dernier achat
                    </div>
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 mb-4">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Montant (USDC)</label>
                  <input
                    type="number"
                    value={pair.purchaseAmount}
                    onChange={(e) => updatePair(pair.id, { purchaseAmount: e.target.value })}
                    disabled={isRunning}
                    className="w-full px-3 py-2 bg-slate-700 rounded text-sm border border-slate-600 focus:border-purple-500 outline-none disabled:opacity-50"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Max Achats</label>
                  <input
                    type="number"
                    value={pair.maxPurchases}
                    onChange={(e) => updatePair(pair.id, { maxPurchases: parseInt(e.target.value) })}
                    disabled={isRunning}
                    className="w-full px-3 py-2 bg-slate-700 rounded text-sm border border-slate-600 focus:border-purple-500 outline-none disabled:opacity-50"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between text-sm">
                <div className="text-gray-400">
                  Achats: {pair.purchaseCount}/{pair.maxPurchases}
                </div>
                <div className="text-gray-400">
                  Budget: ${(parseFloat(pair.purchaseAmount) * pair.maxPurchases).toLocaleString()}
                </div>
              </div>

              <div className="mt-3 bg-slate-700 rounded-full h-2">
                <div
                  className="bg-purple-500 h-2 rounded-full transition-all"
                  style={{ width: `${(pair.purchaseCount / pair.maxPurchases) * 100}%` }}
                ></div>
              </div>
            </div>
          ))}
        </div>

        {/* Logs */}
        <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold">📋 Journal d'activité</h2>
            <button
              onClick={() => setLogs([])}
              className="text-sm text-gray-400 hover:text-white transition"
            >
              Effacer
            </button>
          </div>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {logs.map((log, i) => (
              <div
                key={i}
                className={`p-3 rounded text-sm ${
                  log.type === 'error' ? 'bg-red-900/30 text-red-300' :
                  log.type === 'success' ? 'bg-green-900/30 text-green-300' :
                  'bg-slate-700 text-gray-300'
                }`}
              >
                <span className="text-gray-500 mr-2">[{log.time}]</span>
                {log.message}
              </div>
            ))}
          </div>
        </div>

        {/* Warning */}
        <div className="mt-6 bg-yellow-900/30 border border-yellow-700 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="text-yellow-500 flex-shrink-0 mt-1" size={20} />
          <div className="text-sm text-yellow-200">
            <strong>Attention:</strong> Cette interface est un prototype. Pour l'utiliser en production, vous devrez connecter le backend Node.js avec des WebSockets ou une API REST pour communiquer avec le bot réel.
          </div>
        </div>
      </div>
    </div>
  );
};

export default DCABotManager;
