import React from 'react';

export const LegalPage: React.FC = () => {
  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center p-4 bg-brand-bg dark:bg-slate-950 transition-colors duration-300">
      <div className="z-10 bg-white dark:bg-slate-900 rounded-[1.8rem] p-8 sm:p-10 shadow-[0_10px_35px_rgba(0,0,0,0.03)] border border-slate-100/50 dark:border-slate-800 flex flex-col items-center text-center space-y-6 w-full max-w-[420px]">
        <h1 className="text-3.5xl font-black text-slate-900 dark:text-white tracking-tight">
          Impressum
        </h1>
      </div>
    </div>
  );
};
