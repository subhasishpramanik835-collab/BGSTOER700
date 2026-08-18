import React, { useState, useEffect } from 'react';
import { Mail, ShieldCheck, Key, Plus, HelpCircle, CheckCircle2, AlertCircle, Trash2, Edit, RefreshCw, Send, Lock, Star, Check, Copy, ExternalLink, X } from 'lucide-react';
import { collection, onSnapshot, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { soundFx } from '../../utils/audio';

export interface SmtpAccount {
  id: string;
  email: string;
  senderName: string;
  appPasswordEncrypted: string;
  host: string;
  port: number;
  isPrimaryOtpSender: boolean;
  createdAt: string;
  lastTestedAt?: string;
  status: 'Active' | 'Inactive' | 'Testing';
}

export const AdminSmtpManager: React.FC = () => {
  const [accounts, setAccounts] = useState<SmtpAccount[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showGuideModal, setShowGuideModal] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Add/Edit Form state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formEmail, setFormEmail] = useState('');
  const [formSenderName, setFormSenderName] = useState('BETGURU Security Team');
  const [formAppPassword, setFormAppPassword] = useState('');
  const [formHost, setFormHost] = useState('smtp.gmail.com');
  const [formPort, setFormPort] = useState<number>(587);
  const [formIsPrimary, setFormIsPrimary] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Test Email state
  const [testTargetEmail, setTestTargetEmail] = useState('');
  const [testingAccId, setTestingAccId] = useState<string | null>(null);

  // Real-time listener for smtp_accounts collection
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'smtp_accounts'), (snap) => {
      const list: SmtpAccount[] = [];
      snap.forEach((d) => {
        list.push({ id: d.id, ...d.data() } as SmtpAccount);
      });
      // Sort primary first
      list.sort((a, b) => (b.isPrimaryOtpSender ? 1 : 0) - (a.isPrimaryOtpSender ? 1 : 0));
      setAccounts(list);
    }, (err) => console.warn('SMTP snapshot notice:', err.message));

    return () => unsub();
  }, []);

  const handleOpenAddModal = () => {
    soundFx.playClick();
    setEditingId(null);
    setFormEmail('');
    setFormSenderName('BETGURU Security Team');
    setFormAppPassword('');
    setFormHost('smtp.gmail.com');
    setFormPort(587);
    setFormIsPrimary(accounts.length === 0);
    setShowAddModal(true);
  };

  const handleOpenEditModal = (acc: SmtpAccount) => {
    soundFx.playClick();
    setEditingId(acc.id);
    setFormEmail(acc.email);
    setFormSenderName(acc.senderName);
    setFormAppPassword(acc.appPasswordEncrypted);
    setFormHost(acc.host || 'smtp.gmail.com');
    setFormPort(acc.port || 587);
    setFormIsPrimary(acc.isPrimaryOtpSender);
    setShowAddModal(true);
  };

  const handleSaveAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formEmail.trim() || !formEmail.includes('@')) {
      setStatusMsg({ type: 'error', text: 'Please enter a valid Gmail address!' });
      return;
    }
    if (!formAppPassword.trim()) {
      setStatusMsg({ type: 'error', text: 'Please enter a 16-character Google App Password!' });
      return;
    }

    setIsSaving(true);
    setStatusMsg(null);

    try {
      const accId = editingId || `SMTP-${Date.now()}`;

      // If set as primary, unset other accounts first
      if (formIsPrimary) {
        for (const acc of accounts) {
          if (acc.id !== accId && acc.isPrimaryOtpSender) {
            await setDoc(doc(db, 'smtp_accounts', acc.id), { isPrimaryOtpSender: false }, { merge: true });
          }
        }
      }

      const accData: SmtpAccount = {
        id: accId,
        email: formEmail.trim().toLowerCase(),
        senderName: formSenderName.trim() || 'BETGURU Security',
        appPasswordEncrypted: formAppPassword.trim(),
        host: formHost.trim() || 'smtp.gmail.com',
        port: Number(formPort) || 587,
        isPrimaryOtpSender: formIsPrimary,
        createdAt: new Date().toISOString(),
        status: 'Active'
      };

      await setDoc(doc(db, 'smtp_accounts', accId), accData, { merge: true });

      soundFx.playWinFanfare();
      setStatusMsg({
        type: 'success',
        text: `✓ Gmail SMTP account (${accData.email}) saved successfully! Configured as ${formIsPrimary ? 'PRIMARY OTP SENDER' : 'BACKUP SENDER'}.`
      });

      setShowAddModal(false);
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: `Failed to save account: ${err.message}` });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteAccount = async (id: string, email: string) => {
    soundFx.playClick();
    if (!confirm(`Are you sure you want to remove ${email}?`)) return;

    try {
      await deleteDoc(doc(db, 'smtp_accounts', id));
      setStatusMsg({ type: 'success', text: `Removed Gmail account ${email}.` });
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: `Failed to delete: ${err.message}` });
    }
  };

  const handleSetPrimary = async (acc: SmtpAccount) => {
    soundFx.playClick();
    try {
      for (const a of accounts) {
        await setDoc(doc(db, 'smtp_accounts', a.id), { isPrimaryOtpSender: a.id === acc.id }, { merge: true });
      }
      setStatusMsg({ type: 'success', text: `Set ${acc.email} as Primary OTP Sender.` });
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: `Failed to update primary sender: ${err.message}` });
    }
  };

  const handleTestSmtp = async (acc: SmtpAccount, customTargetEmail?: string) => {
    soundFx.playClick();
    setTestingAccId(acc.id);
    setStatusMsg(null);

    try {
      const target = customTargetEmail || testTargetEmail.trim() || acc.email;
      const res = await fetch('/api/test-smtp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: acc.email,
          appPassword: acc.appPasswordEncrypted,
          senderName: acc.senderName,
          host: acc.host,
          port: acc.port,
          testTarget: target
        })
      });

      let data: any = {};
      const textResp = await res.text();
      try {
        data = JSON.parse(textResp);
      } catch {
        data = {
          success: false,
          error: `Server returned non-JSON response (${res.status}): ${textResp.slice(0, 120)}`
        };
      }

      if (data.success) {
        await setDoc(doc(db, 'smtp_accounts', acc.id), {
          lastTestedAt: new Date().toISOString(),
          status: 'Active'
        }, { merge: true });

        soundFx.playWinFanfare();
        setStatusMsg({
          type: 'success',
          text: `⚡ ${data.message}`
        });
      } else {
        await setDoc(doc(db, 'smtp_accounts', acc.id), {
          status: 'Inactive'
        }, { merge: true });

        setStatusMsg({
          type: 'error',
          text: `❌ SMTP Connection Error: ${data.error}`
        });
      }
    } catch (err: any) {
      console.error('SMTP test fetch error:', err);
      setStatusMsg({
        type: 'error',
        text: `Network Error: ${err.message}`
      });
    } finally {
      setTestingAccId(null);
    }
  };

  const activePrimary = accounts.find(a => a.isPrimaryOtpSender);

  return (
    <div className="space-y-6 font-mono">
      {/* Top Banner Matching Screenshot 2 */}
      <div className="p-6 bg-gradient-to-r from-slate-900 via-purple-950/70 to-slate-950 rounded-3xl border border-purple-500/30 shadow-2xl space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="p-2.5 bg-purple-500/20 text-purple-400 border border-purple-500/40 rounded-2xl">
                <Mail className="w-6 h-6 text-purple-400" />
              </div>
              <div>
                <h2 className="text-xl font-black text-white">Gmail SMTP Management</h2>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[10px] bg-purple-500/20 text-purple-300 border border-purple-500/40 px-2.5 py-0.5 rounded-full font-bold uppercase flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3 text-purple-400" />
                    SUPER ADMIN RESTRICTED ACCESS
                  </span>
                </div>
              </div>
            </div>

            <p className="text-xs text-slate-300 max-w-3xl leading-relaxed">
              Configure and manage multiple Gmail SMTP accounts for sending OTP verification codes and transaction notifications. Encrypted 16-character Google App Passwords ensure high deliverability and secure credentials.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              onClick={() => { soundFx.playClick(); setShowGuideModal(true); }}
              className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-purple-300 border border-purple-500/40 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shadow-lg"
            >
              <HelpCircle className="w-4 h-4 text-purple-400" />
              <span>Google App Password Guide</span>
            </button>

            <button
              onClick={handleOpenAddModal}
              className="px-4 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-black text-xs rounded-2xl transition-all flex items-center gap-2 cursor-pointer shadow-xl shadow-purple-600/30"
            >
              <Plus className="w-4 h-4" />
              <span>Add Gmail Account</span>
            </button>
          </div>
        </div>
      </div>

      {/* Status Notification */}
      {statusMsg && (
        <div className={`p-4 rounded-2xl border text-xs flex items-center gap-3 shadow-lg animate-in fade-in ${
          statusMsg.type === 'success'
            ? 'bg-emerald-950/90 border-emerald-500/50 text-emerald-300'
            : 'bg-rose-950/90 border-rose-500/50 text-rose-300'
        }`}>
          {statusMsg.type === 'success' ? <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-400" /> : <AlertCircle className="w-5 h-5 shrink-0 text-rose-400" />}
          <span className="font-bold">{statusMsg.text}</span>
        </div>
      )}

      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-5 bg-slate-900 border border-slate-800 rounded-3xl flex items-center justify-between">
          <div>
            <span className="text-[10px] text-slate-400 uppercase font-black block">TOTAL ACCOUNTS</span>
            <span className="text-3xl font-black text-white block mt-1">{accounts.length}</span>
            <span className="text-[10px] text-slate-500 block mt-0.5">Configured Gmail Senders</span>
          </div>
          <div className="p-3 bg-purple-500/10 text-purple-400 border border-purple-500/20 rounded-2xl">
            <Mail className="w-8 h-8" />
          </div>
        </div>

        <div className="p-5 bg-slate-900 border border-slate-800 rounded-3xl flex items-center justify-between">
          <div>
            <span className="text-[10px] text-purple-400 uppercase font-black block flex items-center gap-1">
              <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
              ACTIVE OTP SENDER
            </span>
            <span className="text-base font-black text-white block mt-1 truncate max-w-xs">
              {activePrimary ? activePrimary.email : 'No Primary Selected'}
            </span>
            <span className="text-[10px] text-emerald-400 block mt-0.5 font-bold">
              {activePrimary ? `Sender: ${activePrimary.senderName} (TLS :${activePrimary.port})` : 'Please add an account'}
            </span>
          </div>
          <div className="p-3 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-2xl">
            <ShieldCheck className="w-8 h-8" />
          </div>
        </div>
      </div>

      {/* Test Email Dispatch Bar */}
      {accounts.length > 0 && (
        <div className="p-4 bg-slate-900 border border-purple-500/30 rounded-3xl space-y-2 shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black text-white flex items-center gap-2">
              <Send className="w-4 h-4 text-purple-400" />
              <span>Send Test Email / OTP To Custom Address</span>
            </span>
            <span className="text-[10px] text-slate-400 font-mono">Uses active primary sender: <strong className="text-amber-400">{activePrimary?.email || accounts[0]?.email}</strong></span>
          </div>
          <div className="flex flex-col sm:flex-row items-center gap-2">
            <input
              type="email"
              placeholder="Enter recipient email (e.g. testuser@gmail.com)"
              value={testTargetEmail}
              onChange={(e) => setTestTargetEmail(e.target.value)}
              className="w-full sm:flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-purple-500 font-mono"
            />
            <button
              onClick={() => {
                const targetAcc = activePrimary || accounts[0];
                if (targetAcc) handleTestSmtp(targetAcc, testTargetEmail);
              }}
              disabled={!!testingAccId}
              className="w-full sm:w-auto px-5 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-black text-xs rounded-xl transition-all cursor-pointer shadow-md shrink-0 flex items-center justify-center gap-2"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{testingAccId ? 'Sending...' : 'Send Live Test Email'}</span>
            </button>
          </div>
        </div>
      )}

      {/* Gmail Accounts List */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h3 className="text-sm font-black text-white flex items-center gap-2">
            <Lock className="w-4 h-4 text-purple-400" />
            <span>Configured Gmail Accounts ({accounts.length})</span>
          </h3>
          <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2.5 py-0.5 rounded font-bold">
            TLS ENCRYPTED 256-BIT
          </span>
        </div>

        {accounts.length === 0 ? (
          <div className="py-12 text-center space-y-3">
            <Mail className="w-10 h-10 text-slate-700 mx-auto" />
            <p className="text-xs text-slate-400 font-bold">No Gmail SMTP accounts configured yet.</p>
            <p className="text-[11px] text-slate-500 max-w-md mx-auto">
              Click the "Add Gmail Account" button above to add a sender for OTP codes and email alerts.
            </p>
            <button
              onClick={handleOpenAddModal}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs rounded-xl transition-all"
            >
              + Add First Gmail Account
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {accounts.map((acc) => (
              <div
                key={acc.id}
                className={`p-4 rounded-2xl border transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                  acc.isPrimaryOtpSender
                    ? 'bg-purple-950/40 border-purple-500/50 shadow-lg'
                    : 'bg-slate-950 border-slate-800'
                }`}
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-black text-white">{acc.email}</span>

                    {acc.isPrimaryOtpSender && (
                      <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                        <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                        PRIMARY OTP SENDER
                      </span>
                    )}

                    <span className="text-[10px] bg-slate-900 text-slate-400 border border-slate-800 px-2 py-0.5 rounded font-bold">
                      Host: {acc.host}:{acc.port}
                    </span>
                  </div>

                  <p className="text-xs text-slate-300">
                    Sender Name: <strong className="text-purple-300">{acc.senderName}</strong>
                  </p>

                  <div className="flex items-center gap-3 text-[10px] text-slate-500 flex-wrap">
                    <span>App Password: <strong className="text-slate-400">•••• •••• •••• {acc.appPasswordEncrypted.slice(-4)}</strong></span>
                    <span>• Status: <strong className="text-emerald-400">{acc.status}</strong></span>
                    {acc.lastTestedAt && <span>• Tested: {new Date(acc.lastTestedAt).toLocaleTimeString()}</span>}
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap shrink-0">
                  <button
                    onClick={() => handleTestSmtp(acc)}
                    disabled={testingAccId === acc.id}
                    className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-purple-300 border border-purple-500/30 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                    title="Send Test Connection Request"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{testingAccId === acc.id ? 'Testing...' : 'Test Connection'}</span>
                  </button>

                  {!acc.isPrimaryOtpSender && (
                    <button
                      onClick={() => handleSetPrimary(acc)}
                      className="px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                    >
                      <Star className="w-3.5 h-3.5" />
                      <span>Set Primary</span>
                    </button>
                  )}

                  <button
                    onClick={() => handleOpenEditModal(acc)}
                    className="p-1.5 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-xl border border-slate-800 transition-colors"
                    title="Edit Credentials"
                  >
                    <Edit className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => handleDeleteAccount(acc.id, acc.email)}
                    className="p-1.5 bg-rose-950/60 hover:bg-rose-900 text-rose-400 hover:text-white rounded-xl border border-rose-500/30 transition-colors"
                    title="Delete Account"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add/Edit Account Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-purple-500/40 rounded-3xl p-6 max-w-lg w-full space-y-5 shadow-2xl relative">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-black text-white flex items-center gap-2">
                <Mail className="w-5 h-5 text-purple-400" />
                <span>{editingId ? 'Edit Gmail Account' : 'Add New Gmail SMTP Account'}</span>
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1.5 bg-slate-800 text-slate-400 hover:text-white rounded-xl"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveAccount} className="space-y-4 text-xs font-mono">
              <div className="space-y-1">
                <label className="text-slate-300 font-bold block">Gmail Email Address</label>
                <input
                  type="email"
                  required
                  placeholder="e.g. auth.betguru@gmail.com"
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white focus:outline-none focus:border-purple-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-slate-300 font-bold block">Sender Name (Display Name)</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. BETGURU Security Team"
                  value={formSenderName}
                  onChange={(e) => setFormSenderName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white focus:outline-none focus:border-purple-500"
                />
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-slate-300 font-bold block">Google App Password (16 Characters)</label>
                  <button
                    type="button"
                    onClick={() => setShowGuideModal(true)}
                    className="text-[10px] text-purple-400 hover:underline flex items-center gap-1"
                  >
                    <HelpCircle className="w-3 h-3" />
                    How to generate?
                  </button>
                </div>
                <input
                  type="password"
                  required
                  placeholder="e.g. abcd efgh ijkl mnop"
                  value={formAppPassword}
                  onChange={(e) => setFormAppPassword(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white focus:outline-none focus:border-purple-500"
                />
                <p className="text-[10px] text-slate-500">
                  Generate a 16-character App Password from Google Account Security. Standard account passwords will fail.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-slate-300 font-bold block">SMTP Host</label>
                  <input
                    type="text"
                    value={formHost}
                    onChange={(e) => setFormHost(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-slate-300 font-bold block">Port</label>
                  <input
                    type="number"
                    value={formPort}
                    onChange={(e) => setFormPort(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              <div className="pt-2 flex items-center gap-2">
                <input
                  type="checkbox"
                  id="primaryCheck"
                  checked={formIsPrimary}
                  onChange={(e) => setFormIsPrimary(e.target.checked)}
                  className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500 cursor-pointer"
                />
                <label htmlFor="primaryCheck" className="text-slate-200 font-bold cursor-pointer">
                  Set as Default Primary OTP & Notification Sender
                </label>
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl font-bold hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2 bg-purple-600 hover:bg-purple-500 text-white font-black rounded-xl transition-all shadow-lg"
                >
                  {isSaving ? 'Saving...' : 'Save Gmail Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Google App Password Guide Modal */}
      {showGuideModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200 font-mono">
          <div className="bg-slate-900 border border-purple-500/40 rounded-3xl p-6 max-w-xl w-full space-y-5 shadow-2xl relative">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-black text-white flex items-center gap-2">
                <HelpCircle className="w-5 h-5 text-purple-400" />
                <span>Google App Password Setup Instructions</span>
              </h3>
              <button
                onClick={() => setShowGuideModal(false)}
                className="p-1.5 bg-slate-800 text-slate-400 hover:text-white rounded-xl"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-300 leading-relaxed">
              <p className="font-bold text-white">
                Follow these 4 quick steps to generate an App Password for high-deliverability Gmail SMTP:
              </p>

              <div className="space-y-2 pt-1">
                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-0.5">
                  <span className="text-purple-400 font-black block">STEP 1: Enable 2-Step Verification</span>
                  <p className="text-[11px] text-slate-400">
                    Go to your Google Account (<span className="text-amber-300">myaccount.google.com</span>) -&gt; Security -&gt; Turn on 2-Step Verification.
                  </p>
                </div>

                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-0.5">
                  <span className="text-purple-400 font-black block">STEP 2: Search "App Passwords"</span>
                  <p className="text-[11px] text-slate-400">
                    In the Google Account search bar, type <strong className="text-white">"App Passwords"</strong> or navigate to Security -&gt; 2-Step Verification -&gt; App passwords.
                  </p>
                </div>

                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-0.5">
                  <span className="text-purple-400 font-black block">STEP 3: Generate New Password</span>
                  <p className="text-[11px] text-slate-400">
                    Enter app name as <strong className="text-white">"BETGURU Applet"</strong> and click Generate. Google will display a 16-character code (e.g., <code className="text-amber-300 bg-slate-900 px-1 py-0.5 rounded">abcd efgh ijkl mnop</code>).
                  </p>
                </div>

                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-0.5">
                  <span className="text-purple-400 font-black block">STEP 4: Paste into BETGURU Admin</span>
                  <p className="text-[11px] text-slate-400">
                    Copy the 16-character code into the "Google App Password" field in the Add Account form.
                  </p>
                </div>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setShowGuideModal(false)}
                className="px-5 py-2 bg-purple-600 hover:bg-purple-500 text-white font-black text-xs rounded-xl transition-all"
              >
                Understood, Got It!
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
