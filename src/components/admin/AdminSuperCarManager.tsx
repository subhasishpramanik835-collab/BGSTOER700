import React, { useState, useEffect } from 'react';
import {
  Upload, Trash2, Image as ImageIcon, CheckCircle, AlertCircle, Loader2, RefreshCw,
  Lock, DollarSign, Sparkles, TrendingUp, CheckCircle2, XCircle, Search,
  Filter, Grid, Table as TableIcon, Users, Clock, Award, ShieldAlert, ArrowUpRight, RotateCcw,
  Activity, PieChart as PieChartIcon, BarChart2, Trophy, Edit, Zap, Flame, Calendar
} from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell } from 'recharts';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { doc, setDoc, collection, onSnapshot, getDoc } from 'firebase/firestore';
import { db, storage } from '../../firebase';
import { SuperCarConfig, SuperCarColor, PurchasedTicket, User } from '../../types';
import { getSuperCarInfo, formatTicketExactTime, formatTicketExactDateTime, sortChronologicalNewestFirst, groupTicketsByBatch, GroupedTicketBatch } from '../../utils/supercar';
import { soundFx } from '../../utils/audio';
import { PaginationBar } from '../PaginationBar';

interface AdminSuperCarManagerProps {
  config: SuperCarConfig;
  onUpdateConfig: (updated: Partial<SuperCarConfig>) => Promise<void>;
}

export const AdminSuperCarManager: React.FC<AdminSuperCarManagerProps> = ({ config, onUpdateConfig }) => {
  // Top Navigation Sub-Tabs
  const [activeSubTab, setActiveSubTab] = useState<'monitor' | 'draws' | 'tickets' | 'images'>('monitor');

  // Real-time Firestore State
  const [tickets, setTickets] = useState<PurchasedTicket[]>([]);
  const [usersMap, setUsersMap] = useState<{ [uid: string]: User }>({});
  const [drawsMap, setDrawsMap] = useState<{ [issueId: string]: any }>({});

  // Uploader & Action States
  const [uploadingCar, setUploadingCar] = useState<SuperCarColor | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [urlInputs, setUrlInputs] = useState<{ [key in SuperCarColor]?: string }>({});

  // Sub-Tab 1 (Sales Monitor) State
  const todayStr = new Date().toISOString().split('T')[0];
  const [monitorSelectedDateStr, setMonitorSelectedDateStr] = useState<string>(todayStr);
  const [selectedMonitorSlot, setSelectedMonitorSlot] = useState<number | 'all'>('all');

  // Sub-Tab 2 (Daily Draws Results) State
  const [adminSelectedDateStr, setAdminSelectedDateStr] = useState<string>(todayStr);
  const [drawsSearchTerm, setDrawsSearchTerm] = useState<string>('');
  const [drawsViewMode, setDrawsViewMode] = useState<'grid' | 'table'>('table');
  const [drawsFilterStatus, setDrawsFilterStatus] = useState<'all' | 'completed' | 'active' | 'upcoming'>('all');
  const [gameCategoryTab, setGameCategoryTab] = useState<'daily' | 'supercar'>('supercar');

  // Helper for admin target date string formatting
  const getAdminDateStr = () => {
    const [y, m, d] = (adminSelectedDateStr || todayStr).split('-').map(Number);
    return `${y}${String(m).padStart(2, '0')}${String(d).padStart(2, '0')}`;
  };

  // Edit Result Modal State
  const [editingSlotModal, setEditingSlotModal] = useState<number | null>(null);
  const [editWinningCar, setEditWinningCar] = useState<SuperCarColor>('red');
  const [editWinnerTicket, setEditWinnerTicket] = useState<string>('');
  const [editWinnerName, setEditWinnerName] = useState<string>('');
  const [editPrizeAmount, setEditPrizeAmount] = useState<string>('₹50,000');

  const openEditResultModal = (slotNum: number) => {
    soundFx.playClick();
    const timeLabel = getSlotTimeLabel(slotNum);
    const dateStr = getAdminDateStr();
    const issueId = `CAR-${dateStr}-${String(slotNum).padStart(2, '0')}`;
    const drawData = drawsMap[issueId];
    const currentWinner = drawData?.winningCar || config.manualSlotWinners?.[issueId] || config.manualSlotWinners?.[slotNum] || 'red';

    setEditingSlotModal(slotNum);
    setEditWinningCar(currentWinner);
    setEditWinnerTicket(drawData?.winnerTicket || `TCK-${Math.floor(100000 + Math.random() * 900000)}`);
    setEditWinnerName(drawData?.winnerName || `Winner (Slot #${slotNum})`);
    setEditPrizeAmount(drawData?.prizeText || (slotNum % 3 === 0 ? '₹1,00,00,000' : '₹50,000'));
  };

  const handleSaveEditResultModal = async () => {
    if (!editingSlotModal) return;
    soundFx.playWinFanfare();
    const slotNum = editingSlotModal;
    const timeLabel = getSlotTimeLabel(slotNum);
    const dateStr = getAdminDateStr();
    const [y, m, d] = (adminSelectedDateStr || todayStr).split('-').map(Number);
    const formattedDateLabel = new Date(y, m - 1, d).toLocaleDateString('en-IN');
    const issueId = `CAR-${dateStr}-${String(slotNum).padStart(2, '0')}`;

    const drawIssueDoc = {
      id: issueId,
      issueId,
      drawIndex: slotNum,
      drawTime: `${formattedDateLabel} ${timeLabel}`,
      winningCar: editWinningCar,
      status: 'completed',
      prizeMultiplier: config.carMultipliers?.[editWinningCar] || config.prizeMultiplier || 2.8,
      winnerTicket: editWinnerTicket.trim() || `TCK-${Math.floor(100000 + Math.random() * 900000)}`,
      winnerName: editWinnerName.trim() || `Winner (Slot #${slotNum})`,
      prizeText: editPrizeAmount.trim() || '₹50,000',
      createdAt: new Date().toISOString(),
      declaredAt: new Date().toISOString()
    };

    try {
      await setDoc(doc(db, 'supercar_draws', issueId), drawIssueDoc, { merge: true });

      // Save to config.manualSlotWinners for instant real-time sync
      const newManualWinners = { ...(config.manualSlotWinners || {}), [slotNum]: editWinningCar, [issueId]: editWinningCar };
      await onUpdateConfig({ manualSlotWinners: newManualWinners });

      // Settle tickets for this slot automatically
      const slotTickets = supercarTickets.filter(
        (t) => t.drawTime?.toString().includes(timeLabel) || t.drawTitle?.includes(timeLabel) || t.drawTitle?.includes(`Slot #${String(slotNum).padStart(2, '0')}`)
      );

      const multiplier = config.carMultipliers?.[editWinningCar] || config.prizeMultiplier || 2.8;
      for (const t of slotTickets) {
        if (t.status === 'active' || t.status === 'pending') {
          const userCarChoice = (t.selectedCar || t.selectedNumbers?.[0] as string || 'red').toLowerCase() as SuperCarColor;
          const isWin = userCarChoice === editWinningCar;
          const wonAmt = isWin ? Math.round((t.price || 0) * multiplier) : 0;
          await setDoc(doc(db, 'tickets', t.id), {
            status: isWin ? 'win' : 'loss',
            wonAmount: wonAmt,
            settledAt: new Date().toISOString()
          }, { merge: true });
        }
      }

      setStatusMessage({
        type: 'success',
        text: `Result saved for Slot #${slotNum} (${timeLabel}) -> ${editWinningCar.toUpperCase()} CAR! Syncing automatically to all user screens.`
      });
      setEditingSlotModal(null);
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: `Failed to save slot result: ${err.message}` });
    }
  };

  // Sub-Tab 3 (User Ticket Audit) State
  const [auditSelectedDateStr, setAuditSelectedDateStr] = useState<string>(todayStr);
  const [ticketSearchTerm, setTicketSearchTerm] = useState<string>('');
  const [ticketSlotFilter, setTicketSlotFilter] = useState<number | 'all'>('all');
  const [ticketStatusFilter, setTicketStatusFilter] = useState<'all' | 'active' | 'win' | 'loss'>('all');
  const [ticketCarFilter, setTicketCarFilter] = useState<'all' | SuperCarColor>('all');
  const [ticketPage, setTicketPage] = useState<number>(1);
  const [ticketPageSize, setTicketPageSize] = useState<number>(10);
  const [settlingTicketId, setSettlingTicketId] = useState<string | null>(null);

  // Real-time Firestore Listeners
  useEffect(() => {
    // 1. Listen to all supercar tickets
    const unsubTickets = onSnapshot(collection(db, 'tickets'), (snap) => {
      const fetched: PurchasedTicket[] = [];
      snap.forEach((docSnap) => {
        const data = docSnap.data() as PurchasedTicket;
        if (data.category === 'Three Super Car Draw' || data.drawTitle?.includes('Super Car')) {
          fetched.push({ ...data, id: docSnap.id });
        }
      });
      setTickets(sortChronologicalNewestFirst(fetched));
    }, (err) => console.warn('Supercar tickets listener notice:', err.message));

    // 2. Listen to supercar draws history
    const unsubDraws = onSnapshot(collection(db, 'supercar_draws'), (snap) => {
      const map: { [issueId: string]: any } = {};
      snap.forEach((docSnap) => {
        map[docSnap.id] = docSnap.data();
      });
      setDrawsMap(map);
    }, (err) => console.warn('Supercar draws listener notice:', err.message));

    // 3. Listen to users directory
    const unsubUsers = onSnapshot(collection(db, 'users'), (snap) => {
      const map: { [uid: string]: User } = {};
      snap.forEach((docSnap) => {
        map[docSnap.id] = { ...docSnap.data(), id: docSnap.id } as User;
      });
      setUsersMap(map);
    }, (err) => console.warn('Users listener notice:', err.message));

    return () => {
      unsubTickets();
      unsubDraws();
      unsubUsers();
    };
  }, []);

  // Filter tickets for Super Car
  const supercarTickets = tickets.filter(
    (t) => t.category === 'Three Super Car Draw' || t.drawTitle?.includes('Super Car')
  );

  // Format slot time helper (1 to 84 slots: 08:00 AM to 10:00 PM)
  const getSlotTimeLabel = (slotNum: number) => {
    const startMins = 8 * 60 + (slotNum - 1) * 10;
    const h = Math.floor(startMins / 60);
    const m = startMins % 60;
    const ampm = h >= 12 ? 'PM' : 'AM';
    const formattedH = h % 12 === 0 ? 12 : h % 12;
    return `${String(formattedH).padStart(2, '0')}:${String(m).padStart(2, '0')} ${ampm}`;
  };

  // Image Upload Handler
  const handleFileUpload = async (carKey: SuperCarColor, file: File) => {
    setStatusMessage(null);
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
    if (!allowedTypes.includes(file.type.toLowerCase())) {
      setStatusMessage({ type: 'error', text: 'Invalid image format! Please upload JPG, PNG, or WebP.' });
      return;
    }

    if (file.size > 15 * 1024 * 1024) {
      setStatusMessage({ type: 'error', text: 'File size exceeds 15MB! Please select a smaller image.' });
      return;
    }

    setUploadingCar(carKey);
    setUploadProgress(20);

    try {
      const compressedBlob = await compressImage(file, 800, 0.75);
      setUploadProgress(50);

      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target?.result as string);
        reader.onerror = (e) => reject(e);
        reader.readAsDataURL(compressedBlob);
      });

      setUploadProgress(75);
      const updatedCarImages = { ...(config.carImages || {}), [carKey]: dataUrl };
      await onUpdateConfig({ carImages: updatedCarImages });

      setUploadProgress(100);
      try { soundFx.playWinFanfare(); } catch (_) {}
      setStatusMessage({
        type: 'success',
        text: `Successfully uploaded & updated ${carKey.toUpperCase()} supercar image! Syncing to user UI in real-time.`
      });

      // Background storage upload
      (async () => {
        try {
          const storagePath = `supercar_images/${carKey}_${Date.now()}.webp`;
          const storageRef = ref(storage, storagePath);
          const uploadTask = uploadBytesResumable(storageRef, compressedBlob);

          const storageUrl = await Promise.race<string | null>([
            new Promise<string | null>((resolve) => {
              uploadTask.on(
                'state_changed',
                null,
                () => resolve(null),
                async () => {
                  try {
                    const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
                    resolve(downloadURL);
                  } catch { resolve(null); }
                }
              );
            }),
            new Promise<null>((resolve) => setTimeout(() => resolve(null), 3000))
          ]);

          if (storageUrl) {
            await onUpdateConfig({ carImages: { ...(config.carImages || {}), [carKey]: storageUrl } });
          }
        } catch (_) {}
      })();
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: `Upload failed: ${err.message || 'Unknown error'}` });
    } finally {
      setUploadingCar(null);
      setUploadProgress(0);
    }
  };

  const compressImage = (file: File, maxWidth: number, quality: number): Promise<Blob> => {
    return new Promise((resolve) => {
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
          if (!ctx) { resolve(file); return; }
          ctx.drawImage(img, 0, 0, width, height);
          canvas.toBlob((blob) => resolve(blob || file), 'image/webp', quality);
        };
        img.onerror = () => resolve(file);
        img.src = e.target?.result as string;
      };
      reader.onerror = () => resolve(file);
      reader.readAsDataURL(file);
    });
  };

  const handleRemoveImage = async (carKey: SuperCarColor) => {
    soundFx.playClick();
    const newCarImages = { ...config.carImages };
    delete newCarImages[carKey];
    await onUpdateConfig({ carImages: newCarImages });
    setStatusMessage({ type: 'success', text: `Reset ${carKey.toUpperCase()} car image to default.` });
  };

  // Publish Winner for a Daily Slot
  const handlePublishSlotWinner = async (slotNum: number, winningCar: SuperCarColor) => {
    soundFx.playWinFanfare();
    const timeLabel = getSlotTimeLabel(slotNum);
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const dateStr = `${year}${month}${day}`;
    const issueId = `CAR-${dateStr}-${String(slotNum).padStart(2, '0')}`;

    const drawIssueDoc = {
      id: issueId,
      issueId,
      drawIndex: slotNum,
      drawTime: `${now.toLocaleDateString('en-IN')} ${timeLabel}`,
      winningCar,
      status: 'completed',
      prizeMultiplier: config.carMultipliers?.[winningCar] || config.prizeMultiplier || 2.8,
      declaredAt: new Date().toISOString()
    };

    try {
      await setDoc(doc(db, 'supercar_draws', issueId), drawIssueDoc, { merge: true });

      // Settle tickets for this slot automatically
      const multiplier = config.carMultipliers?.[winningCar] || config.prizeMultiplier || 2.8;
      const slotTickets = supercarTickets.filter((t) => {
        return t.drawTime?.toString().includes(timeLabel) || t.drawTitle?.includes(timeLabel) || t.drawTitle?.includes(`Slot #${String(slotNum).padStart(2, '0')}`);
      });

      for (const t of slotTickets) {
        const choice = (t.selectedCar || t.selectedNumbers?.[0] as string || '').toLowerCase();
        const isWinner = choice === winningCar;
        const payout = isWinner ? Math.round((t.price || 100) * multiplier) : 0;

        await setDoc(doc(db, 'tickets', t.id), {
          status: isWinner ? 'win' : 'loss',
          wonAmount: payout,
          settledAt: new Date().toISOString()
        }, { merge: true });

        if (isWinner && payout > 0) {
          const userDocRef = doc(db, 'users', t.userId);
          const uSnap = await getDoc(userDocRef);
          if (uSnap.exists()) {
            const uData = uSnap.data();
            const newBal = (uData.balance || 0) + payout;
            const newWon = (uData.totalWon || 0) + payout;
            await setDoc(userDocRef, { balance: newBal, totalWon: newWon }, { merge: true });

            // Log Transaction
            const txId = `TXN-WIN-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
            await setDoc(doc(db, 'transactions', txId), {
              id: txId,
              userId: t.userId,
              type: 'win',
              amount: payout,
              description: `3 Super Car Draw Win Payout: Slot #${slotNum} (${winningCar.toUpperCase()} CAR)`,
              date: new Date().toLocaleString()
            }, { merge: true });
          }
        }
      }

      const updatedSlotWinners = { ...(config.manualSlotWinners || {}), [slotNum]: winningCar };
      await onUpdateConfig({ manualSlotWinners: updatedSlotWinners });

      setStatusMessage({
        type: 'success',
        text: `🏆 Slot #${String(slotNum).padStart(2, '0')} (${winningCar.toUpperCase()} CAR) published! Settled ${slotTickets.length} tickets with real-time wallet credits.`
      });
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: `Failed to publish result: ${err.message}` });
    }
  };

  // Manual Win/Loss Settlement Control for Individual Tickets
  const handleManualSettleTicket = async (ticket: PurchasedTicket, targetStatus: 'win' | 'loss' | 'active') => {
    setSettlingTicketId(ticket.id);
    try {
      const carChoice = (ticket.selectedCar || ticket.selectedNumbers?.[0] as string || 'red').toLowerCase() as SuperCarColor;
      const multiplier = config.carMultipliers?.[carChoice] || config.prizeMultiplier || 2.8;
      const payoutAmount = targetStatus === 'win' ? Math.round((ticket.price || 100) * multiplier) : 0;

      await setDoc(doc(db, 'tickets', ticket.id), {
        status: targetStatus,
        wonAmount: payoutAmount,
        updatedByAdminAt: new Date().toISOString()
      }, { merge: true });

      if (targetStatus === 'win' && payoutAmount > 0) {
        soundFx.playWinFanfare();
        const userRef = doc(db, 'users', ticket.userId);
        const uSnap = await getDoc(userRef);
        if (uSnap.exists()) {
          const uData = uSnap.data();
          const currentBal = uData.balance || 0;
          const currentWon = uData.totalWon || 0;
          await setDoc(userRef, {
            balance: currentBal + payoutAmount,
            totalWon: currentWon + payoutAmount
          }, { merge: true });

          const txId = `TXN-MANUAL-WIN-${Date.now()}`;
          await setDoc(doc(db, 'transactions', txId), {
            id: txId,
            userId: ticket.userId,
            type: 'win',
            amount: payoutAmount,
            description: `Admin Manual Win Payout: Ticket #${ticket.ticketNumber || ticket.id} (${carChoice.toUpperCase()} CAR)`,
            date: new Date().toLocaleString()
          }, { merge: true });
        }
        setStatusMessage({ type: 'success', text: `✓ Ticket #${ticket.ticketNumber || ticket.id} set to WIN! Credited ₹${payoutAmount.toLocaleString('en-IN')} to player balance.` });
      } else if (targetStatus === 'loss') {
        soundFx.playClick();
        const txId = `TXN-MANUAL-LOSS-${Date.now()}`;
        await setDoc(doc(db, 'transactions', txId), {
          id: txId,
          userId: ticket.userId,
          type: 'ticket_loss',
          amount: 0,
          description: `❌ Admin Marked Loss: Ticket #${ticket.ticketNumber || ticket.id} (${carChoice.toUpperCase()} CAR)`,
          status: 'completed',
          date: new Date().toLocaleString('en-IN'),
          createdAt: new Date().toISOString()
        }, { merge: true });
        setStatusMessage({ type: 'success', text: `⊘ Ticket #${ticket.ticketNumber || ticket.id} set to LOSS & recorded in transactions ledger.` });
      } else {
        soundFx.playClick();
        setStatusMessage({ type: 'success', text: `↺ Ticket #${ticket.ticketNumber || ticket.id} reset to ACTIVE.` });
      }
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: `Failed to update ticket: ${err.message}` });
    } finally {
      setSettlingTicketId(null);
    }
  };

  // Manual Win/Loss Settlement Control for Batch of Tickets
  const handleManualSettleBatch = async (batch: GroupedTicketBatch, targetStatus: 'win' | 'loss' | 'active') => {
    setSettlingTicketId(batch.groupKey);
    try {
      const carChoice = (batch.selectedCar || 'red').toLowerCase() as SuperCarColor;
      const multiplier = config.carMultipliers?.[carChoice] || config.prizeMultiplier || 2.8;

      let totalPayoutForBatch = 0;

      for (const t of batch.tickets) {
        const payout = targetStatus === 'win' ? Math.round((t.price || 100) * multiplier) : 0;
        totalPayoutForBatch += payout;

        await setDoc(doc(db, 'tickets', t.id), {
          status: targetStatus,
          wonAmount: payout,
          updatedByAdminAt: new Date().toISOString()
        }, { merge: true });
      }

      if (targetStatus === 'win' && totalPayoutForBatch > 0) {
        soundFx.playWinFanfare();
        const userRef = doc(db, 'users', batch.userId);
        const uSnap = await getDoc(userRef);
        if (uSnap.exists()) {
          const uData = uSnap.data();
          const currentBal = uData.balance || 0;
          const currentWon = uData.totalWon || 0;
          await setDoc(userRef, {
            balance: currentBal + totalPayoutForBatch,
            totalWon: currentWon + totalPayoutForBatch
          }, { merge: true });

          const txId = `TXN-MANUAL-WIN-${Date.now()}`;
          await setDoc(doc(db, 'transactions', txId), {
            id: txId,
            userId: batch.userId,
            type: 'win',
            amount: totalPayoutForBatch,
            description: `Admin Manual Win Payout: ${batch.quantity}x Tickets (${carChoice.toUpperCase()} CAR)`,
            date: new Date().toLocaleString()
          }, { merge: true });
        }
        setStatusMessage({ type: 'success', text: `✓ Batch of ${batch.quantity} tickets set to WIN! Credited ₹${totalPayoutForBatch.toLocaleString('en-IN')} to player balance.` });
      } else if (targetStatus === 'loss') {
        soundFx.playClick();
        const txId = `TXN-MANUAL-LOSS-${Date.now()}`;
        await setDoc(doc(db, 'transactions', txId), {
          id: txId,
          userId: batch.userId,
          type: 'ticket_loss',
          amount: 0,
          description: `❌ Admin Marked Loss: ${batch.quantity}x Tickets (${carChoice.toUpperCase()} CAR)`,
          status: 'completed',
          date: new Date().toLocaleString('en-IN'),
          createdAt: new Date().toISOString()
        }, { merge: true });
        setStatusMessage({ type: 'success', text: `⊘ Batch of ${batch.quantity} tickets set to LOSS.` });
      } else {
        soundFx.playClick();
        setStatusMessage({ type: 'success', text: `↺ Batch of ${batch.quantity} tickets reset to ACTIVE.` });
      }
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: `Failed to update ticket batch: ${err.message}` });
    } finally {
      setSettlingTicketId(null);
    }
  };

  // Helper to check if a ticket belongs to a specific calendar date
  const isTicketOnDate = (t: PurchasedTicket & Record<string, any>, targetDateStr: string) => {
    if (!t || !targetDateStr) return false;

    const [y, m, d] = targetDateStr.split('-').map(Number);
    if (!y || !m || !d) return false;

    const targetDash = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const targetCompact = `${y}${String(m).padStart(2, '0')}${String(d).padStart(2, '0')}`;
    const targetSlash1 = `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`;
    const targetSlash2 = `${d}/${m}/${y}`;

    // 1. Direct equality on string fields
    if (t.purchaseDate === targetDash || t.drawDate === targetDash) return true;
    if (t.purchaseDate === targetSlash1 || t.drawDate === targetSlash1) return true;

    // 2. Check createdAt ISO timestamp or Date object
    const rawTimestamp = t.createdAt || t.purchaseDate || t.drawDate;
    if (rawTimestamp) {
      if (typeof rawTimestamp === 'string' && rawTimestamp.startsWith(targetDash)) return true;
      const parsedDate = new Date(rawTimestamp);
      if (!isNaN(parsedDate.getTime())) {
        const pY = parsedDate.getFullYear();
        const pM = String(parsedDate.getMonth() + 1).padStart(2, '0');
        const pD = String(parsedDate.getDate()).padStart(2, '0');
        if (`${pY}-${pM}-${pD}` === targetDash) return true;
      }
    }

    // 3. Check drawId / ticketNumber / id for compact date string
    const idStr = String(t.drawId || t.ticketNumber || t.id || '');
    if (idStr.includes(targetCompact) || idStr.includes(targetDash)) return true;

    // 4. Check drawTime / purchaseDate text
    const timeStr = String(t.drawTime || t.purchaseDate || t.drawDate || '');
    if (timeStr.includes(targetDash) || timeStr.includes(targetSlash1) || timeStr.includes(targetSlash2) || timeStr.includes(targetCompact)) {
      return true;
    }

    return false;
  };

  // Filtered tickets for Monitor by Date & Slot
  const monitorDateFilteredTickets = supercarTickets.filter((t) => isTicketOnDate(t, monitorSelectedDateStr));

  const monitorFilteredTickets = monitorDateFilteredTickets.filter((t) => {
    if (selectedMonitorSlot === 'all') return true;
    const timeLabel = getSlotTimeLabel(selectedMonitorSlot as number);
    return t.drawTime?.toString().includes(timeLabel) || t.drawTitle?.includes(timeLabel) || t.drawTitle?.includes(`Slot #${String(selectedMonitorSlot).padStart(2, '0')}`);
  });

  const monitorRedTickets = monitorFilteredTickets.filter((t) => (t.selectedCar || t.selectedNumbers?.[0]) === 'red');
  const monitorBlackTickets = monitorFilteredTickets.filter((t) => (t.selectedCar || t.selectedNumbers?.[0]) === 'black');
  const monitorYellowTickets = monitorFilteredTickets.filter((t) => (t.selectedCar || t.selectedNumbers?.[0]) === 'yellow');

  const monitorRedVol = monitorRedTickets.reduce((sum, t) => sum + (t.price || 0), 0);
  const monitorBlackVol = monitorBlackTickets.reduce((sum, t) => sum + (t.price || 0), 0);
  const monitorYellowVol = monitorYellowTickets.reduce((sum, t) => sum + (t.price || 0), 0);
  const monitorTotalRev = monitorRedVol + monitorBlackVol + monitorYellowVol;
  const monitorTotalCount = monitorFilteredTickets.length;

  // Determine Leader
  let leaderColor = 'RED CAR';
  let leadingShare = '0%';
  if (monitorTotalCount > 0) {
    if (monitorRedTickets.length >= monitorBlackTickets.length && monitorRedTickets.length >= monitorYellowTickets.length) {
      leaderColor = 'RED CAR';
      leadingShare = `${Math.round((monitorRedTickets.length / monitorTotalCount) * 100)}%`;
    } else if (monitorBlackTickets.length >= monitorRedTickets.length && monitorBlackTickets.length >= monitorYellowTickets.length) {
      leaderColor = 'BLACK CAR';
      leadingShare = `${Math.round((monitorBlackTickets.length / monitorTotalCount) * 100)}%`;
    } else {
      leaderColor = 'YELLOW CAR';
      leadingShare = `${Math.round((monitorYellowTickets.length / monitorTotalCount) * 100)}%`;
    }
  }

  // Recharts Data Format
  const rechartsData = [
    { name: 'RED CAR', tickets: monitorRedTickets.length, revenue: monitorRedVol, price: config.carPrices?.red || config.ticketPrice || 100, fill: '#f43f5e' },
    { name: 'BLACK CAR', tickets: monitorBlackTickets.length, revenue: monitorBlackVol, price: config.carPrices?.black || config.ticketPrice || 100, fill: '#f59e0b' },
    { name: 'YELLOW CAR', tickets: monitorYellowTickets.length, revenue: monitorYellowVol, price: config.carPrices?.yellow || config.ticketPrice || 100, fill: '#eab308' }
  ];

  // Audit Tab Filtered Tickets
  const auditFilteredTickets = supercarTickets
    .filter((t) => {
      // 1. Date Filter (Default: todayStr)
      if (auditSelectedDateStr && auditSelectedDateStr !== 'all') {
        if (!isTicketOnDate(t, auditSelectedDateStr)) return false;
      }

      // 2. Slot Filter
      if (ticketSlotFilter !== 'all') {
        const timeLabel = getSlotTimeLabel(ticketSlotFilter as number);
        const matchesSlot = t.drawTime?.toString().includes(timeLabel) || t.drawTitle?.includes(timeLabel) || t.drawTitle?.includes(`Slot #${String(ticketSlotFilter).padStart(2, '0')}`);
        if (!matchesSlot) return false;
      }

      // 3. Status Filter
      if (ticketStatusFilter !== 'all') {
        if (ticketStatusFilter === 'active' && t.status !== 'active' && t.status !== 'pending') return false;
        if (ticketStatusFilter === 'win' && t.status !== 'win') return false;
        if (ticketStatusFilter === 'loss' && t.status !== 'loss') return false;
      }

      // 4. Car Filter
      if (ticketCarFilter !== 'all') {
        const carChoice = (t.selectedCar || t.selectedNumbers?.[0] as string || '').toLowerCase();
        if (carChoice !== ticketCarFilter) return false;
      }

      // 5. Search Bar (User Name, Phone, Ticket #, User ID)
      if (ticketSearchTerm.trim()) {
        const term = ticketSearchTerm.toLowerCase();
        const uObj = usersMap[t.userId];
        const name = (t as any).userName?.toLowerCase() || uObj?.name?.toLowerCase() || '';
        const phone = (t as any).userPhone || uObj?.phone || '';
        const tNum = (t.ticketNumber || t.id).toLowerCase();
        const uId = t.userId.toLowerCase();
        return name.includes(term) || phone.includes(term) || tNum.includes(term) || uId.includes(term);
      }

      return true;
    })
    .sort((a, b) => {
      // RECENT TICKETS ALWAYS AT THE TOP (Descending by creation timestamp / ID)
      const getTime = (ticket: PurchasedTicket & Record<string, any>) => {
        if (ticket.createdAt) {
          const parsed = new Date(ticket.createdAt).getTime();
          if (!isNaN(parsed) && parsed > 0) return parsed;
        }
        if (ticket.purchaseDate) {
          const parsed = new Date(ticket.purchaseDate).getTime();
          if (!isNaN(parsed) && parsed > 0) return parsed;
        }
        const numMatch = ticket.id?.match(/\d+/g);
        if (numMatch && numMatch.length > 0) return parseInt(numMatch.join(''), 10);
        return 0;
      };
      return getTime(b) - getTime(a);
    });

  const totalAutoWonAmt = supercarTickets.filter((t) => t.status === 'win').reduce((sum, t) => sum + (t.wonAmount || 0), 0);
  const totalAutoWonCount = supercarTickets.filter((t) => t.status === 'win').length;
  const totalAutoLostCount = supercarTickets.filter((t) => t.status === 'loss').length;
  const totalPendingCount = supercarTickets.filter((t) => t.status === 'active' || t.status === 'pending').length;

  const carsList: SuperCarColor[] = ['red', 'black', 'yellow'];

  return (
    <div className="space-y-6 font-mono">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 bg-gradient-to-r from-slate-900 via-amber-950/60 to-slate-950 rounded-3xl border border-amber-500/30 shadow-2xl">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-gradient-to-br from-amber-500 to-yellow-600 text-slate-950 font-black shadow-lg shadow-amber-500/20">
            <Sparkles className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-black text-white">3 Super Car Admin Control Hub</h2>
              <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2.5 py-0.5 rounded-full font-bold uppercase animate-pulse">
                REALTIME FIREBASE
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Live Sales Recharts Monitor • 84 Daily Slot Winner Reveals • User Ticket Payout Audit • HD Image Uploads
            </p>
          </div>
        </div>

        {/* Global Game Toggle */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              soundFx.playClick();
              onUpdateConfig({ enabled: !config.enabled });
            }}
            className={`px-4 py-2.5 rounded-2xl text-xs font-black transition-all cursor-pointer shadow-lg ${
              config.enabled
                ? 'bg-emerald-500 text-slate-950 shadow-emerald-500/20 hover:bg-emerald-400'
                : 'bg-rose-950 border border-rose-500/50 text-rose-300 hover:bg-rose-900'
            }`}
          >
            {config.enabled ? '🟢 GAME ACTIVE (PLAYERS CAN BET)' : '🔴 GAME DISABLED (LOCKED)'}
          </button>
        </div>
      </div>

      {/* Top Navigation Sub-Tabs */}
      <div className="flex items-center gap-2 bg-slate-950 p-1.5 rounded-2xl border border-slate-800 overflow-x-auto">
        {[
          { id: 'monitor', label: '📊 Live Sales Monitor (Recharts)', icon: TrendingUp },
          { id: 'draws', label: '🏆 Daily Draw Results (84 Slots)', icon: Lock },
          { id: 'tickets', label: '👤 User Ticket Audit & Settlement', icon: Users },
          { id: 'images', label: '⚙️ HD Car Images & Pricing Config', icon: ImageIcon }
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeSubTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => { soundFx.playClick(); setActiveSubTab(tab.id as any); }}
              className={`py-2.5 px-4 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-2 shrink-0 ${
                isActive
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20 font-black'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Status Notification Banner */}
      {statusMessage && (
        <div className={`p-3.5 rounded-2xl border text-xs flex items-center gap-2.5 shadow-lg animate-in fade-in duration-200 ${
          statusMessage.type === 'success'
            ? 'bg-emerald-950/90 border-emerald-500/50 text-emerald-300'
            : 'bg-rose-950/90 border-rose-500/50 text-rose-300'
        }`}>
          {statusMessage.type === 'success' ? <CheckCircle className="w-4 h-4 shrink-0 text-emerald-400" /> : <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />}
          <span className="font-bold">{statusMessage.text}</span>
        </div>
      )}

      {/* =========================================================
          SUB-TAB 1: 3 SUPER CAR LIVE SALES MONITOR (RECHARTS)
         ========================================================= */}
      {activeSubTab === 'monitor' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          
          {/* CALENDAR DATE & SLOT FILTER CONTROL BAR */}
          <div className="p-4 bg-slate-900 border border-amber-500/30 rounded-3xl space-y-3 shadow-xl">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
                  <Calendar className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-black text-white block">Filter Ticket Sales by Date</span>
                    <span className="bg-rose-500/20 text-rose-300 text-[10px] font-black px-2.5 py-0.5 rounded-full border border-rose-500/30 uppercase">
                      🔥 LEADER: {leaderColor}
                    </span>
                  </div>
                  <span className="text-xs text-amber-400 font-bold">
                    Selected Date: {monitorSelectedDateStr} ({monitorDateFilteredTickets.length} Sales on this date)
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                <button
                  type="button"
                  onClick={() => {
                    soundFx.playClick();
                    setMonitorSelectedDateStr(todayStr);
                  }}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    monitorSelectedDateStr === todayStr
                      ? 'bg-amber-500 text-slate-950 font-black shadow-md shadow-amber-500/20'
                      : 'bg-slate-950 text-slate-300 hover:text-white border border-slate-800'
                  }`}
                >
                  Today Only
                </button>

                <button
                  type="button"
                  onClick={() => {
                    soundFx.playClick();
                    const yesterday = new Date();
                    yesterday.setDate(yesterday.getDate() - 1);
                    const yStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;
                    setMonitorSelectedDateStr(yStr);
                  }}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    monitorSelectedDateStr !== todayStr && monitorSelectedDateStr === `${new Date(Date.now() - 86400000).getFullYear()}-${String(new Date(Date.now() - 86400000).getMonth() + 1).padStart(2, '0')}-${String(new Date(Date.now() - 86400000).getDate()).padStart(2, '0')}`
                      ? 'bg-amber-500 text-slate-950 font-black shadow-md shadow-amber-500/20'
                      : 'bg-slate-950 text-slate-300 hover:text-white border border-slate-800'
                  }`}
                >
                  Yesterday
                </button>

                <input
                  type="date"
                  value={monitorSelectedDateStr}
                  onChange={(e) => {
                    if (e.target.value) {
                      soundFx.playClick();
                      setMonitorSelectedDateStr(e.target.value);
                    }
                  }}
                  className="bg-slate-950 border border-amber-500/40 text-amber-300 font-black text-xs rounded-xl px-3 py-2 outline-none cursor-pointer"
                />

                <select
                  value={selectedMonitorSlot}
                  onChange={(e) => setSelectedMonitorSlot(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                  className="bg-slate-950 border border-slate-700 text-amber-300 font-black text-xs rounded-xl px-3 py-2 outline-none cursor-pointer"
                >
                  <option value="all">All 84 Daily Slots (10-Min)</option>
                  {Array.from({ length: 84 }, (_, i) => {
                    const sNum = i + 1;
                    return (
                      <option key={sNum} value={sNum}>
                        Slot #{String(sNum).padStart(2, '0')} ({getSlotTimeLabel(sNum)})
                      </option>
                    );
                  })}
                </select>
              </div>
            </div>
          </div>

          {/* 4 Metric KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 bg-slate-900 rounded-3xl border border-slate-800">
              <span className="text-[10px] text-slate-400 uppercase font-black block">SLOT WINDOW</span>
              <span className="text-lg font-black text-white block mt-1">
                {selectedMonitorSlot === 'all' ? '08:00 AM - 10:00 PM' : getSlotTimeLabel(selectedMonitorSlot as number)}
              </span>
              <span className="text-[10px] text-amber-400 block mt-0.5">
                {selectedMonitorSlot === 'all' ? '84 Daily Slots' : `Slot #${String(selectedMonitorSlot).padStart(2, '0')}`}
              </span>
            </div>

            <div className="p-4 bg-slate-900 rounded-3xl border border-slate-800">
              <span className="text-[10px] text-slate-400 uppercase font-black block">TOTAL TICKETS SOLD</span>
              <span className="text-xl font-black text-white block mt-1">{monitorTotalCount} Tickets</span>
              <span className="text-[10px] text-slate-400 block mt-0.5">Live Firestore Feed</span>
            </div>

            <div className="p-4 bg-slate-900 rounded-3xl border border-emerald-900/40">
              <span className="text-[10px] text-emerald-400 uppercase font-black block">TOTAL REVENUE</span>
              <span className="text-xl font-black text-emerald-300 block mt-1">₹{monitorTotalRev.toLocaleString('en-IN')}</span>
              <span className="text-[10px] text-slate-400 block mt-0.5">Gross Sales Volume</span>
            </div>

            <div className="p-4 bg-gradient-to-br from-slate-900 to-amber-950/40 rounded-3xl border border-amber-500/40">
              <span className="text-[10px] text-amber-400 uppercase font-black block">LEADING SHARE</span>
              <span className="text-xl font-black text-amber-300 block mt-1">{leadingShare}</span>
              <span className="text-[10px] text-slate-400 block mt-0.5">Held by {leaderColor}</span>
            </div>
          </div>

          {/* Recharts Bar Chart Container */}
          <div className="p-6 bg-slate-900 border border-slate-800 rounded-3xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h4 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
                <BarChart2 className="w-4 h-4 text-amber-400" />
                <span>REAL-TIME TICKET DISTRIBUTION BAR CHART (RECHARTS)</span>
              </h4>
              <span className="text-[10px] bg-amber-500/10 text-amber-400 px-2.5 py-0.5 rounded border border-amber-500/20 uppercase font-bold">
                {selectedMonitorSlot === 'all' ? 'ALL SLOTS ACTIVE' : `SLOT #${selectedMonitorSlot} ACTIVE`}
              </span>
            </div>

            {/* Recharts Component */}
            <div className="h-64 w-full pt-2">
              <ResponsiveContainer key={`recharts-resp-${monitorFilteredTickets.length}-${monitorTotalRev}`} width="100%" height="100%">
                <BarChart data={rechartsData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                  <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} tickLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="bg-slate-950 border border-amber-500/40 p-3 rounded-xl shadow-2xl font-mono text-xs">
                            <p className="font-black text-amber-400 uppercase">{data.name}</p>
                            <p className="text-white mt-1">Tickets Sold: <strong className="text-amber-300">{data.tickets}</strong> ({monitorTotalCount > 0 ? Math.round((data.tickets / monitorTotalCount) * 100) : 0}%)</p>
                            <p className="text-white">Revenue: <strong className="text-emerald-400">₹{data.revenue.toLocaleString('en-IN')}</strong></p>
                            <p className="text-slate-400 text-[10px]">Price per ticket: ₹{data.price}</p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar dataKey="tickets" radius={[8, 8, 0, 0]}>
                    {rechartsData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Color Breakdown Sub-Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
              <div className="p-3.5 bg-slate-950 rounded-2xl border border-rose-500/30">
                <span className="text-xs font-black text-rose-400 uppercase">Red Supercar</span>
                <div className="text-lg font-black text-white mt-1">{monitorRedTickets.length} Tickets</div>
                <div className="text-xs text-emerald-400 font-bold">₹{monitorRedVol.toLocaleString('en-IN')}</div>
              </div>

              <div className="p-3.5 bg-slate-950 rounded-2xl border border-amber-500/30">
                <span className="text-xs font-black text-amber-400 uppercase">Black Supercar</span>
                <div className="text-lg font-black text-white mt-1">{monitorBlackTickets.length} Tickets</div>
                <div className="text-xs text-emerald-400 font-bold">₹{monitorBlackVol.toLocaleString('en-IN')}</div>
              </div>

              <div className="p-3.5 bg-slate-950 rounded-2xl border border-yellow-500/30">
                <span className="text-xs font-black text-yellow-400 uppercase">Yellow Supercar</span>
                <div className="text-lg font-black text-white mt-1">{monitorYellowTickets.length} Tickets</div>
                <div className="text-xs text-emerald-400 font-bold">₹{monitorYellowVol.toLocaleString('en-IN')}</div>
              </div>
            </div>

          </div>

        </div>
      )}

      {/* =========================================================
          SUB-TAB 2: 🏆 3 SUPER CAR DAILY DRAW RESULTS (84 SLOTS)
         ========================================================= */}
      {activeSubTab === 'draws' && (
        <div className="space-y-5 animate-in fade-in duration-200 font-mono">
          
          {/* 1. DRAW EXECUTION MODE CARD (Matching Screenshot 1) */}
          <div className="p-4 bg-slate-900 border border-slate-800 rounded-3xl space-y-3 shadow-xl">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs sm:text-sm font-black text-white">Draw Execution Mode:</span>
                  <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full border uppercase ${
                    (config.resultMode || 'auto') === 'auto'
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                      : 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40'
                  }`}>
                    {(config.resultMode || 'auto') === 'auto' ? '⚡ AUTOMATIC TIMELY 10-MIN' : '✋ MANUAL DRAW'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 font-sans mt-1">
                  Results automatically roll over and display on schedule every 10 minutes from 08:00 AM to 10:00 PM.
                </p>
              </div>

              <div className="flex items-center gap-2 bg-slate-950 p-1.5 rounded-2xl border border-slate-800 shrink-0">
                <button
                  onClick={() => {
                    soundFx.playClick();
                    onUpdateConfig({ resultMode: 'auto' });
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
                    (config.resultMode || 'auto') === 'auto'
                      ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Zap className="w-3.5 h-3.5 fill-current" />
                  <span>Automatic</span>
                </button>

                <button
                  onClick={() => {
                    soundFx.playClick();
                    onUpdateConfig({ resultMode: 'manual' });
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
                    config.resultMode === 'manual'
                      ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <span>✋ Manual</span>
                </button>
              </div>
            </div>
          </div>

          {/* 1.5 CALENDAR DATE SELECTOR CARD FOR ADMIN HISTORICAL LOOKUP & OVERRIDES */}
          <div className="p-3.5 bg-slate-900 border border-amber-500/30 rounded-3xl space-y-3 shadow-xl">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
                  <Calendar className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-xs font-bold text-white block">Find Results by Calendar Date</span>
                  <span className="text-[10px] text-amber-400 font-bold">
                    Selected Date: {adminSelectedDateStr}
                  </span>
                </div>
              </div>

              <span className="text-[10px] bg-amber-500/10 text-amber-300 px-2.5 py-1 rounded-xl border border-amber-500/20 font-bold hidden sm:inline-block">
                84 Slots (08:00 AM - 10:00 PM)
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  soundFx.playClick();
                  setAdminSelectedDateStr(todayStr);
                }}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  adminSelectedDateStr === todayStr
                    ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20 font-black'
                    : 'bg-slate-950 text-slate-300 hover:text-white border border-slate-800'
                }`}
              >
                Today
              </button>

              <button
                type="button"
                onClick={() => {
                  soundFx.playClick();
                  const d = new Date();
                  d.setDate(d.getDate() - 1);
                  const y = d.getFullYear();
                  const m = String(d.getMonth() + 1).padStart(2, '0');
                  const day = String(d.getDate()).padStart(2, '0');
                  setAdminSelectedDateStr(`${y}-${m}-${day}`);
                }}
                className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-slate-950 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 transition-all cursor-pointer"
              >
                Yesterday
              </button>

              <div className="relative flex-1 min-w-[140px]">
                <input
                  type="date"
                  value={adminSelectedDateStr}
                  onChange={(e) => {
                    soundFx.playClick();
                    setAdminSelectedDateStr(e.target.value);
                  }}
                  className="w-full bg-slate-950 border border-amber-500/40 text-amber-300 font-mono text-xs font-bold rounded-xl px-3 py-1.5 outline-none cursor-pointer focus:border-amber-400"
                />
              </div>
            </div>
          </div>

          {/* 2. GAME CATEGORY SWITCHER TABS (Matching Screenshot 1) */}
          <div className="grid grid-cols-2 gap-2 bg-slate-950 p-1.5 rounded-2xl border border-slate-800">
            <button
              onClick={() => {
                soundFx.playClick();
                setGameCategoryTab('daily');
              }}
              className={`py-2 px-3 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                gameCategoryTab === 'daily'
                  ? 'bg-slate-800 text-amber-300 border border-amber-500/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <span>🔥 1. Daily Win (84 Slots)</span>
            </button>
            <button
              onClick={() => {
                soundFx.playClick();
                setGameCategoryTab('supercar');
              }}
              className={`py-2 px-3 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                gameCategoryTab === 'supercar'
                  ? 'bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-950 shadow-md font-black'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <span>🏎️ 2. 3 Super Car VIP</span>
            </button>
          </div>

          {/* 3. FILTER PILLS (Matching Screenshot 1) */}
          <div className="grid grid-cols-4 gap-1.5 bg-slate-950 p-1.5 rounded-2xl border border-slate-800 text-center">
            {[
              { id: 'all', label: 'All Results' },
              { id: 'completed', label: 'Completed' },
              { id: 'active', label: 'Active Draw' },
              { id: 'upcoming', label: 'Upcoming' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => {
                  soundFx.playClick();
                  setDrawsFilterStatus(tab.id as any);
                }}
                className={`py-2 px-1 rounded-xl text-[11px] sm:text-xs font-bold transition-all cursor-pointer ${
                  drawsFilterStatus === tab.id
                    ? 'bg-amber-500 text-slate-950 shadow-md font-black'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* 4. SEARCH BAR & VIEW SWITCHER */}
          <div className="flex flex-col md:flex-row items-center justify-between gap-3 p-3 bg-slate-900 border border-slate-800 rounded-2xl">
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search slot # or number..."
                value={drawsSearchTerm}
                onChange={(e) => setDrawsSearchTerm(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 text-xs text-white rounded-xl pl-9 pr-3 py-2 outline-none focus:border-amber-500/50 font-mono placeholder:text-slate-500"
              />
            </div>

            <div className="flex items-center gap-2 shrink-0 w-full md:w-auto justify-end">
              <span className="text-[11px] text-slate-400 font-sans">View:</span>
              <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800">
                <button
                  onClick={() => setDrawsViewMode('table')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                    drawsViewMode === 'table' ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-white'
                  }`}
                  title="Table View"
                >
                  <TableIcon className="w-3.5 h-3.5" />
                  <span>Table</span>
                </button>
                <button
                  onClick={() => setDrawsViewMode('grid')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                    drawsViewMode === 'grid' ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-white'
                  }`}
                  title="Grid View"
                >
                  <Grid className="w-3.5 h-3.5" />
                  <span>Grid</span>
                </button>
              </div>
            </div>
          </div>

          {/* 5. DRAW RESULTS TABLE / GRID VIEW (Matching Screenshot 1 & 2) */}
          {drawsViewMode === 'table' ? (
            <div className="p-4 bg-slate-900 border border-slate-800 rounded-3xl overflow-x-auto shadow-2xl">
              <table className="w-full text-left text-xs font-mono">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 font-bold uppercase text-[10px] tracking-wider">
                    <th className="p-3">SLOT / DRAW #</th>
                    <th className="p-3">TIME / FREQUENCY</th>
                    <th className="p-3">STATUS</th>
                    <th className="p-3">WINNING SUPERCAR</th>
                    <th className="p-3 text-right">ACTION</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {Array.from({ length: 84 }, (_, i) => {
                    const slotNum = i + 1;
                    const timeLabel = getSlotTimeLabel(slotNum);
                    const dateStr = getAdminDateStr();
                    const issueId = `CAR-${dateStr}-${String(slotNum).padStart(2, '0')}`;
                    const drawData = drawsMap[issueId];

                    // Status determination relative to target date
                    const [y, m, d] = (adminSelectedDateStr || todayStr).split('-').map(Number);
                    const targetDateObj = new Date(y, m - 1, d);
                    const todayObj = new Date();
                    const isToday = targetDateObj.toDateString() === todayObj.toDateString();
                    const isPastDay = targetDateObj < new Date(todayObj.getFullYear(), todayObj.getMonth(), todayObj.getDate());

                    const startMins = 8 * 60 + i * 10;
                    const currentMins = todayObj.getHours() * 60 + todayObj.getMinutes();

                    let slotStatus: 'completed' | 'active' | 'upcoming' = 'upcoming';
                    if (isPastDay) {
                      slotStatus = 'completed';
                    } else if (isToday) {
                      if (currentMins >= startMins + 10) slotStatus = 'completed';
                      else if (currentMins >= startMins) slotStatus = 'active';
                    }

                    // Winning Car
                    const winningColor: SuperCarColor | undefined = drawData?.winningCar || config.manualSlotWinners?.[issueId] || config.manualSlotWinners?.[slotNum];
                    const isCompleted = slotStatus === 'completed' || Boolean(winningColor);

                    // Filter Status
                    if (drawsFilterStatus === 'completed' && !isCompleted) return null;
                    if (drawsFilterStatus === 'active' && slotStatus !== 'active') return null;
                    if (drawsFilterStatus === 'upcoming' && (isCompleted || slotStatus === 'active')) return null;

                    // Filter Search
                    if (drawsSearchTerm.trim()) {
                      const query = drawsSearchTerm.toLowerCase();
                      const matchSlot = `slot #${slotNum}`.includes(query) || String(slotNum).includes(query);
                      const matchTime = timeLabel.toLowerCase().includes(query);
                      const matchCar = winningColor ? winningColor.toLowerCase().includes(query) : false;
                      const matchTicket = drawData?.winnerTicket ? drawData.winnerTicket.toLowerCase().includes(query) : false;
                      if (!matchSlot && !matchTime && !matchCar && !matchTicket) return null;
                    }

                    const carInfo = winningColor ? getSuperCarInfo(winningColor, config) : null;

                    return (
                      <tr key={slotNum} className="hover:bg-slate-950/60 transition-colors">
                        {/* SLOT / DRAW # */}
                        <td className="p-3 font-black text-amber-400">
                          SLOT #{String(slotNum).padStart(2, '0')}
                        </td>

                        {/* TIME / FREQUENCY */}
                        <td className="p-3 font-bold text-white">
                          {timeLabel}
                        </td>

                        {/* STATUS */}
                        <td className="p-3">
                          <span className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-full border ${
                            isCompleted
                              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                              : slotStatus === 'active'
                              ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 animate-pulse'
                              : 'bg-slate-800 text-slate-400 border-slate-700'
                          }`}>
                            {isCompleted ? 'Completed' : slotStatus === 'active' ? 'Active' : 'Upcoming'}
                          </span>
                        </td>

                        {/* WINNING SUPERCAR */}
                        <td className="p-3">
                          {winningColor && carInfo ? (
                            <div className="flex items-center gap-2">
                              <img src={carInfo.image} alt={carInfo.name} className="w-10 h-7 object-cover rounded-lg border border-slate-700 shrink-0" />
                              <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-lg border ${
                                winningColor === 'red'
                                  ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                                  : winningColor === 'black'
                                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                                  : 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40'
                              }`}>
                                {winningColor === 'red' ? 'RED SUPERCAR LUXURY' : winningColor === 'black' ? 'BLACK CARBON EDITION' : 'YELLOW LIGHTNING SUPERCAR'}
                              </span>
                            </div>
                          ) : (
                            <span className="text-slate-500 text-[11px]">Awaiting Draw</span>
                          )}
                        </td>

                        {/* ACTION -> EDIT RESULT BUTTON */}
                        <td className="p-3 text-right">
                          <button
                            onClick={() => openEditResultModal(slotNum)}
                            className="px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-[11px] font-black rounded-xl transition-all cursor-pointer inline-flex items-center gap-1.5 shadow-md hover:scale-[1.02]"
                          >
                            <Edit className="w-3.5 h-3.5" />
                            <span>Edit Result</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            /* Grid View */
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {Array.from({ length: 84 }, (_, i) => {
                const slotNum = i + 1;
                const timeLabel = getSlotTimeLabel(slotNum);
                const dateStr = getAdminDateStr();
                const issueId = `CAR-${dateStr}-${String(slotNum).padStart(2, '0')}`;
                const drawData = drawsMap[issueId];

                const winningColor: SuperCarColor | undefined = drawData?.winningCar || config.manualSlotWinners?.[issueId] || config.manualSlotWinners?.[slotNum];
                const isCompleted = Boolean(winningColor) || drawData?.status === 'completed';
                const carInfo = winningColor ? getSuperCarInfo(winningColor, config) : null;

                if (drawsSearchTerm.trim()) {
                  const query = drawsSearchTerm.toLowerCase();
                  const matchSlot = `slot #${slotNum}`.includes(query) || String(slotNum).includes(query);
                  const matchTime = timeLabel.toLowerCase().includes(query);
                  if (!matchSlot && !matchTime) return null;
                }

                return (
                  <div key={slotNum} className="p-4 bg-slate-900 border border-slate-800 rounded-3xl space-y-3 shadow-xl hover:border-amber-500/40 transition-all flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black text-amber-400">Slot #{String(slotNum).padStart(2, '0')}</span>
                        <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full border ${
                          isCompleted ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                        }`}>
                          {isCompleted ? 'COMPLETED' : 'LIVE / OPEN'}
                        </span>
                      </div>

                      <div className="mt-2 space-y-0.5">
                        <span className="text-lg font-black text-white block">{timeLabel}</span>
                      </div>

                      <div className="mt-3 p-3 bg-slate-950 rounded-2xl border border-slate-800 text-center space-y-1">
                        <span className="text-[9px] text-slate-400 font-bold uppercase block">WINNING RESULT</span>
                        {winningColor && carInfo ? (
                          <div className="space-y-1">
                            <img src={carInfo.image} alt={carInfo.name} className="w-16 h-10 object-cover rounded-xl mx-auto border border-slate-700" />
                            <span className="text-xs font-black text-amber-300 block uppercase">{carInfo.name}</span>
                          </div>
                        ) : (
                          <span className="text-xs font-bold text-slate-500 block">PENDING DRAW</span>
                        )}
                      </div>
                    </div>

                    <button
                      onClick={() => openEditResultModal(slotNum)}
                      className="w-full py-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-black rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <Edit className="w-3.5 h-3.5" />
                      <span>Edit Result</span>
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* EDIT RESULT MODAL */}
          {editingSlotModal !== null && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm animate-fade-in font-mono">
              <div className="bg-slate-900 border border-amber-500/40 rounded-3xl p-5 max-w-md w-full space-y-4 shadow-2xl text-white">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div>
                    <h3 className="text-base font-black text-amber-400 flex items-center gap-2">
                      <Edit className="w-5 h-5" />
                      <span>Edit Result • Slot #{String(editingSlotModal).padStart(2, '0')}</span>
                    </h3>
                    <p className="text-xs text-slate-400 font-sans mt-0.5">
                      Time Window: {getSlotTimeLabel(editingSlotModal)} (10-Min Draw)
                    </p>
                  </div>
                  <button
                    onClick={() => setEditingSlotModal(null)}
                    className="p-1.5 rounded-full bg-slate-800 text-slate-400 hover:text-white cursor-pointer"
                  >
                    <XCircle className="w-5 h-5" />
                  </button>
                </div>

                {/* SELECT WINNING CAR */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-300 block">Select Winning Super Car:</label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: 'red', label: 'RED LUXURY' },
                      { id: 'black', label: 'BLACK STEALTH' },
                      { id: 'yellow', label: 'YELLOW LIGHTNING' }
                    ].map((car) => {
                      const carInfo = getSuperCarInfo(car.id as SuperCarColor, config);
                      const isSelected = editWinningCar === car.id;
                      return (
                        <button
                          key={car.id}
                          type="button"
                          onClick={() => setEditWinningCar(car.id as SuperCarColor)}
                          className={`p-2 rounded-2xl border text-center transition-all cursor-pointer flex flex-col items-center gap-1 ${
                            isSelected
                              ? 'bg-amber-500/20 border-amber-400 ring-2 ring-amber-400/50 scale-[1.02]'
                              : 'bg-slate-950 border-slate-800 opacity-70 hover:opacity-100'
                          }`}
                        >
                          <img src={carInfo.image} alt={carInfo.name} className="w-12 h-9 object-cover rounded-xl" />
                          <span className="text-[9px] font-black uppercase text-white">{car.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* WINNER DETAILS */}
                <div className="space-y-3 pt-2 border-t border-slate-800">
                  <div>
                    <label className="text-[11px] font-bold text-slate-400 block mb-1">Winner Ticket ID:</label>
                    <input
                      type="text"
                      value={editWinnerTicket}
                      onChange={(e) => setEditWinnerTicket(e.target.value)}
                      placeholder="e.g. TCK-100881"
                      className="w-full bg-slate-950 border border-slate-800 text-xs text-amber-300 font-mono font-bold rounded-xl px-3 py-2 outline-none focus:border-amber-500"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-400 block mb-1">Winner Display Name:</label>
                    <input
                      type="text"
                      value={editWinnerName}
                      onChange={(e) => setEditWinnerName(e.target.value)}
                      placeholder="e.g. Winner (Slot #1)"
                      className="w-full bg-slate-950 border border-slate-800 text-xs text-white font-bold rounded-xl px-3 py-2 outline-none focus:border-amber-500"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-400 block mb-1">Prize Amount / Display:</label>
                    <input
                      type="text"
                      value={editPrizeAmount}
                      onChange={(e) => setEditPrizeAmount(e.target.value)}
                      placeholder="e.g. ₹50,000"
                      className="w-full bg-slate-950 border border-slate-800 text-xs text-emerald-400 font-mono font-bold rounded-xl px-3 py-2 outline-none focus:border-amber-500"
                    />
                  </div>
                </div>

                {/* MODAL ACTION BUTTONS */}
                <div className="flex items-center gap-2 pt-3 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setEditingSlotModal(null)}
                    className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveEditResultModal}
                    className="flex-1 py-2.5 bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-950 font-black text-xs rounded-xl shadow-lg shadow-amber-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer"
                  >
                    Save & Publish Result
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>
      )}

      {/* =========================================================
          SUB-TAB 3: 👤 USER TICKET AUDIT & MANUAL WIN / LOSE
         ========================================================= */}
      {activeSubTab === 'tickets' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          
          {/* Header & Title */}
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 p-4 bg-slate-900 border border-slate-800 rounded-3xl">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black text-white flex items-center gap-2">
                  <Users className="w-5 h-5 text-amber-400" />
                  <span>User Ticket Purchase History & Manual Settlement</span>
                </h3>
                <span className="bg-amber-500/20 text-amber-300 text-[10px] font-black px-2.5 py-0.5 rounded-full border border-amber-500/30 uppercase">
                  👤 USER TICKET AUDIT & MANUAL WIN / LOSE
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">View all user ticket purchases, track winning auto-payouts, or manually force Win/Lose outcomes for individual user tickets.</p>
            </div>
          </div>

          {/* 4 Summary Badges */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 bg-slate-900 rounded-3xl border border-slate-800">
              <span className="text-[10px] text-slate-400 uppercase font-black block">TOTAL TICKETS SOLD</span>
              <span className="text-xl font-black text-white block mt-1">{supercarTickets.length} Tickets</span>
            </div>

            <div className="p-4 bg-slate-900 rounded-3xl border border-emerald-900/40">
              <span className="text-[10px] text-emerald-400 uppercase font-black block">🟢 AUTO-WON ({totalAutoWonCount})</span>
              <span className="text-xl font-black text-emerald-300 block mt-1">₹{totalAutoWonAmt.toLocaleString('en-IN')}</span>
            </div>

            <div className="p-4 bg-slate-900 rounded-3xl border border-rose-900/40">
              <span className="text-[10px] text-rose-400 uppercase font-black block">🔴 AUTO-LOST ({totalAutoLostCount})</span>
              <span className="text-xl font-black text-rose-300 block mt-1">₹0 (No Refund)</span>
            </div>

            <div className="p-4 bg-slate-900 rounded-3xl border border-amber-900/40">
              <span className="text-[10px] text-amber-400 uppercase font-black block">⌛ ACTIVE PENDING ({totalPendingCount})</span>
              <span className="text-xl font-black text-amber-300 block mt-1">
                ₹{supercarTickets.filter(t => t.status === 'active' || t.status === 'pending').reduce((sum, t) => sum + (t.price || 0), 0).toLocaleString('en-IN')}
              </span>
            </div>
          </div>

          {/* Automatic Settlement Engine Rule Banner */}
          <div className="p-3.5 bg-slate-950 border border-amber-500/30 rounded-2xl flex items-center gap-3 text-xs text-amber-300">
            <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0" />
            <span>
              <strong>⚡ AUTOMATIC WIN/LOSS SETTLEMENT ENGINE ACTIVE:</strong> If result matches player car choice -&gt; Auto Wallet Credit | If result differs -&gt; Loss Logged (No Refund)
            </span>
          </div>

          {/* Multi-Filters Bar with Calendar Date Selection */}
          <div className="p-4 bg-slate-900 border border-slate-800 rounded-3xl space-y-3">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-amber-400" />
                <span className="text-xs font-bold text-white">Date Filter:</span>
                <span className="text-xs font-black text-amber-300 bg-amber-500/10 border border-amber-500/20 px-2.5 py-0.5 rounded-full">
                  {auditSelectedDateStr === 'all' ? 'All Time History' : auditSelectedDateStr === todayStr ? `Today (${todayStr})` : auditSelectedDateStr}
                </span>
                <span className="text-[10px] text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                  ⚡ Recent Tickets First ({auditFilteredTickets.length})
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-1.5 w-full md:w-auto">
                <button
                  type="button"
                  onClick={() => {
                    try { soundFx.playClick(); } catch (_) {}
                    setAuditSelectedDateStr(todayStr);
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    auditSelectedDateStr === todayStr
                      ? 'bg-amber-500 text-slate-950 font-black shadow-md'
                      : 'bg-slate-950 text-slate-300 hover:text-white border border-slate-800'
                  }`}
                >
                  Today Only
                </button>

                <button
                  type="button"
                  onClick={() => {
                    try { soundFx.playClick(); } catch (_) {}
                    const yesterday = new Date();
                    yesterday.setDate(yesterday.getDate() - 1);
                    const yStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;
                    setAuditSelectedDateStr(yStr);
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    auditSelectedDateStr !== 'all' && auditSelectedDateStr !== todayStr
                      ? 'bg-amber-500 text-slate-950 font-black shadow-md'
                      : 'bg-slate-950 text-slate-300 hover:text-white border border-slate-800'
                  }`}
                >
                  Past Date
                </button>

                <button
                  type="button"
                  onClick={() => {
                    try { soundFx.playClick(); } catch (_) {}
                    setAuditSelectedDateStr('all');
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    auditSelectedDateStr === 'all'
                      ? 'bg-amber-500 text-slate-950 font-black shadow-md'
                      : 'bg-slate-950 text-slate-300 hover:text-white border border-slate-800'
                  }`}
                >
                  All Dates
                </button>

                <input
                  type="date"
                  value={auditSelectedDateStr === 'all' ? '' : auditSelectedDateStr}
                  onChange={(e) => {
                    if (e.target.value) {
                      try { soundFx.playClick(); } catch (_) {}
                      setAuditSelectedDateStr(e.target.value);
                    }
                  }}
                  className="bg-slate-950 border border-amber-500/40 text-amber-300 font-bold text-xs rounded-xl px-2.5 py-1.5 outline-none cursor-pointer"
                  title="Pick a custom date"
                />
              </div>
            </div>

            <div className="flex flex-col md:flex-row items-center justify-between gap-3">
              <div className="relative w-full md:flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search user name, phone, ticket # or UID..."
                  value={ticketSearchTerm}
                  onChange={(e) => setTicketSearchTerm(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 text-xs text-white rounded-xl pl-9 pr-3 py-2 outline-none focus:border-amber-500/50"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                <select
                  value={ticketSlotFilter}
                  onChange={(e) => setTicketSlotFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                  className="bg-slate-950 border border-slate-800 text-amber-300 font-bold text-xs rounded-xl px-2.5 py-2 outline-none cursor-pointer"
                >
                  <option value="all">All Slots (1 to 84)</option>
                  {Array.from({ length: 84 }, (_, i) => (
                    <option key={i + 1} value={i + 1}>Slot #{String(i + 1).padStart(2, '0')}</option>
                  ))}
                </select>

                <select
                  value={ticketStatusFilter}
                  onChange={(e) => setTicketStatusFilter(e.target.value as any)}
                  className="bg-slate-950 border border-slate-800 text-amber-300 font-bold text-xs rounded-xl px-2.5 py-2 outline-none cursor-pointer"
                >
                  <option value="all">All Statuses</option>
                  <option value="active">Active Pending</option>
                  <option value="win">Won Tickets</option>
                  <option value="loss">Lost Tickets</option>
                </select>

                <select
                  value={ticketCarFilter}
                  onChange={(e) => setTicketCarFilter(e.target.value as any)}
                  className="bg-slate-950 border border-slate-800 text-amber-300 font-bold text-xs rounded-xl px-2.5 py-2 outline-none cursor-pointer"
                >
                  <option value="all">All Car Types</option>
                  <option value="red">Red Only</option>
                  <option value="black">Black Only</option>
                  <option value="yellow">Yellow Only</option>
                </select>
              </div>
            </div>
          </div>

          {/* Interactive Tickets Table */}
          <div className="p-5 bg-slate-900 border border-slate-800 rounded-3xl space-y-4">
            {(() => {
              const groupedBatches = groupTicketsByBatch(auditFilteredTickets);
              if (groupedBatches.length === 0) {
                return (
                  <div className="p-8 text-center text-slate-500 text-xs font-bold">
                    No tickets match the selected filter criteria.
                  </div>
                );
              }

              const paginatedBatches = groupedBatches.slice((ticketPage - 1) * ticketPageSize, ticketPage * ticketPageSize);

              return (
                <>
                  <div className="space-y-3">
                    {paginatedBatches.map((batch) => {
                      const firstTicket = batch.firstTicket;
                      const uObj = usersMap[batch.userId];
                      const name = (firstTicket as any).userName || uObj?.name || 'BETGURU Player';
                      const phone = (firstTicket as any).userPhone || uObj?.phone || 'N/A';
                      const carChoice = (batch.selectedCar || 'red').toLowerCase() as SuperCarColor;
                      const carInfo = getSuperCarInfo(carChoice, config);
                      const isSettling = settlingTicketId === batch.groupKey;
                      const exactDateTimeStr = formatTicketExactDateTime(firstTicket);

                      return (
                        <div key={batch.groupKey} className="p-4 bg-slate-950 border border-slate-800 hover:border-amber-500/50 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xl transition-all font-mono">
                          
                          {/* Left Block: Car Photo + Ticket Info */}
                          <div className="flex items-start sm:items-center gap-3.5 flex-1 w-full">
                            
                            {/* Car Image Preview Thumbnail */}
                            <div className="relative w-24 h-16 sm:w-28 sm:h-20 rounded-xl overflow-hidden border-2 border-amber-500/40 shadow-md shrink-0 bg-slate-900 group">
                              <img
                                src={carInfo.image}
                                alt={carInfo.name}
                                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                              />
                              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent"></div>
                              <span className={`absolute bottom-0.5 left-0.5 text-[8px] font-black uppercase px-1.5 py-0.5 rounded ${
                                carChoice === 'red' ? 'bg-rose-500 text-white' : carChoice === 'black' ? 'bg-amber-500 text-slate-950' : 'bg-yellow-400 text-slate-950'
                              }`}>
                                {carChoice} CAR
                              </span>
                            </div>

                            {/* Ticket Text Details */}
                            <div className="space-y-1 flex-1 min-w-0">
                              
                              {/* Glowing Animated Purchase Time Badge - PROMINENT AT TOP */}
                              <div className="flex flex-wrap items-center gap-2 mb-1">
                                <div className="inline-flex items-center gap-1.5 bg-gradient-to-r from-amber-500/20 via-yellow-500/20 to-amber-500/20 border border-amber-400/80 px-2.5 py-0.5 rounded-full text-amber-300 font-black text-[11px] shadow-[0_0_12px_rgba(245,158,11,0.35)] animate-pulse">
                                  <Clock className="w-3 h-3 text-amber-400 animate-spin [animation-duration:3s]" />
                                  <span>TIME: {exactDateTimeStr}</span>
                                </div>
                                <span className="text-xs font-black text-amber-400 bg-amber-500/20 px-2 py-0.5 rounded-full border border-amber-500/40">
                                  {batch.quantity}x {batch.quantity === 1 ? 'Ticket' : 'Tickets Bulk'}
                                </span>
                              </div>

                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-xs font-bold text-white truncate">{batch.drawTitle || '3 Super Car Draw'}</span>
                              </div>

                              <p className="text-xs text-slate-300 truncate">
                                Player: <strong className="text-white">{name}</strong> ({phone})
                              </p>
                              
                              <p className="text-[10px] text-slate-400">
                                UID: <span className="text-amber-300 font-bold">{batch.userId}</span> • Total Price: <span className="text-emerald-400 font-extrabold text-xs">₹{batch.totalPrice.toLocaleString('en-IN')}</span> ({batch.quantity}x @ ₹{firstTicket.price || 100})
                              </p>
                            </div>
                          </div>

                          {/* Right Controls: Status & Win / Lose Buttons */}
                          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-between md:justify-end border-t md:border-t-0 pt-3 md:pt-0 border-slate-800 shrink-0">
                            <div className="text-left md:text-right">
                              <span className="text-[9px] text-slate-400 uppercase block font-bold">Status</span>
                              <span className={`text-xs font-black uppercase px-3 py-1 rounded-full border block ${
                                batch.status === 'win'
                                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                                  : batch.status === 'loss'
                                  ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                                  : 'bg-amber-500/20 text-amber-300 border-amber-500/40 animate-pulse'
                              }`}>
                                {batch.status === 'win' ? `WON ₹${(batch.totalWonAmount || 0).toLocaleString('en-IN')}` : batch.status === 'loss' ? 'LOST (NO REFUND)' : 'ACTIVE PENDING'}
                              </span>
                            </div>

                            {/* Action Buttons */}
                            <div className="flex items-center gap-1.5">
                              <button
                                disabled={isSettling}
                                onClick={() => handleManualSettleBatch(batch, 'win')}
                                className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs rounded-xl shadow-md flex items-center gap-1 cursor-pointer transition-all disabled:opacity-50"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>✓ WIN</span>
                              </button>

                              <button
                                disabled={isSettling}
                                onClick={() => handleManualSettleBatch(batch, 'loss')}
                                className="px-3 py-1.5 bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-rose-300 font-black text-xs rounded-xl flex items-center gap-1 cursor-pointer transition-all disabled:opacity-50"
                              >
                                <XCircle className="w-3.5 h-3.5" />
                                <span>⊘ LOSE</span>
                              </button>

                              <button
                                disabled={isSettling}
                                onClick={() => handleManualSettleBatch(batch, 'active')}
                                className="px-2 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl border border-slate-700 flex items-center gap-1 cursor-pointer transition-all disabled:opacity-50"
                                title="Reset status to active"
                              >
                                <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
                              </button>
                            </div>
                          </div>

                        </div>
                      );
                    })}
                </div>

                <PaginationBar
                  currentPage={ticketPage}
                  totalPages={Math.ceil(groupedBatches.length / ticketPageSize) || 1}
                  pageSize={ticketPageSize}
                  totalItems={groupedBatches.length}
                  onPageChange={(page) => setTicketPage(page)}
                  onPageSizeChange={(size) => {
                    setTicketPageSize(size);
                    setTicketPage(1);
                  }}
                  pageSizeOptions={[10, 20, 50, 100]}
                  label="grouped ticket batches"
                />
              </>
            );
          })()}
        </div>

        </div>
      )}

      {/* =========================================================
          SUB-TAB 4: ⚙️ HD CAR IMAGES & PRICING CONFIG
         ========================================================= */}
      {activeSubTab === 'images' && (
        <div className="space-y-6 animate-in fade-in duration-200 font-mono">
          
          {/* SECTION 0: DUAL TICKET PRICING ENGINE (REAL CASH VS BONUS BALANCE) */}
          <div className="p-5 sm:p-6 bg-gradient-to-br from-slate-900 via-slate-950 to-purple-950/40 border border-purple-500/30 rounded-3xl space-y-4 shadow-xl">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-purple-500/20 text-purple-400 border border-purple-500/30">
                  <Sparkles className="w-5 h-5 animate-pulse" />
                </div>
                <div>
                  <h4 className="text-sm font-black text-white uppercase tracking-tight flex items-center gap-2">
                    <span>SUPER CAR DUAL TICKET PRICING & BONUS ENGINE</span>
                    <span className="bg-purple-500/20 text-purple-300 border border-purple-500/40 text-[9px] px-2 py-0.5 rounded-full font-bold">
                      LIVE SYNC
                    </span>
                  </h4>
                  <p className="text-xs text-slate-300 mt-0.5">
                    রিয়েল ক্যাশ ও বোনাস ব্যালেন্স দিয়ে টিকিট কেনার জন্য আলাদা আলাদা প্রাইস সেট করুন।
                  </p>
                </div>
              </div>

              {/* Allow Bonus Purchase Toggle */}
              <div className="flex items-center gap-2 bg-slate-950 p-2 rounded-2xl border border-purple-500/30">
                <span className="text-[11px] font-bold text-purple-300">
                  {config.allowBonusPurchase !== false ? '🎁 BONUS PURCHASE: ACTIVE' : '🔒 BONUS PURCHASE: LOCKED'}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    soundFx.playClick();
                    const newSetting = config.allowBonusPurchase === false ? true : false;
                    onUpdateConfig({ allowBonusPurchase: newSetting });
                  }}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                    config.allowBonusPurchase !== false ? 'bg-purple-500' : 'bg-slate-700'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      config.allowBonusPurchase !== false ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>

            {/* Global Pricing Inputs */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 pt-1">
              {/* 1. Real Cash Ticket Price */}
              <div className="p-4 bg-slate-950 rounded-2xl border border-amber-500/30 space-y-1.5">
                <label className="text-[11px] font-bold text-amber-400 uppercase block">
                  💵 Real Cash Ticket Price (₹)
                </label>
                <input
                  type="number"
                  min="1"
                  value={config.ticketPrice || 100}
                  onChange={(e) => {
                    const val = Math.max(1, Number(e.target.value) || 100);
                    onUpdateConfig({ ticketPrice: val });
                  }}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-amber-300 font-black outline-none focus:border-amber-400"
                />
                <span className="text-[10px] text-slate-400 block">
                  ইউজার যখন মেইন ওয়ালেট ব্যালেন্স দিয়ে টিকিট কিনবে
                </span>
              </div>

              {/* 2. Bonus Balance Ticket Price */}
              <div className="p-4 bg-slate-950 rounded-2xl border border-purple-500/30 space-y-1.5">
                <label className="text-[11px] font-bold text-purple-300 uppercase block">
                  🎁 Bonus Balance Ticket Price (₹)
                </label>
                <input
                  type="number"
                  min="1"
                  value={config.bonusTicketPrice || config.ticketPrice || 100}
                  onChange={(e) => {
                    const val = Math.max(1, Number(e.target.value) || 100);
                    onUpdateConfig({ bonusTicketPrice: val });
                  }}
                  className="w-full bg-slate-900 border border-purple-500/40 rounded-xl px-3 py-2 text-sm text-purple-200 font-black outline-none focus:border-purple-400"
                />
                <span className="text-[10px] text-slate-400 block">
                  ইউজার যখন বোনাস ব্যালেন্স সিলেক্ট করে টিকিট কাটবে
                </span>
              </div>

              {/* 3. Global Multiplier */}
              <div className="p-4 bg-slate-950 rounded-2xl border border-emerald-500/30 space-y-1.5">
                <label className="text-[11px] font-bold text-emerald-400 uppercase block">
                  🏆 Winning Prize Multiplier (x)
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="1.1"
                  value={config.prizeMultiplier || 2.8}
                  onChange={(e) => {
                    const val = Math.max(1.1, Number(e.target.value) || 2.8);
                    onUpdateConfig({ prizeMultiplier: val });
                  }}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-emerald-300 font-black outline-none focus:border-emerald-400"
                />
                <span className="text-[10px] text-slate-400 block">
                  জিতে গেলে টিকিটের মূল্যের কত গুণ ফেরত পাবে (যেমন 2.8x)
                </span>
              </div>
            </div>
          </div>

          {/* SECTION 1: SUPER CAR IMAGE & PER-CAR PRICING MANAGER */}
          <div className="p-5 bg-slate-900 border border-slate-800 rounded-3xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h4 className="text-sm font-black text-amber-400 uppercase tracking-wider flex items-center gap-2">
                <Sparkles className="w-4 h-4" />
                <span>Super Car HD Image & Individual Pricing (Red, Black, Yellow)</span>
              </h4>
              <span className="text-[10px] text-slate-400">Max 15MB • Client WebP Compression</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {carsList.map((carKey) => {
                const carInfo = getSuperCarInfo(carKey, config);
                const isCustom = Boolean(config.carImages?.[carKey]);
                const isUploading = uploadingCar === carKey;
                const realPrice = config.carPrices?.[carKey] || config.ticketPrice || 100;
                const bonusPrice = config.bonusCarPrices?.[carKey] || config.bonusTicketPrice || realPrice;
                const multiplier = config.carMultipliers?.[carKey] || config.prizeMultiplier || 2.8;

                return (
                  <div key={carKey} className="p-4 bg-slate-950 rounded-2xl border border-slate-800 space-y-3 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-black text-white uppercase">{carInfo.name}</span>
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border uppercase ${
                          carKey === 'red' ? 'bg-rose-500/20 text-rose-300 border-rose-500/30' : carKey === 'black' ? 'bg-amber-500/20 text-amber-300 border-amber-500/30' : 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30'
                        }`}>
                          {carKey}
                        </span>
                      </div>

                      <div className="relative h-36 rounded-xl overflow-hidden border border-slate-800 bg-slate-900 group">
                        <img src={carInfo.image} alt={carInfo.name} className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-transparent to-transparent"></div>

                        {isCustom && (
                          <span className="absolute top-2 left-2 text-[9px] font-bold bg-amber-500 text-slate-950 px-2 py-0.5 rounded-full">
                            CUSTOM IMAGE
                          </span>
                        )}

                        {isUploading && (
                          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm flex flex-col items-center justify-center p-3 space-y-2">
                            <Loader2 className="w-6 h-6 text-amber-400 animate-spin" />
                            <span className="text-xs font-bold text-amber-300">Uploading {uploadProgress}%</span>
                            <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                              <div className="h-full bg-amber-400 transition-all duration-200" style={{ width: `${uploadProgress}%` }}></div>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Real Price, Bonus Price & Multiplier */}
                      <div className="grid grid-cols-3 gap-1.5 mt-3">
                        <div className="space-y-1">
                          <label className="text-[9px] text-amber-400 font-bold block truncate">Real (₹)</label>
                          <input
                            type="number"
                            value={realPrice}
                            onChange={(e) => {
                              const val = Number(e.target.value) || 100;
                              onUpdateConfig({ carPrices: { ...config.carPrices, [carKey]: val } });
                            }}
                            className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-xs text-amber-300 font-bold"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[9px] text-purple-300 font-bold block truncate">Bonus (₹)</label>
                          <input
                            type="number"
                            value={bonusPrice}
                            onChange={(e) => {
                              const val = Number(e.target.value) || 100;
                              onUpdateConfig({ bonusCarPrices: { ...config.bonusCarPrices, [carKey]: val } });
                            }}
                            className="w-full bg-slate-900 border border-purple-500/30 rounded-lg px-2 py-1 text-xs text-purple-200 font-bold"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[9px] text-emerald-400 font-bold block truncate">Odds (x)</label>
                          <input
                            type="number"
                            step="0.1"
                            value={multiplier}
                            onChange={(e) => {
                              const val = Number(e.target.value) || 2.8;
                              onUpdateConfig({ carMultipliers: { ...config.carMultipliers, [carKey]: val } });
                            }}
                            className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-xs text-emerald-400 font-bold"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2 pt-3 border-t border-slate-900">
                      <div className="flex gap-2">
                        <label className="flex-1 py-2 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-md">
                          <Upload className="w-3.5 h-3.5" />
                          <span>{isCustom ? 'Replace Image' : 'Upload Image'}</span>
                          <input
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                handleFileUpload(carKey, file);
                                e.target.value = '';
                              }
                            }}
                          />
                        </label>

                        {isCustom && (
                          <button
                            onClick={() => handleRemoveImage(carKey)}
                            className="p-2 rounded-xl bg-rose-950 hover:bg-rose-900 border border-rose-500/40 text-rose-300 cursor-pointer transition-all"
                            title="Reset image"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>

                      <div className="flex gap-1.5 items-center pt-1">
                        <input
                          type="text"
                          value={
                            urlInputs[carKey] !== undefined
                              ? urlInputs[carKey]
                              : config.carImages?.[carKey]?.startsWith('data:')
                              ? ''
                              : config.carImages?.[carKey] || ''
                          }
                          placeholder={
                            config.carImages?.[carKey]?.startsWith('data:')
                              ? 'Uploaded File (Paste new image URL...)'
                              : 'Or paste HD Image URL...'
                          }
                          onChange={(e) => setUrlInputs({ ...urlInputs, [carKey]: e.target.value })}
                          className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1.5 text-[10px] text-slate-300 font-mono focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={async () => {
                            const val = urlInputs[carKey]?.trim();
                            if (val) {
                              await onUpdateConfig({ carImages: { ...(config.carImages || {}), [carKey]: val } });
                              setUrlInputs({ ...urlInputs, [carKey]: '' });
                              setStatusMessage({ type: 'success', text: `Updated ${carKey.toUpperCase()} image URL!` });
                            }
                          }}
                          className="px-2.5 py-1.5 bg-slate-800 hover:bg-amber-500 hover:text-slate-950 text-slate-300 border border-slate-700 rounded-xl text-[10px] font-bold font-mono transition-all shrink-0"
                        >
                          Save
                        </button>
                      </div>
                    </div>

                  </div>
                );
              })}
            </div>
          </div>

          {/* SECTION 2: LOCK SLOTS OVERRIDE */}
          <div className="p-5 bg-slate-900 border border-slate-800 rounded-3xl space-y-4 font-mono">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h4 className="text-sm font-black text-amber-400 uppercase tracking-wider flex items-center gap-2">
                <Lock className="w-4 h-4" />
                <span>84 Daily Slots Manual Slot Locking Engine</span>
              </h4>
              <span className="text-[10px] text-slate-400">Lock specific slots to prevent user bets</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2">
              {Array.from({ length: 84 }, (_, i) => {
                const slotNum = i + 1;
                const timeLabel = getSlotTimeLabel(slotNum);
                const lockedSlots = config.lockedSlots || [];
                const isLocked = lockedSlots.includes(slotNum);

                return (
                  <div key={slotNum} className="p-2.5 bg-slate-950 rounded-2xl border border-slate-800 space-y-1 text-center">
                    <span className="text-[10px] font-bold text-amber-300 block">Slot #{String(slotNum).padStart(2, '0')}</span>
                    <span className="text-xs font-black text-white block">{timeLabel}</span>
                    <button
                      onClick={() => {
                        soundFx.playClick();
                        const newLocked = isLocked ? lockedSlots.filter((s) => s !== slotNum) : [...lockedSlots, slotNum];
                        onUpdateConfig({ lockedSlots: newLocked });
                      }}
                      className={`w-full py-1 rounded text-[9px] font-black transition-all cursor-pointer ${
                        isLocked ? 'bg-rose-500 text-slate-950' : 'bg-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      {isLocked ? 'LOCKED' : 'LOCK SLOT'}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

        </div>
      )}

    </div>
  );
};
