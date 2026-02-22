import React, { useState } from 'react';
import { Minus, Square, X } from 'lucide-react';

export function WindowControls() {
  const [isMaximized, setIsMaximized] = useState(false);

  const handleMinimize = () => {
    window.electronAPI?.minimize();
  };

  const handleMaximize = async () => {
    window.electronAPI?.maximize();
    const maximized = await window.electronAPI?.isMaximized();
    setIsMaximized(maximized);
  };

  const handleClose = () => {
    window.electronAPI?.close();
  };

  return (
    <div className="flex items-center gap-2 bg-gray-900 px-4 py-2 select-none">
      <button
        onClick={handleMinimize}
        className="hover:bg-gray-800 p-2 rounded transition-colors"
        title="Minimize"
      >
        <Minus size={16} className="text-gray-300" />
      </button>
      <button
        onClick={handleMaximize}
        className="hover:bg-gray-800 p-2 rounded transition-colors"
        title="Maximize"
      >
        <Square size={16} className="text-gray-300" />
      </button>
      <button
        onClick={handleClose}
        className="hover:bg-red-600 p-2 rounded transition-colors"
        title="Close"
      >
        <X size={16} className="text-gray-300" />
      </button>
    </div>
  );
}
