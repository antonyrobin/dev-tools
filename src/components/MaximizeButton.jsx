import React from 'react';
import { Maximize2, Minimize2 } from 'lucide-react';

// Full view toggle for a .code-panel header; pair with useMaximize and the .is-maximized class
const MaximizeButton = ({ active, onToggle }) => (
  <button
    type="button"
    className="btn btn-ghost btn-xs"
    onClick={onToggle}
    title={active ? 'Exit full view (Esc)' : 'Full view'}
    aria-pressed={active}
  >
    {active ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
  </button>
);

export default MaximizeButton;
