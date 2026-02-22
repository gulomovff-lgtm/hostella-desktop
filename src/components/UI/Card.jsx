import React from 'react';

const Card = ({ children, className = "" }) => (
  <div className={`bg-white rounded-2xl shadow-sm border border-slate-300 p-5 ${className}`}>
    {children}
  </div>
);

export default Card;
