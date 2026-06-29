import React, { useEffect, useState } from 'react';
import { Cloud, RefreshCw, Server, X } from 'lucide-react';
import { useDB } from '../../lib/useDB';
import { useToast } from '../../lib/ToastContext';
import type { AppSettings, CloudConnection } from '../../lib/dbTypes';

export type ProfileCloudSystemsModalProps = {
  onClose: () => void;
  onBack: () => void;
};

export function ProfileCloudSystemsModal({ onClose, onBack }: ProfileCloudSystemsModalProps) {
  const db = useDB();
  const { showToast } = useToast();
  const [settings, setSettings] = useState(db.settings);
  const [cloudMeta, setCloudMeta] = useState(db.cloudMeta);
  const [cloudForm, setCloudForm] = useState({
    storageName: '',
    accountLabel: '',
    bucket: '',
    region: '',
    endpoint: '',
    accessKeyId: '',
    secretAccessKey: '',
    dataTypes: ['photos', 'videos', 'files'] as Array<'photos' | 'videos' | 'files' | 'messages' | 'stories' | 'posts'>,
  });
  const [syncNowTs, setSyncNowTs] = useState(Date.now());

  useEffect(() => {
    const interval = window.setInterval(() => setSyncNowTs(Date.now()), 30000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    setSettings(db.settings);
    setCloudMeta(db.cloudMeta);
  }, [db]);

  const CLOUD_LOGIN_URLS: Record<string, string> = {
    'AWS S3': 'https://signin.aws.amazon.com/signin',
    'Google Cloud Storage': 'https://accounts.google.com/signin/v2/identifier?service=cloudconsole',
    'Azure Blob': 'https://portal.azure.com',
    iCloud: 'https://www.icloud.com',
    'Cloudflare R2': 'https://dash.cloudflare.com',
    'Backblaze B2': 'https://secure.backblaze.com/user_signin.htm',
    Wasabi: 'https://console.wasabisys.com',
    'DigitalOcean Spaces': 'https://cloud.digitalocean.com/login',
    'Oracle Cloud Object Storage': 'https://cloud.oracle.com',
    'IBM Cloud Object Storage': 'https://cloud.ibm.com/login',
    'Alibaba Cloud OSS': 'https://account.alibabacloud.com/login/login.htm',
    'Tencent Cloud COS': 'https://intl.cloud.tencent.com/login',
    'Huawei Cloud OBS': 'https://auth.huaweicloud.com',
    'OVHcloud Object Storage': 'https://www.ovhcloud.com/en/login/',
    'Scaleway Object Storage': 'https://console.scaleway.com',
    'Linode Object Storage': 'https://login.linode.com/login',
    'Vultr Object Storage': 'https://my.vultr.com',
    'Hetzner Storage Box': 'https://accounts.hetzner.com/login',
    'Akamai Connected Cloud Storage': 'https://login.akamai.com',
    Dropbox: 'https://www.dropbox.com/login',
    Box: 'https://account.box.com/login',
    OneDrive: 'https://login.live.com',
    'Google Drive': 'https://accounts.google.com',
    'Mega Cloud': 'https://mega.nz/login',
    pCloud: 'https://my.pcloud.com',
    IDrive: 'https://www.idrive.com/idrive/login/loginForm',
    'Sync.com': 'https://www.sync.com/login/',
    Egnyte: 'https://www.egnyte.com/login',
    Seafile: 'https://seafile.com/en/login/',
    Nextcloud: 'https://nextcloud.com/signin/',
    MinIO: 'https://min.io/signin',
    'OpenStack Swift': 'https://www.openstack.org/users/',
    Storj: 'https://us1.storj.io/login',
    Filebase: 'https://console.filebase.com',
    'Arweave Storage': 'https://arweave.app',
    'Sia Skynet': 'https://siasky.net'
  };
  const CLOUD_PROVIDERS = [
    'AWS S3',
    'Google Cloud Storage',
    'Azure Blob',
    'iCloud',
    'Cloudflare R2',
    'Backblaze B2',
    'Wasabi',
    'DigitalOcean Spaces',
    'Oracle Cloud Object Storage',
    'IBM Cloud Object Storage',
    'Alibaba Cloud OSS',
    'Tencent Cloud COS',
    'Huawei Cloud OBS',
    'OVHcloud Object Storage',
    'Scaleway Object Storage',
    'Linode Object Storage',
    'Vultr Object Storage',
    'Hetzner Storage Box',
    'Akamai Connected Cloud Storage',
    'Dropbox',
    'Box',
    'OneDrive',
    'Google Drive',
    'Mega Cloud',
    'pCloud',
    'IDrive',
    'Sync.com',
    'Egnyte',
    'Seafile',
    'Nextcloud',
    'MinIO',
    'OpenStack Swift',
    'Storj',
    'Filebase',
    'Arweave Storage',
    'Sia Skynet'
  ] as const;
  const QUICK_CONNECT_PROVIDERS = [
    'AWS S3',
    'Google Cloud Storage',
    'Azure Blob',
    'iCloud',
    'Cloudflare R2',
    'Backblaze B2',
    'OneDrive',
    'Dropbox'
  ] as const;
  const CLOUD_DATA_TYPES: Array<{ key: 'photos' | 'videos' | 'files' | 'messages' | 'stories' | 'posts'; label: string }> = [
    { key: 'photos', label: 'Photos' },
    { key: 'videos', label: 'Videos' },
    { key: 'files', label: 'Files' },
    { key: 'messages', label: 'Messages' },
    { key: 'stories', label: 'Stories' },
    { key: 'posts', label: 'Posts' }
  ];
  const CLOUD_DATA_TYPE_CHIP_CLASS: Record<'photos' | 'videos' | 'files' | 'messages' | 'stories' | 'posts', string> = {
    photos: 'bg-pink-500/15 text-pink-600 dark:text-pink-400 border-pink-500/25',
    videos: 'bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/25',
    files: 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/25',
    messages: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/25',
    stories: 'bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/25',
    posts: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/25'
  };

  const updateSetting = (key: keyof AppSettings, value: AppSettings[keyof AppSettings]) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    db.updateSettings({ [key]: value });
  };

  const formatBytes = (bytes: number) => {
    if (!Number.isFinite(bytes) || bytes <= 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  };

  const getLastSyncText = () => {
    if (!settings.cloudLastSyncAt) return 'Never';
    const last = new Date(settings.cloudLastSyncAt).getTime();
    if (!Number.isFinite(last)) return 'Never';
    const deltaSec = Math.max(0, Math.floor((syncNowTs - last) / 1000));
    if (deltaSec < 10) return 'Just now';
    if (deltaSec < 60) return `${deltaSec}s ago`;
    const mins = Math.floor(deltaSec / 60);
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  const handleCloudSyncNow = () => {
    const result = db.syncToCloud();
    setCloudMeta(db.cloudMeta);
    setSettings(db.settings);
    if (result.ok) {
      showToast(`Cloud sync completed (${formatBytes(result.syncedSize ?? 0)})`);
    } else {
      showToast(result.reason || 'Cloud sync unavailable');
    }
  };

  const handleConnectCloudProvider = () => {
    const result = db.connectCloudProvider({
      provider: settings.cloudProvider || 'None',
      storageName: cloudForm.storageName,
      accountLabel: cloudForm.accountLabel,
      bucket: cloudForm.bucket,
      region: cloudForm.region,
      endpoint: cloudForm.endpoint,
      accessKeyId: cloudForm.accessKeyId,
      secretAccessKey: cloudForm.secretAccessKey,
      dataTypes: cloudForm.dataTypes
    });
    setSettings(db.settings);
    if (result.ok) {
      showToast(`${settings.cloudProvider} connected`);
      setCloudForm((prev) => ({
        ...prev,
        storageName: '',
        accountLabel: '',
        bucket: '',
        region: '',
        endpoint: '',
        accessKeyId: '',
        secretAccessKey: '',
        dataTypes: ['photos', 'videos', 'files']
      }));
    } else {
      showToast(result.reason || 'Unable to connect provider');
    }
  };

  const handleDisconnectCloudProvider = (connectionId?: string) => {
    db.disconnectCloudProvider(connectionId);
    setSettings(db.settings);
    showToast('Cloud provider disconnected');
  };

  const handleSetActiveCloudConnection = (connection: CloudConnection) => {
    db.updateSettings({
      cloudProvider: connection.provider,
      cloudActiveConnectionId: connection.id,
      cloudSyncEnabled: true
    });
    setSettings(db.settings);
    showToast(`Active sync target: ${connection.storageName || connection.accountLabel}`);
  };

  const handleCloudFormDataTypeToggle = (dataType: 'photos' | 'videos' | 'files' | 'messages' | 'stories' | 'posts') => {
    setCloudForm((prev) => {
      const exists = prev.dataTypes.includes(dataType);
      const next = exists ? prev.dataTypes.filter((item) => item !== dataType) : [...prev.dataTypes, dataType];
      return {
        ...prev,
        dataTypes: next.length > 0 ? next : prev.dataTypes
      };
    });
  };

  const handleCloudFormSelectAllDataTypes = () => {
    setCloudForm((prev) => ({
      ...prev,
      dataTypes: CLOUD_DATA_TYPES.map((type) => type.key)
    }));
  };

  const handleCloudFormClearDataTypes = () => {
    setCloudForm((prev) => ({
      ...prev,
      dataTypes: []
    }));
  };

  const handleConnectionStorageNameChange = (connectionId: string, storageName: string) => {
    db.updateCloudConnection(connectionId, { storageName });
    setSettings(db.settings);
  };

  const handleConnectionDataTypeToggle = (connection: CloudConnection, dataType: 'photos' | 'videos' | 'files' | 'messages' | 'stories' | 'posts') => {
    if (!connection.id) return;
    const existing = Array.isArray(connection.dataTypes) ? connection.dataTypes : [];
    const hasType = existing.includes(dataType);
    const nextTypes = hasType ? existing.filter((item: string) => item !== dataType) : [...existing, dataType];
    if (nextTypes.length === 0) return;
    db.updateCloudConnection(connection.id, {
      dataTypes: nextTypes as Array<'photos' | 'videos' | 'files' | 'messages' | 'stories' | 'posts'>,
    });
    setSettings(db.settings);
  };

  const handleConnectionSelectAllDataTypes = (connection: CloudConnection) => {
    if (!connection.id) return;
    db.updateCloudConnection(connection.id, { dataTypes: CLOUD_DATA_TYPES.map((type) => type.key) });
    setSettings(db.settings);
  };

  const handleConnectionClearDataTypes = (connection: CloudConnection) => {
    if (!connection.id) return;
    db.updateCloudConnection(connection.id, { dataTypes: [] });
    setSettings(db.settings);
  };

  const handleQuickProviderConnect = (provider: string) => {
    updateSetting('cloudSyncEnabled', true);
    updateSetting('cloudProvider', provider);
    setTimeout(() => {
      localStorage.setItem('pendingCloudProvider', provider);
      const loginUrl = CLOUD_LOGIN_URLS[provider] || 'https://www.google.com/search?q=' + encodeURIComponent(`${provider} login`);
      window.open(loginUrl, '_blank', 'noopener,noreferrer');
      showToast(`Opening ${provider} login...`);
    }, 0);
  };

  const cloudConnections = Array.isArray(settings.cloudConnections)
    ? settings.cloudConnections
    : (settings.cloudConnection?.connected ? [{ ...settings.cloudConnection, id: settings.cloudConnection.id || 'legacy_connection' }] : []);
  const activeCloudConnection =
    cloudConnections.find((connection: CloudConnection) => connection.id === settings.cloudActiveConnectionId) ||
    cloudConnections.find((connection: CloudConnection) => connection.provider === settings.cloudProvider) ||
    cloudConnections[0] ||
    null;

  useEffect(() => {
    // OAuth callback auto-connect contract:
    // ?cloud_oauth_provider=AWS%20S3&cloud_oauth_status=success&cloud_account=MyAccount&cloud_bucket=my-bucket
    const params = new URLSearchParams(window.location.search);
    const callbackProvider = params.get('cloud_oauth_provider');
    const callbackStatus = params.get('cloud_oauth_status');
    if (callbackProvider && callbackStatus === 'success') {
      updateSetting('cloudSyncEnabled', true);
      updateSetting('cloudProvider', callbackProvider);
      const result = db.connectCloudProvider({
        provider: callbackProvider,
        storageName: params.get('cloud_storage_name') || `${callbackProvider} storage`,
        accountLabel: params.get('cloud_account') || `${callbackProvider} account`,
        bucket: params.get('cloud_bucket') || 'default-storage',
        region: params.get('cloud_region') || '',
        endpoint: params.get('cloud_endpoint') || '',
        accessKeyId: params.get('cloud_key') || 'oauth-session',
        secretAccessKey: 'oauth-session',
        dataTypes: ['photos', 'videos', 'files']
      });
      setSettings(db.settings);
      if (result.ok) showToast(`${callbackProvider} connected via callback`);
      const cleanUrl = `${window.location.pathname}${window.location.hash}`;
      window.history.replaceState({}, document.title, cleanUrl);
    }

    const onWindowFocus = () => {
      const pendingProvider = localStorage.getItem('pendingCloudProvider');
      if (!pendingProvider) return;
      if (!settings.cloudSyncEnabled || settings.cloudProvider !== pendingProvider) return;

      const result = db.connectCloudProvider({
        provider: pendingProvider,
        storageName: cloudForm.storageName || `${pendingProvider} storage`,
        accountLabel: cloudForm.accountLabel || `${pendingProvider} account`,
        bucket: cloudForm.bucket || 'default-storage',
        region: cloudForm.region || '',
        endpoint: cloudForm.endpoint || '',
        accessKeyId: cloudForm.accessKeyId || 'oauth-session',
        secretAccessKey: cloudForm.secretAccessKey || 'oauth-session',
        dataTypes: cloudForm.dataTypes.length > 0 ? cloudForm.dataTypes : ['photos', 'videos', 'files']
      });

      localStorage.removeItem('pendingCloudProvider');
      setSettings(db.settings);
      if (result.ok) {
        showToast(`${pendingProvider} auto-connected after login`);
      }
    };

    window.addEventListener('focus', onWindowFocus);
    return () => window.removeEventListener('focus', onWindowFocus);
  }, [settings.cloudSyncEnabled, settings.cloudProvider, cloudForm, db, showToast]);


  return (
<div id="cloud-systems-modal" className="fixed inset-0 z-50 flex items-center justify-center bg-background">
  <div className="absolute inset-0" onClick={() => onClose()}></div>
  <div className="bg-card w-full max-w-md rounded-3xl border border-border shadow-2xl p-6 flex flex-col max-h-[90vh] overflow-y-auto no-scrollbar relative z-10">
    <div className="flex justify-between items-center mb-6">
      <button
        onClick={() => {
          onBack();
        }}
        className="text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors"
      >
        Back
      </button>
      <h2 className="text-xl font-bold flex items-center gap-2"><Cloud className="w-5 h-5 text-sky-500" /> Cloud Systems</h2>
      <button onClick={() => onClose()} className="text-muted-foreground hover:text-foreground"><X className="w-6 h-6" /></button>
    </div>

    <div className="space-y-3 bg-secondary/30 rounded-xl p-4 border border-border">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold flex items-center gap-2"><Server className="w-4 h-4 text-muted-foreground" /> Enable Cloud Sync</span>
        <button onClick={() => updateSetting('cloudSyncEnabled', !settings.cloudSyncEnabled)} className={`w-12 h-6 rounded-full p-1 transition-colors ${settings.cloudSyncEnabled ? 'bg-green-500' : 'bg-secondary'}`}>
          <div className={`w-4 h-4 rounded-full bg-white transition-transform ${settings.cloudSyncEnabled ? 'translate-x-6' : 'translate-x-0'}`} />
        </button>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold">Cloud Provider</span>
        <select
          value={settings.cloudProvider || 'None'}
          onChange={(e) => {
            const provider = e.target.value;
            updateSetting('cloudProvider', provider);
            if (provider !== 'None') {
              const firstProviderConnection = cloudConnections.find((connection: CloudConnection) => connection.provider === provider);
              if (firstProviderConnection) {
                updateSetting('cloudActiveConnectionId', firstProviderConnection.id);
              } else {
                updateSetting('cloudActiveConnectionId', null);
              }
            }
          }}
          className="bg-secondary text-sm font-semibold rounded-lg px-2 py-1 outline-none border border-border"
        >
          <option>None</option>
          {CLOUD_PROVIDERS.map((provider) => (
            <option key={provider} value={provider}>{provider}</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {QUICK_CONNECT_PROVIDERS.map((provider) => (
          <button
            key={provider}
            onClick={() => handleQuickProviderConnect(provider)}
            className={`py-2 px-2 rounded-lg border text-xs font-bold transition-colors ${
              settings.cloudProvider === provider
                ? 'bg-primary/10 border-primary/30 text-primary'
                : 'bg-secondary/50 border-border hover:border-primary/40'
            }`}
          >
            Connect {provider}
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold">Auto Backup</span>
        <button onClick={() => updateSetting('cloudAutoSync', !settings.cloudAutoSync)} disabled={!settings.cloudSyncEnabled || cloudConnections.length === 0} className={`w-12 h-6 rounded-full p-1 transition-colors disabled:opacity-50 ${settings.cloudAutoSync ? 'bg-green-500' : 'bg-secondary'}`}>
          <div className={`w-4 h-4 rounded-full bg-white transition-transform ${settings.cloudAutoSync ? 'translate-x-6' : 'translate-x-0'}`} />
        </button>
      </div>

      {(settings.cloudProvider || 'None') !== 'None' && (
        <div className="rounded-xl border border-border bg-card p-3 space-y-3">
          <div className="text-xs font-bold text-muted-foreground">
            Connect your third-party cloud account
          </div>
          <input
            value={cloudForm.storageName}
            onChange={(e) => setCloudForm((prev) => ({ ...prev, storageName: e.target.value }))}
            className="w-full bg-secondary text-xs font-medium rounded-lg px-2.5 py-2 outline-none border border-border"
            placeholder="Storage name (e.g. Wei Storage)"
          />
          <input
            value={cloudForm.accountLabel}
            onChange={(e) => setCloudForm((prev) => ({ ...prev, accountLabel: e.target.value }))}
            className="w-full bg-secondary text-xs font-medium rounded-lg px-2.5 py-2 outline-none border border-border"
            placeholder="Account label (e.g. my-prod-storage)"
          />
          <input
            value={cloudForm.bucket}
            onChange={(e) => setCloudForm((prev) => ({ ...prev, bucket: e.target.value }))}
            className="w-full bg-secondary text-xs font-medium rounded-lg px-2.5 py-2 outline-none border border-border"
            placeholder="Bucket / Container name"
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              value={cloudForm.region}
              onChange={(e) => setCloudForm((prev) => ({ ...prev, region: e.target.value }))}
              className="w-full bg-secondary text-xs font-medium rounded-lg px-2.5 py-2 outline-none border border-border"
              placeholder="Region"
            />
            <input
              value={cloudForm.endpoint}
              onChange={(e) => setCloudForm((prev) => ({ ...prev, endpoint: e.target.value }))}
              className="w-full bg-secondary text-xs font-medium rounded-lg px-2.5 py-2 outline-none border border-border"
              placeholder="Endpoint (optional)"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input
              value={cloudForm.accessKeyId}
              onChange={(e) => setCloudForm((prev) => ({ ...prev, accessKeyId: e.target.value }))}
              className="w-full bg-secondary text-xs font-medium rounded-lg px-2.5 py-2 outline-none border border-border"
              placeholder="Access key / client id"
            />
            <input
              type="password"
              value={cloudForm.secretAccessKey}
              onChange={(e) => setCloudForm((prev) => ({ ...prev, secretAccessKey: e.target.value }))}
              className="w-full bg-secondary text-xs font-medium rounded-lg px-2.5 py-2 outline-none border border-border"
              placeholder="Secret key"
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="text-[11px] font-bold text-muted-foreground">Store these data types in this storage</div>
              <div className="flex items-center gap-1">
                <button
                  onClick={handleCloudFormSelectAllDataTypes}
                  className="px-2 py-1 rounded-md text-[10px] font-bold bg-secondary/60 border border-border hover:border-primary/40 transition-colors"
                >
                  Select All
                </button>
                <button
                  onClick={handleCloudFormClearDataTypes}
                  className="px-2 py-1 rounded-md text-[10px] font-bold bg-secondary/60 border border-border hover:border-primary/40 transition-colors"
                >
                  Clear
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {CLOUD_DATA_TYPES.map((type) => {
                const selected = cloudForm.dataTypes.includes(type.key);
                return (
                  <button
                    key={type.key}
                    onClick={() => handleCloudFormDataTypeToggle(type.key)}
                    className={`py-1.5 rounded-lg text-[11px] font-bold border transition-colors ${
                      selected
                        ? 'bg-primary/10 border-primary/30 text-primary'
                        : 'bg-secondary/50 border-border hover:border-primary/40'
                    }`}
                  >
                    {type.label}
                  </button>
                );
              })}
            </div>
          </div>
          <button
            onClick={handleConnectCloudProvider}
            className="w-full mt-1 py-1.5 rounded-lg text-xs font-bold bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20 hover:bg-sky-500/20 transition-colors"
          >
            Add {settings.cloudProvider} Account
          </button>
        </div>
      )}

      {cloudConnections.length > 0 && (
        <div className="space-y-2">
          {cloudConnections.map((connection: CloudConnection) => {
            const isActive = activeCloudConnection?.id === connection.id;
            return (
              <div key={connection.id} className="rounded-xl border border-border bg-card p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-xs font-bold text-green-600 dark:text-green-400">
                    Connected: {connection.storageName || connection.accountLabel}
                  </div>
                  <span className="text-[10px] font-mono px-2 py-1 rounded bg-secondary text-muted-foreground">
                    {connection.provider}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground">
                  Account: <span className="font-mono">{connection.accountLabel}</span>
                </div>
                <div className="space-y-1">
                  <div className="text-[11px] text-muted-foreground font-semibold">Storage name</div>
                  <input
                    value={connection.storageName || connection.accountLabel}
                    onChange={(e) => connection.id && handleConnectionStorageNameChange(connection.id, e.target.value)}
                    className="w-full bg-secondary text-xs font-medium rounded-lg px-2.5 py-2 outline-none border border-border"
                  />
                </div>
                <div className="text-xs text-muted-foreground">
                  Bucket/Container: <span className="font-mono">{connection.bucket}</span>
                </div>
                <div className="text-xs text-muted-foreground">
                  Credential: <span className="font-mono">{connection.credentialHint}</span>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-[11px] text-muted-foreground font-semibold">Data routing</div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleConnectionSelectAllDataTypes(connection)}
                        className="px-2 py-1 rounded-md text-[10px] font-bold bg-secondary/60 border border-border hover:border-primary/40 transition-colors"
                      >
                        Select All
                      </button>
                      <button
                        onClick={() => handleConnectionClearDataTypes(connection)}
                        className="px-2 py-1 rounded-md text-[10px] font-bold bg-secondary/60 border border-border hover:border-primary/40 transition-colors"
                      >
                        Clear
                      </button>
                    </div>
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    Routing: {Array.isArray(connection.dataTypes) && connection.dataTypes.length > 0
                      ? connection.dataTypes
                          .map((type: string) => CLOUD_DATA_TYPES.find((item) => item.key === type)?.label || type)
                          .join(', ')
                      : 'None selected'}
                  </div>
                  {Array.isArray(connection.dataTypes) && connection.dataTypes.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {connection.dataTypes.map((rawType) => {
                        const type = rawType as 'photos' | 'videos' | 'files' | 'messages' | 'stories' | 'posts';
                        const label = CLOUD_DATA_TYPES.find((item) => item.key === type)?.label || type;
                        return (
                          <span
                            key={`${connection.id}_chip_${type}`}
                            className={`px-2 py-1 rounded-full text-[10px] font-bold border ${CLOUD_DATA_TYPE_CHIP_CLASS[type]}`}
                          >
                            {label}
                          </span>
                        );
                      })}
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-2">
                    {CLOUD_DATA_TYPES.map((type) => {
                      const selected = Array.isArray(connection.dataTypes)
                        ? connection.dataTypes.includes(type.key)
                        : false;
                      return (
                        <button
                          key={`${connection.id}_${type.key}`}
                          onClick={() => handleConnectionDataTypeToggle(connection, type.key)}
                          className={`py-1.5 rounded-lg text-[11px] font-bold border transition-colors ${
                            selected
                              ? 'bg-primary/10 border-primary/30 text-primary'
                              : 'bg-secondary/50 border-border hover:border-primary/40'
                          }`}
                        >
                          {type.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => handleSetActiveCloudConnection(connection)}
                    className={`py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                      isActive
                        ? 'bg-primary/10 border-primary/30 text-primary'
                        : 'bg-secondary/50 border-border hover:border-primary/40'
                    }`}
                  >
                    {isActive ? 'Active Target' : 'Set Active'}
                  </button>
                  <button
                    onClick={() => handleDisconnectCloudProvider(connection.id)}
                    className="py-1.5 rounded-lg text-xs font-bold bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500/20 transition-colors"
                  >
                    Disconnect
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="flex justify-between items-center text-xs text-muted-foreground">
        <span>Auto Sync</span>
        <span className={`font-mono ${
          settings.cloudAutoSync &&
          settings.cloudSyncEnabled &&
          cloudConnections.length > 0
            ? 'text-green-600 dark:text-green-400'
            : 'text-muted-foreground'
        }`}>
          {settings.cloudAutoSync &&
          settings.cloudSyncEnabled &&
          cloudConnections.length > 0
            ? 'Active'
            : 'Inactive'}
        </span>
      </div>

      <div className="flex justify-between items-center text-xs text-muted-foreground">
        <span>Last Sync</span>
        <span className="font-mono">{getLastSyncText()}</span>
      </div>
      <div className="flex justify-between items-center text-xs text-muted-foreground">
        <span>Synced Payload</span>
        <span className="font-mono">{formatBytes(cloudMeta.syncedSize || 0)}</span>
      </div>
      <div className="flex justify-between items-center text-xs text-muted-foreground">
        <span>Synced Collections / Items</span>
        <span className="font-mono">{cloudMeta.syncedCollections || 0} / {cloudMeta.syncedItems || 0}</span>
      </div>
    </div>

    <button
      onClick={handleCloudSyncNow}
      disabled={!settings.cloudSyncEnabled || cloudConnections.length === 0}
      className="mt-4 w-full flex items-center justify-center gap-2 py-2 bg-sky-500/10 hover:bg-sky-500/20 text-sky-600 dark:text-sky-400 font-bold rounded-xl transition-colors border border-sky-500/20 disabled:opacity-50"
    >
      <RefreshCw className="w-4 h-4" /> Sync to Cloud Now
    </button>
  </div>
</div>
  );
}
