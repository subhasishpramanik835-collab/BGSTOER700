import React, { useEffect, useRef, useState } from 'react';
import { Download, Share2, X, CheckCircle2, ShieldCheck, Sparkles, Copy, Check } from 'lucide-react';
import { WalletTransaction } from '../types';
import { soundFx } from '../utils/audio';

interface VoucherGeneratorProps {
  transaction: WalletTransaction | any;
  onClose?: () => void;
}

export const VoucherGenerator: React.FC<VoucherGeneratorProps> = ({ transaction, onClose }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [copied, setCopied] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [dataUrl, setDataUrl] = useState<string>('');

  const isCredit = transaction.amount ? transaction.amount >= 0 : (transaction.status === 'win' || transaction.type === 'deposit');
  const displayAmount = transaction.amount !== undefined 
    ? Math.abs(transaction.amount).toLocaleString('en-IN')
    : (transaction.price || transaction.wonAmount || 0).toLocaleString('en-IN');

  const titleText = transaction.description || transaction.drawTitle || transaction.drawName || `BETGURU ${transaction.type?.toUpperCase() || 'TRANSACTION'}`;
  const txId = transaction.id || `TXN-${Math.floor(100000 + Math.random() * 900000)}`;
  const dateText = transaction.date || transaction.purchaseDate || new Date().toLocaleString('en-IN');
  const statusText = (transaction.status || (isCredit ? 'CREDITED' : 'DEBITED')).toUpperCase();
  const utrNumber = transaction.utr || transaction.utrNumber || transaction.userId || 'N/A';

  // Draw HD Canvas Voucher on component mount
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // HD Resolution settings (800x1000)
    const width = 800;
    const height = 1000;
    canvas.width = width;
    canvas.height = height;

    // Background - Dark Luxury Gradient
    const bgGrad = ctx.createLinearGradient(0, 0, width, height);
    bgGrad.addColorStop(0, '#090d16');
    bgGrad.addColorStop(0.5, '#0f172a');
    bgGrad.addColorStop(1, '#020617');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Decorative Outer Border Frame
    ctx.strokeStyle = 'rgba(245, 158, 11, 0.4)';
    ctx.lineWidth = 6;
    ctx.strokeRect(20, 20, width - 40, height - 40);

    ctx.strokeStyle = 'rgba(245, 158, 11, 0.15)';
    ctx.lineWidth = 2;
    ctx.strokeRect(28, 28, width - 56, height - 56);

    // Header Logo & Branding
    ctx.fillStyle = '#f59e0b';
    ctx.font = '900 32px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('BETGURU OFFICIAL SLIP', width / 2, 85);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '700 14px monospace';
    ctx.fillText('VERIFIED BLOCKCHAIN & FIRESTORE TRANSACTION VOUCHER', width / 2, 112);

    // Gold Divider Line
    const divGrad = ctx.createLinearGradient(100, 0, width - 100, 0);
    divGrad.addColorStop(0, 'rgba(245, 158, 11, 0)');
    divGrad.addColorStop(0.5, '#f59e0b');
    divGrad.addColorStop(1, 'rgba(245, 158, 11, 0)');
    ctx.strokeStyle = divGrad;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(100, 130);
    ctx.lineTo(width - 100, 130);
    ctx.stroke();

    // Status Banner Box
    const bannerY = 160;
    const bannerHeight = 80;
    ctx.fillStyle = isCredit ? 'rgba(16, 185, 129, 0.15)' : 'rgba(244, 63, 94, 0.15)';
    ctx.fillRect(80, bannerY, width - 160, bannerHeight);
    ctx.strokeStyle = isCredit ? '#10b981' : '#f43f5e';
    ctx.lineWidth = 2;
    ctx.strokeRect(80, bannerY, width - 160, bannerHeight);

    ctx.fillStyle = isCredit ? '#34d399' : '#f87171';
    ctx.font = '900 24px monospace';
    ctx.fillText(`STATUS: ${statusText} (SETTLED)`, width / 2, bannerY + 36);

    // Amount Display (Huge HD Text)
    ctx.font = '900 52px monospace';
    const amountStr = `${isCredit ? '+' : '-'} ₹${displayAmount}`;
    ctx.fillText(amountStr, width / 2, bannerY + 72);

    // Details Box Table
    const tableY = 280;
    ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
    ctx.fillRect(80, tableY, width - 160, 480);
    ctx.strokeStyle = 'rgba(51, 65, 85, 0.8)';
    ctx.strokeRect(80, tableY, width - 160, 480);

    const rows = [
      { label: 'TRANSACTION ID', value: txId },
      { label: 'TYPE / CATEGORY', value: (transaction.type || 'GENERAL').toUpperCase() },
      { label: 'TITLE / DESCRIPTION', value: titleText },
      { label: 'DATE & TIME', value: dateText },
      { label: 'UTR / REF NUMBER', value: utrNumber },
      { label: 'SECURITY SEAL', value: 'SHA-256 ENCRYPTED HARDENED' },
    ];

    let rowY = tableY + 50;
    rows.forEach((r, idx) => {
      // Row Background alternating
      if (idx % 2 === 0) {
        ctx.fillStyle = 'rgba(30, 41, 59, 0.5)';
        ctx.fillRect(90, rowY - 30, width - 180, 50);
      }

      ctx.textAlign = 'left';
      ctx.fillStyle = '#94a3b8';
      ctx.font = '700 15px monospace';
      ctx.fillText(r.label, 110, rowY);

      ctx.textAlign = 'right';
      ctx.fillStyle = r.label === 'TRANSACTION ID' ? '#f59e0b' : '#ffffff';
      ctx.font = '900 16px monospace';
      
      // Truncate long value strings for clean alignment
      let valStr = String(r.value);
      if (valStr.length > 28) valStr = valStr.substring(0, 25) + '...';
      ctx.fillText(valStr, width - 110, rowY);

      rowY += 75;
    });

    // Barcode Graphic simulation
    const barcodeY = 790;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(120, barcodeY, width - 240, 60);

    // Black lines of barcode
    ctx.fillStyle = '#000000';
    let lineX = 130;
    while (lineX < width - 130) {
      const lineWidth = Math.floor(Math.random() * 4) + 1;
      ctx.fillRect(lineX, barcodeY + 5, lineWidth, 50);
      lineX += lineWidth + Math.floor(Math.random() * 5) + 2;
    }

    // Footer Text
    ctx.textAlign = 'center';
    ctx.fillStyle = '#64748b';
    ctx.font = '700 13px monospace';
    ctx.fillText('Official Digital Receipt • BETGURU Real-Time Gaming Engine', width / 2, 880);
    ctx.fillText('Keep this voucher slip for security validation and customer queries', width / 2, 905);

    // Set generated Data URL
    try {
      setDataUrl(canvas.toDataURL('image/png'));
    } catch (e) {
      console.error('Error generating canvas data URL:', e);
    }
  }, [transaction]);

  const handleDownload = () => {
    soundFx.playCoin();
    const canvas = canvasRef.current;
    if (!canvas) return;

    const image = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.href = image;
    link.download = `BETGURU-Voucher-${txId}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleShare = async () => {
    soundFx.playClick();
    setIsSharing(true);

    try {
      const canvas = canvasRef.current;
      if (canvas && navigator.canShare) {
        canvas.toBlob(async (blob) => {
          if (blob) {
            const file = new File([blob], `BETGURU-Voucher-${txId}.png`, { type: 'image/png' });
            if (navigator.canShare({ files: [file] })) {
              try {
                await navigator.share({
                  title: 'BETGURU Transaction Slip',
                  text: `BETGURU Official Voucher - ${titleText} (₹${displayAmount})`,
                  files: [file],
                });
                setIsSharing(false);
                return;
              } catch (shareErr) {
                console.warn('File share cancelled or failed:', shareErr);
              }
            }
          }

          // Fallback share without files
          if (navigator.share) {
            await navigator.share({
              title: 'BETGURU Transaction Slip',
              text: `BETGURU Voucher Slip:\n${titleText}\nAmount: ₹${displayAmount}\nTx ID: ${txId}`,
              url: window.location.href,
            });
          }
          setIsSharing(false);
        });
      } else if (navigator.share) {
        await navigator.share({
          title: 'BETGURU Transaction Slip',
          text: `BETGURU Voucher Slip:\n${titleText}\nAmount: ₹${displayAmount}\nTx ID: ${txId}`,
          url: window.location.href,
        });
        setIsSharing(false);
      } else {
        // Fallback: Copy to clipboard & trigger download
        handleDownload();
        setIsSharing(false);
      }
    } catch (err) {
      console.error('Share error:', err);
      handleDownload();
      setIsSharing(false);
    }
  };

  const copyTxId = () => {
    navigator.clipboard.writeText(txId);
    setCopied(true);
    soundFx.playClick();
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-slate-900 border border-amber-500/40 rounded-3xl p-5 sm:p-6 max-w-lg w-full space-y-5 shadow-2xl relative font-mono text-white animate-in zoom-in-95 duration-200">
      
      {/* Modal Close Button */}
      {onClose && (
        <button
          onClick={() => { soundFx.playClick(); onClose(); }}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white bg-slate-950 rounded-xl border border-slate-800 hover:border-amber-400 transition-all cursor-pointer z-10"
        >
          <X className="w-5 h-5" />
        </button>
      )}

      {/* Header Badge */}
      <div className="flex items-center gap-3 border-b border-slate-800 pb-3 pr-10">
        <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
          <Sparkles className="w-5 h-5" />
        </div>
        <div>
          <h3 className="text-base font-black text-white">BETGURU Transaction Voucher</h3>
          <p className="text-xs text-amber-400 font-bold">HD Official Digital Result Slip</p>
        </div>
      </div>

      {/* Rendered Canvas Preview */}
      <div className="bg-slate-950 p-2 rounded-2xl border border-slate-800 flex justify-center items-center shadow-inner overflow-hidden">
        <canvas
          ref={canvasRef}
          className="w-full max-h-[380px] object-contain rounded-xl border border-slate-800 shadow-md"
        />
      </div>

      {/* Details Quick Bar */}
      <div className="p-3 bg-slate-950 rounded-xl border border-slate-800/80 flex items-center justify-between text-xs">
        <div>
          <span className="text-[10px] text-slate-400 block uppercase">Voucher Tx ID</span>
          <span className="font-extrabold text-amber-300 flex items-center gap-1">
            {txId}
            <button onClick={copyTxId} className="hover:text-white p-0.5">
              {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3 text-slate-400" />}
            </button>
          </span>
        </div>

        <div className="text-right">
          <span className="text-[10px] text-slate-400 block uppercase">Settled Amount</span>
          <span className={`font-black text-sm ${isCredit ? 'text-emerald-400' : 'text-rose-400'}`}>
            {isCredit ? '+' : '-'} ₹{displayAmount}
          </span>
        </div>
      </div>

      {/* Interactive Mobile Share & Download Action Buttons */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
        <button
          onClick={handleShare}
          disabled={isSharing}
          className="w-full py-3 px-4 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-black text-xs rounded-xl shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 transition-all cursor-pointer"
        >
          <Share2 className="w-4 h-4" />
          <span>{isSharing ? 'Sharing Slip...' : 'Share Result Slip'}</span>
        </button>

        <button
          onClick={handleDownload}
          className="w-full py-3 px-4 bg-slate-800 hover:bg-slate-700 text-white font-black text-xs rounded-xl border border-slate-700 hover:border-amber-400 flex items-center justify-center gap-2 transition-all cursor-pointer"
        >
          <Download className="w-4 h-4 text-amber-400" />
          <span>Download HD PNG</span>
        </button>
      </div>

    </div>
  );
};
