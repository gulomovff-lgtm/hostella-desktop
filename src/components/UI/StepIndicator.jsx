import React from 'react';

const StepIndicator = ({ step, total }) => (
  <div className="flex gap-2 mb-6">
    {Array.from({ length: total }).map((_, i) => (
      <div key={i} className={`h-1.5 rounded-full flex-1 transition-all duration-300 ${i + 1 <= step ? 'bg-blue-600' : 'bg-slate-200'}`} />
    ))}
  </div>
);

export default StepIndicator;
