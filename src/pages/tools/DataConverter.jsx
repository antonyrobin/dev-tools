import React, { useState, useMemo, useDeferredValue } from 'react';
import { ArrowLeftRight, ArrowRightLeft, Download, Trash2, Sparkles, AlertTriangle, Wand2 } from 'lucide-react';
import ToolHeader from '../../components/ToolHeader';
import ShareHistory from '../../components/ShareHistory';
import CopyButton from '../../components/CopyButton';
import CodeDropzoneTextarea, { UploadButton } from '../../components/CodeDropzoneTextarea';
import usePageTitle from '../../hooks/usePageTitle';
import { DATA_FORMATS, detectFormat, parseData, serializeData } from '../../utils/dataFormats';
import './Tools.css';

const SAMPLES = {
  json: `{
  "team": "Platform",
  "active": true,
  "members": [
    { "id": 1, "name": "Ada", "role": "lead", "skills": ["go", "k8s"] },
    { "id": 2, "name": "Linus", "role": "dev", "skills": ["c", "git"] }
  ]
}`,
  yaml: `team: Platform
active: true
members:
  - id: 1
    name: Ada
    role: lead
  - id: 2
    name: Linus
    role: dev
`,
  xml: `<?xml version="1.0"?>
<catalog>
  <book id="bk101">
    <author>Gambardella, Matthew</author>
    <title>XML Developer's Guide</title>
    <price>44.95</price>
  </book>
  <book id="bk102">
    <author>Ralls, Kim</author>
    <title>Midnight Rain</title>
    <price>5.95</price>
  </book>
</catalog>`,
  csv: `id,name,role,address.city
1,Ada,lead,London
2,Linus,dev,Helsinki
3,Grace,admiral,Arlington`,
};

const DELIMITERS = [
  { value: 'auto', label: 'Auto' },
  { value: ',', label: 'Comma' },
  { value: ';', label: 'Semicolon' },
  { value: '\t', label: 'Tab' },
  { value: '|', label: 'Pipe' },
];

const extFor = (fmt) => DATA_FORMATS.find((f) => f.value === fmt)?.ext || 'txt';

const DataConverter = () => {
  usePageTitle('Data Converter');
  const [from, setFrom] = useState('json');
  const [to, setTo] = useState('yaml');
  const [input, setInput] = useState(SAMPLES.json);
  const [indent, setIndent] = useState(2);
  const [delimiter, setDelimiter] = useState('auto');
  const [nestCsv, setNestCsv] = useState(true);
  const [rootName, setRootName] = useState('root');

  const deferredInput = useDeferredValue(input);

  const { output, error } = useMemo(() => {
    if (!deferredInput.trim()) return { output: '', error: null };
    try {
      const value = parseData(deferredInput, from, { delimiter, nest: nestCsv });
      return { output: serializeData(value, to, { indent, delimiter, rootName: rootName.trim() || 'root' }), error: null };
    } catch (err) {
      return { output: '', error: err.message || String(err) };
    }
  }, [deferredInput, from, to, indent, delimiter, nestCsv, rootName]);

  const handleSwap = () => {
    if (output) setInput(output);
    setFrom(to);
    setTo(from);
  };

  const handleDetect = () => {
    const detected = detectFormat(input);
    if (detected) {
      setFrom(detected);
      if (detected === to) setTo(detected === 'json' ? 'yaml' : 'json');
    }
  };

  const handleFromChange = (fmt) => {
    setFrom(fmt);
    if (fmt === to) setTo(from);
    // Swap in the sample for the new format when the input is still an untouched sample
    if (Object.values(SAMPLES).includes(input)) setInput(SAMPLES[fmt]);
  };

  const handleDownload = () => {
    const fmt = DATA_FORMATS.find((f) => f.value === to);
    const blob = new Blob([output], { type: `${fmt.mime};charset=utf-8` });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `converted.${fmt.ext}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const shareState = { from, to, input, indent };

  return (
    <div className="tool-page">
      <ToolHeader
        title="Data Converter"
        description="Convert between JSON, YAML, XML and CSV in any direction. Nested objects become dotted CSV columns and back."
        icon={ArrowLeftRight}
        color="#0ea5e9"
      >
        <ShareHistory
          toolId="data-convert"
          state={shareState}
          describe={(s) => `${s.from.toUpperCase()} → ${s.to.toUpperCase()} · ${s.input.trim().replace(/\s+/g, ' ').slice(0, 60)}`}
          isEmpty={(s) => !s.input.trim()}
          onRestore={(s) => {
            if (s.from) setFrom(s.from);
            if (s.to) setTo(s.to);
            if (s.indent) setIndent(s.indent);
            setInput(s.input || '');
          }}
        />
      </ToolHeader>

      <div className="tool-toolbar">
        <div className="tool-toolbar-group">
          <select className="form-select" value={from} onChange={(e) => handleFromChange(e.target.value)} aria-label="Input format" style={{ minWidth: 110 }}>
            {DATA_FORMATS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
          </select>
          <button className="btn btn-outline btn-sm" onClick={handleSwap} title="Swap direction (uses the output as new input)">
            <ArrowRightLeft size={15} />
          </button>
          <select className="form-select" value={to} onChange={(e) => setTo(e.target.value)} aria-label="Output format" style={{ minWidth: 110 }}>
            {DATA_FORMATS.filter((f) => f.value !== from).map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
          </select>
          <select className="form-select" value={indent} onChange={(e) => setIndent(Number(e.target.value))} aria-label="Indentation" style={{ minWidth: 110 }}>
            <option value={2}>2 spaces</option>
            <option value={4}>4 spaces</option>
          </select>
          {(from === 'csv' || to === 'csv') && (
            <select className="form-select" value={delimiter} onChange={(e) => setDelimiter(e.target.value)} aria-label="CSV delimiter" style={{ minWidth: 120 }}>
              {DELIMITERS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
            </select>
          )}
          {from === 'csv' && (
            <label className="check-toggle" title="Turn dotted headers such as address.city into nested objects">
              <input type="checkbox" checked={nestCsv} onChange={(e) => setNestCsv(e.target.checked)} />
              <span>Nest dotted headers</span>
            </label>
          )}
          {to === 'xml' && (
            <input
              className="form-input"
              style={{ width: 130, padding: '0.45rem 0.7rem', fontSize: '0.9rem' }}
              value={rootName}
              onChange={(e) => setRootName(e.target.value.replace(/[^\w.-]/g, ''))}
              aria-label="XML root element name"
              title="Root element used when the data has no single top-level key"
              placeholder="root"
            />
          )}
        </div>
        <div className="tool-toolbar-group" style={{ width: 'auto' }}>
          <button className="btn btn-ghost btn-sm" onClick={handleDetect} title="Detect the input format">
            <Wand2 size={15} /> <span>Detect</span>
          </button>
          <button className="btn btn-ghost btn-sm" onClick={() => setInput(SAMPLES[from])}>
            <Sparkles size={15} /> <span>Sample</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="alert alert-error">
          <AlertTriangle size={16} />
          <span>Invalid {from.toUpperCase()}: {error}</span>
        </div>
      )}

      <div className="editor-split">
        <div className="code-panel">
          <div className="code-panel-header">
            <span className="code-panel-title">Input <span className="badge-lang">{from.toUpperCase()}</span></span>
            <div className="code-panel-actions">
              <UploadButton
                label="Upload"
                className="btn btn-ghost btn-xs"
                onFileLoaded={(res) => {
                  setInput(res.content);
                  const ext = res.extension === 'yml' ? 'yaml' : res.extension;
                  if (DATA_FORMATS.some((f) => f.value === ext)) {
                    setFrom(ext);
                    if (ext === to) setTo(ext === 'json' ? 'yaml' : 'json');
                  }
                }}
              />
              <button className="btn btn-ghost btn-xs btn-danger-ghost" onClick={() => setInput('')} disabled={!input} title="Clear">
                <Trash2 size={14} />
              </button>
            </div>
          </div>
          <div className="code-panel-body">
            <CodeDropzoneTextarea value={input} onChange={setInput} placeholder={`Paste or drop ${from.toUpperCase()} here…`} lineNumbers />
          </div>
          <div className="code-panel-footer">
            <span>{input ? input.split('\n').length.toLocaleString() : 0} lines</span>
            <span>{input.length.toLocaleString()} chars</span>
          </div>
        </div>

        <div className="code-panel">
          <div className="code-panel-header">
            <span className="code-panel-title">Output <span className="badge-lang">{to.toUpperCase()}</span></span>
            <div className="code-panel-actions">
              <CopyButton text={output} />
              <button className="btn btn-ghost btn-xs" onClick={handleDownload} disabled={!output} title={`Download .${extFor(to)}`}>
                <Download size={14} />
              </button>
            </div>
          </div>
          <div className="code-panel-body">
            <CodeDropzoneTextarea value={output} readOnly placeholder="Converted output appears here as you type…" lineNumbers />
          </div>
          <div className="code-panel-footer">
            <span>{output ? output.split('\n').length.toLocaleString() : 0} lines</span>
            <span>{output.length.toLocaleString()} chars</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DataConverter;
