import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import ToolHeader from '../components/ToolHeader';
import { QrCode, Download } from 'lucide-react';
import usePageTitle from '../hooks/usePageTitle';

const QrGenerator = () => {
  usePageTitle('QR Generator');
  const [text, setText] = useState('https://devtools.opensource');
  const [size, setSize] = useState(256);
  const [fgColor, setFgColor] = useState('#ffffff');
  const [bgColor, setBgColor] = useState('#0a0a0e');

  const downloadQR = () => {
    const svg = document.getElementById("qr-code-svg");
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const img = new Image();
    img.onload = () => {
      canvas.width = size;
      canvas.height = size;
      ctx.drawImage(img, 0, 0);
      const pngFile = canvas.toDataURL("image/png");
      const downloadLink = document.createElement("a");
      downloadLink.download = "qrcode.png";
      downloadLink.href = `${pngFile}`;
      downloadLink.click();
    };
    img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgData)));
  };

  return (
    <div className="container animate-fade-in" style={{ paddingTop: '2rem' }}>
      <ToolHeader 
        title="QR Code Generator" 
        description="Generate high-quality QR codes instantly."
        icon={QrCode}
        color="var(--primary)"
      />

      <div className="grid" style={{ gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '2rem' }}>
        <div className="glass-card p-6" style={{ padding: '2rem' }}>
          <h3 className="mb-4 text-xl">Settings</h3>
          
          <div className="form-group mb-4">
            <label className="form-label">Content (Text or URL)</label>
            <input 
              type="text" 
              className="form-input" 
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
          </div>

          <div className="form-group mb-4">
            <label className="form-label">Size (px)</label>
            <input 
              type="number" 
              className="form-input" 
              value={size}
              onChange={(e) => setSize(Number(e.target.value))}
              min="100" max="1000"
            />
          </div>

          <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label">Foreground</label>
              <input 
                type="color" 
                className="form-input" 
                value={fgColor}
                onChange={(e) => setFgColor(e.target.value)}
                style={{ padding: '0.2rem', height: '45px' }}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Background</label>
              <input 
                type="color" 
                className="form-input" 
                value={bgColor}
                onChange={(e) => setBgColor(e.target.value)}
                style={{ padding: '0.2rem', height: '45px' }}
              />
            </div>
          </div>
        </div>

        <div className="glass-card flex flex-col items-center justify-center p-6" style={{ padding: '2rem', background: 'var(--bg-primary)' }}>
          <div 
            className="mb-8 p-4 rounded-xl" 
            style={{ 
              background: bgColor, 
              boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
              display: 'inline-block'
            }}
          >
            <QRCodeSVG 
              id="qr-code-svg"
              value={text} 
              size={size > 300 ? 300 : size} // Visual scale down max on UI
              fgColor={fgColor} 
              bgColor="transparent" // keep actual qr transparent via canvas on actual svg element
              level={"H"}
            />
          </div>

          <button className="btn btn-primary" onClick={downloadQR} disabled={!text}>
            <Download size={18} /> Download PNG
          </button>
        </div>
      </div>
    </div>
  );
};

export default QrGenerator;
