import React, { useState, useEffect } from 'react';
import ToolHeader from '../components/ToolHeader';
import { AlignJustify, Printer } from 'lucide-react';
import Barcode from 'react-barcode';
import usePageTitle from '../hooks/usePageTitle';

const BarcodeGenerator = () => {
  usePageTitle('Barcode Generator');
  const [startSequence, setStartSequence] = useState(1000);
  const [count, setCount] = useState(12);
  const [prefix, setPrefix] = useState('ITM-');
  const [barcodes, setBarcodes] = useState([]);

  useEffect(() => {
    generateSequence();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startSequence, count, prefix]);

  const generateSequence = () => {
    const arr = [];
    const numStart = Number(startSequence);
    const numCount = Number(count);
    
    if (!isNaN(numStart) && !isNaN(numCount) && numCount > 0 && numCount <= 100) {
      for (let i = 0; i < numCount; i++) {
        arr.push(`${prefix}${numStart + i}`);
      }
    }
    setBarcodes(arr);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="tool-page">
      <ToolHeader 
        title="Barcode Generator" 
        description="Generate sequential barcodes for inventory and tracking up to 100 at a time."
        icon={AlignJustify}
        color="var(--accent)"
      />

      <div className="glass-card mb-8 p-6 print:hidden" style={{ padding: '1.5rem' }}>
        <h3 className="mb-4 text-xl">Sequence Configuration</h3>
        <div className="barcode-config">
          
          <div className="form-group">
            <label className="form-label">Prefix Optional</label>
            <input 
              type="text" 
              className="form-input" 
              value={prefix}
              onChange={(e) => setPrefix(e.target.value)}
              placeholder="e.g. ITM-"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Start Number</label>
            <input 
              type="number" 
              className="form-input" 
              value={startSequence}
              onChange={(e) => setStartSequence(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Count (Max 100)</label>
            <input 
              type="number" 
              className="form-input" 
              value={count}
              onChange={(e) => setCount(Math.min(100, Math.max(1, e.target.value)))}
            />
          </div>

          <div className="form-group">
            <button className="btn btn-primary" onClick={handlePrint} style={{ height: 42 }}>
              <Printer size={18} /> Print All
            </button>
          </div>
        </div>
      </div>

      <div className="barcode-grid" style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 240px), 1fr))', 
        gap: '1.5rem' 
      }}>
        {barcodes.map((code, idx) => (
          <div key={idx} className="glass-card flex flex-col items-center p-4 bg-white" style={{ background: '#ffffff', color: '#000', padding: '1.5rem', borderRadius: 'var(--radius-md)' }}>
            <Barcode 
              value={code} 
              format="CODE128" 
              width={1.5} 
              height={60} 
              displayValue={true} 
              background="#ffffff" 
              lineColor="#000000" 
            />
          </div>
        ))}
        {barcodes.length === 0 && (
          <div className="col-span-full text-center p-8 text-muted">
            Invalid sequence configuration.
          </div>
        )}
      </div>

      <style>{`
        .barcode-config {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr)) auto;
          gap: 1rem;
          align-items: end;
        }
        .barcode-config .form-group { margin-bottom: 0; }
        .barcode-grid svg { max-width: 100%; height: auto; }
        @media (max-width: 768px) {
          .barcode-config { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .barcode-config .btn { width: 100%; }
        }
        @media (max-width: 480px) {
          .barcode-config { grid-template-columns: 1fr; }
        }
        @media print {
          body * {
            visibility: hidden;
            background: white !important;
            color: black !important;
          }
          .barcode-grid, .barcode-grid * {
            visibility: visible;
          }
          .barcode-grid {
            position: absolute;
            left: 0;
            top: 0;
            grid-template-columns: repeat(3, 1fr) !important;
          }
          .print\\:hidden {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
};

export default BarcodeGenerator;
