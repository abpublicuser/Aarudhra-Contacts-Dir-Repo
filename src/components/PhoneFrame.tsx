import React from 'react';

interface PhoneFrameProps {
  children: React.ReactNode;
}

export const PhoneFrame: React.FC<PhoneFrameProps> = ({ children }) => {
  return (
    <div className="min-h-screen bg-slate-300 flex flex-col items-center justify-center p-0 md:p-6 font-sans">
      {/* Background radial glow */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-200 via-slate-300 to-slate-400 -z-10" />

      {/* Responsive layout container */}
      <div className="w-full max-w-lg md:max-w-md h-screen md:h-[840px] relative md:rounded-[48px] md:shadow-[0_25px_50px_-20px_rgba(0,0,0,0.25),0_10px_25px_-12px_rgba(0,0,0,0.15)] md:border-[10px] md:border-slate-400 bg-slate-200 overflow-hidden flex flex-col transition-all duration-300">
        
        {/* Physical notch / island (visible only on desktop) */}
        <div className="hidden md:flex absolute top-0 left-1/2 transform -translate-x-1/2 w-40 h-8 bg-slate-900 rounded-b-2xl z-50 items-center justify-center">
          <div className="w-12 h-1 bg-slate-650 rounded-full mb-1" />
          <div className="w-2.5 h-2.5 bg-slate-800 rounded-full border border-slate-700 absolute right-6 top-2.5" />
        </div>

        {/* Dynamic status bar overlay for desktop & mobile status feel */}
        <div className="h-6 md:h-10 bg-slate-100/70 backdrop-blur-md flex items-center justify-between px-6 text-[10px] font-mono tracking-widest text-slate-600 select-none z-40 border-b border-slate-300/40 shrink-0">
          <div className="font-semibold text-slate-850">12:00</div>
          <div className="flex items-center gap-1.5 font-medium">
            <span className="w-2.5 h-1.5 bg-slate-500 rounded-2xs inline-block" />
            <span className="text-[9px] text-slate-650">LTE</span>
            <div className="w-5 h-2.5 border border-slate-400 rounded-xs p-0.5 flex items-center">
              <div className="h-full w-full bg-emerald-600 rounded-3xs" />
            </div>
          </div>
        </div>

        {/* Scrollable container holding actual application content */}
        <div className="flex-1 w-full flex flex-col bg-slate-200 overflow-hidden relative">
          {children}
        </div>

        {/* iOS home indicator bar (Only visible on desktop viewports) */}
        <div className="hidden md:block h-6 bg-slate-250 flex items-center justify-center shrink-0 border-t border-slate-300/40">
          <div className="w-32 h-1 bg-slate-400 rounded-full" />
        </div>
      </div>

      {/* Subtle bottom helper credit explaining mock viewport */}
      <p className="hidden md:block text-slate-600 text-xs text-center mt-4 tracking-wide font-mono">
        Viewing in high-fidelity mobile workspace viewport style
      </p>
    </div>
  );
};
