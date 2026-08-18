import React, { useState, useEffect } from 'react';
import { QrCode, Upload, CheckCircle2, AlertCircle, Save, Loader2, RefreshCw, Copy, ShieldCheck, DollarSign, FileText } from 'lucide-react';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase';
import { PaymentConfig } from '../../types';
import { soundFx } from '../../utils/audio';

const DEFAULT_PAYMENT_CONFIG: PaymentConfig = {
  upiId: 'betguru.pay@ybl',
  qrCodeUrl: '',
  accountName: 'BETGURU OFFICIAL ENTERPRISES',
  minDeposit: 100,
  maxDeposit: 100000,
  instructions: '1. Scan QR code or copy UPI ID.\n2. Complete payment in PhonePe, GPay, Paytm or BHIM.\n3. Enter the 12-digit UTR/Reference number.\n4. Upload payment screenshot proof and submit.',
  updatedAt: new Date().toISOString()
};

export const AdminPaymentManager: React.FC = () => {
  const [config, setConfig] = useState<PaymentConfig>(DEFAULT_PAYMENT_CONFIG);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [uploadingQr, setUploadingQr] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Subscribe to real-time payment config from Firestore
  useEffect(() => {
    const docRef = doc(db, 'payment_config', 'main');
    const unsubscribe = onSnapshot(
      docRef,
      (snapshot) => {
        if (snapshot.exists()) {
          setConfig({ ...DEFAULT_PAYMENT_CONFIG, ...snapshot.data() });
        } else {
          // Initialize if document doesn't exist
          setDoc(docRef, DEFAULT_PAYMENT_CONFIG).catch((err) =>
            console.warn('Error initializing payment config:', err)
          );
        }
        setLoading(false);
      },
      (err) => {
        console.warn('Payment config snapshot error:', err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  // Save payment configuration to Firestore
  const handleSaveConfig = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSaving(true);
    setStatusMessage(null);

    try {
      const updatedData: PaymentConfig = {
        ...config,
        updatedAt: new Date().toISOString()
      };

      await setDoc(doc(db, 'payment_config', 'main'), updatedData, { merge: true });
      soundFx.playCoin();
      setStatusMessage({
        type: 'success',
        text: 'Payment settings saved & synced to user Deposit modal in real time!'
      });
    } catch (err: any) {
      console.error('Error saving payment config:', err);
      setStatusMessage({
        type: 'error',
        text: `Failed to save payment settings: ${err.message || 'Unknown error'}`
      });
    } finally {
      setSaving(false);
    }
  };

  // Canvas Image Compression Helper for QR Code
  const compressImage = (file: File, maxWidth = 600, quality = 0.8): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL('image/jpeg', quality));
          } else {
            resolve((e.target?.result as string) || '');
          }
        };
        img.onerror = () => reject(new Error('Image load failed'));
        img.src = (e.target?.result as string) || '';
      };
      reader.onerror = () => reject(new Error('File read failed'));
      reader.readAsDataURL(file);
    });
  };

  // QR Code Image Upload Handler
  const handleQrUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingQr(true);
    setStatusMessage(null);

    try {
      const compressedDataUrl = await compressImage(file, 600, 0.8);
      setConfig((prev) => ({ ...prev, qrCodeUrl: compressedDataUrl }));

      // Automatically save to Firestore immediately
      await setDoc(
        doc(db, 'payment_config', 'main'),
        {
          qrCodeUrl: compressedDataUrl,
          updatedAt: new Date().toISOString()
        },
        { merge: true }
      );

      soundFx.playWinFanfare();
      setStatusMessage({
        type: 'success',
        text: 'QR Code image uploaded & updated instantly in real time!'
      });
    } catch (err: any) {
      console.error('QR upload failed:', err);
      setStatusMessage({ type: 'error', text: 'Failed to upload QR code image.' });
    } finally {
      setUploadingQr(false);
      e.target.value = '';
    }
  };

  if (loading) {
    return (
      <div className="p-8 text-center text-slate-400 font-mono flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
        <span>Loading Real-time Payment Gateway Configuration...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 font-mono">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-5 bg-gradient-to-r from-slate-900 via-amber-950/40 to-slate-950 rounded-3xl border border-amber-500/30 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-2xl">
            <QrCode className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-black text-white flex items-center gap-2">
              <span>Payment Gateway Settings</span>
              <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2.5 py-0.5 rounded-full uppercase">
                INSTANT REALTIME SYNC
              </span>
            </h2>
            <p className="text-xs text-slate-400">
              Update UPI ID, QR Code image, account name, deposit limits, and instructions shown on user dashboard.
            </p>
          </div>
        </div>

        <button
          onClick={() => handleSaveConfig()}
          disabled={saving}
          className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-black text-xs rounded-2xl shadow-lg shadow-amber-500/20 flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          <span>{saving ? 'Saving...' : 'Save Settings'}</span>
        </button>
      </div>

      {/* Notification Banner */}
      {statusMessage && (
        <div
          className={`p-4 rounded-2xl border text-xs flex items-center gap-2 ${
            statusMessage.type === 'success'
              ? 'bg-emerald-950/80 border-emerald-500/50 text-emerald-300'
              : 'bg-rose-950/80 border-rose-500/50 text-rose-300'
          }`}
        >
          {statusMessage.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 shrink-0" />
          )}
          <span>{statusMessage.text}</span>
        </div>
      )}

      {/* Main Settings Form */}
      <form onSubmit={handleSaveConfig} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Col (2 Spans): Input Fields */}
        <div className="lg:col-span-2 space-y-5 bg-slate-900 border border-slate-800 rounded-3xl p-6">
          <h3 className="text-sm font-black text-amber-400 uppercase tracking-wider border-b border-slate-800 pb-3 flex items-center gap-2">
            <DollarSign className="w-4 h-4" />
            <span>Gateway & Bank Details</span>
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* UPI ID */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-300 uppercase block">
                Primary UPI ID <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                required
                value={config.upiId}
                onChange={(e) => setConfig({ ...config, upiId: e.target.value })}
                placeholder="e.g. betguru.pay@ybl"
                className="w-full bg-slate-950 border border-slate-800 focus:border-amber-400 text-white font-mono font-bold text-sm rounded-xl px-3.5 py-2.5 outline-none transition-all"
              />
              <p className="text-[10px] text-slate-500">Users will see and copy this UPI ID on the deposit screen.</p>
            </div>

            {/* Account / Beneficiary Name */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-300 uppercase block">
                Account / Beneficiary Name
              </label>
              <input
                type="text"
                value={config.accountName}
                onChange={(e) => setConfig({ ...config, accountName: e.target.value })}
                placeholder="e.g. BETGURU OFFICIAL ENTERPRISES"
                className="w-full bg-slate-950 border border-slate-800 focus:border-amber-400 text-white font-mono font-bold text-sm rounded-xl px-3.5 py-2.5 outline-none transition-all"
              />
              <p className="text-[10px] text-slate-500">Displayed next to UPI ID for user verification.</p>
            </div>

            {/* Minimum Deposit */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-300 uppercase block">
                Minimum Deposit (₹)
              </label>
              <input
                type="number"
                min="1"
                value={config.minDeposit}
                onChange={(e) => setConfig({ ...config, minDeposit: Number(e.target.value) || 100 })}
                className="w-full bg-slate-950 border border-slate-800 focus:border-amber-400 text-amber-300 font-mono font-bold text-sm rounded-xl px-3.5 py-2.5 outline-none transition-all"
              />
            </div>

            {/* Maximum Deposit */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-300 uppercase block">
                Maximum Deposit (₹)
              </label>
              <input
                type="number"
                min="100"
                value={config.maxDeposit}
                onChange={(e) => setConfig({ ...config, maxDeposit: Number(e.target.value) || 100000 })}
                className="w-full bg-slate-950 border border-slate-800 focus:border-amber-400 text-amber-300 font-mono font-bold text-sm rounded-xl px-3.5 py-2.5 outline-none transition-all"
              />
            </div>
          </div>

          {/* Deposit Instructions Textarea */}
          <div className="space-y-1.5 pt-2">
            <label className="text-xs font-bold text-slate-300 uppercase flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-amber-400" />
              <span>Deposit Instructions for Players</span>
            </label>
            <textarea
              rows={4}
              value={config.instructions}
              onChange={(e) => setConfig({ ...config, instructions: e.target.value })}
              placeholder="Step 1: Copy UPI ID..."
              className="w-full bg-slate-950 border border-slate-800 focus:border-amber-400 text-slate-200 font-mono text-xs rounded-xl p-3 outline-none leading-relaxed transition-all"
            />
          </div>

          <div className="pt-3">
            <button
              type="submit"
              disabled={saving}
              className="w-full py-3.5 bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-600 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-extrabold text-sm rounded-2xl shadow-xl shadow-amber-500/20 flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-95 disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              <span>Save & Publish Payment Settings</span>
            </button>
          </div>
        </div>

        {/* Right Col: QR Code Upload & Realtime Preview */}
        <div className="space-y-5 bg-slate-900 border border-slate-800 rounded-3xl p-6">
          <h3 className="text-sm font-black text-amber-400 uppercase tracking-wider border-b border-slate-800 pb-3 flex items-center gap-2">
            <QrCode className="w-4 h-4" />
            <span>QR Code Image & Preview</span>
          </h3>

          <div className="flex flex-col items-center justify-center space-y-4">
            {/* QR Image Box */}
            <div className="relative w-48 h-48 bg-white p-3 rounded-2xl border-2 border-amber-500/40 shadow-2xl overflow-hidden flex items-center justify-center group">
              {config.qrCodeUrl ? (
                <img src={config.qrCodeUrl} alt="Payment QR Code" className="w-full h-full object-contain" />
              ) : (
                /* Fallback QR Code Matrix */
                <div className="w-full h-full bg-slate-950 p-3 rounded-xl flex flex-col justify-between">
                  <div className="flex justify-between">
                    <div className="w-8 h-8 bg-amber-400 border-2 border-white"></div>
                    <div className="w-8 h-8 bg-amber-400 border-2 border-white"></div>
                  </div>
                  <div className="text-[10px] font-mono font-bold text-amber-400 text-center tracking-tighter">
                    UPLOAD QR CODE
                  </div>
                  <div className="flex justify-between">
                    <div className="w-8 h-8 bg-amber-400 border-2 border-white"></div>
                    <div className="w-4 h-4 bg-emerald-400"></div>
                  </div>
                </div>
              )}

              {uploadingQr && (
                <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm flex flex-col items-center justify-center text-amber-400 font-bold text-xs gap-2">
                  <Loader2 className="w-6 h-6 animate-spin" />
                  <span>Processing...</span>
                </div>
              )}
            </div>

            {/* Upload Button */}
            <label className="w-full py-2.5 px-4 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl flex items-center justify-center gap-2 cursor-pointer shadow-md transition-all active:scale-95">
              <Upload className="w-4 h-4" />
              <span>{config.qrCodeUrl ? 'Replace QR Code Image' : 'Upload QR Code Image'}</span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleQrUpload}
                className="hidden"
              />
            </label>

            {/* Or Paste Image URL */}
            <div className="w-full space-y-1">
              <label className="text-[10px] text-slate-400 font-bold uppercase block">
                Or Paste Image URL:
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={config.qrCodeUrl.startsWith('data:') ? '' : config.qrCodeUrl}
                  placeholder="https://..."
                  onChange={(e) => setConfig({ ...config, qrCodeUrl: e.target.value })}
                  className="flex-1 bg-slate-950 border border-slate-800 text-xs text-slate-300 rounded-xl px-3 py-1.5 outline-none focus:border-amber-400"
                />
                <button
                  type="button"
                  onClick={() => handleSaveConfig()}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-amber-500 hover:text-slate-950 text-slate-300 font-bold text-xs rounded-xl border border-slate-700 transition-all cursor-pointer shrink-0"
                >
                  Apply
                </button>
              </div>
            </div>

            {/* Information Card */}
            <div className="w-full p-3 bg-slate-950 rounded-2xl border border-slate-800/80 text-[11px] text-slate-400 space-y-1">
              <div className="flex justify-between text-slate-300 font-bold">
                <span>Active UPI ID:</span>
                <span className="text-amber-400">{config.upiId}</span>
              </div>
              <div className="flex justify-between text-slate-300 font-bold">
                <span>Min/Max Deposit:</span>
                <span className="text-emerald-400">₹{config.minDeposit} - ₹{config.maxDeposit.toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between text-slate-500 text-[10px]">
                <span>Last Updated:</span>
                <span>{config.updatedAt ? new Date(config.updatedAt).toLocaleTimeString('en-IN') : 'Just now'}</span>
              </div>
            </div>

          </div>
        </div>

      </form>
    </div>
  );
};
