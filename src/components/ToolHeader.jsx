import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

const ToolHeader = ({ title, description, icon: Icon, color }) => {
  return (
    <div className="mb-6 animate-fade-in">
      <Link to="/" className="btn btn-ghost mb-4" style={{ padding: 0 }}>
        <ArrowLeft size={18} /> Back to Tools
      </Link>
      <div className="flex items-center gap-4">
        <div 
          className="flex items-center justify-center rounded-xl" 
          style={{ 
            width: '64px', height: '64px', 
            background: `${color}22`, 
            color: color 
          }}
        >
          <Icon size={32} />
        </div>
        <div>
          <h1 className="mb-1" style={{ fontSize: '2rem' }}>{title}</h1>
          <p className="mb-0 text-muted">{description}</p>
        </div>
      </div>
    </div>
  );
};

export default ToolHeader;
