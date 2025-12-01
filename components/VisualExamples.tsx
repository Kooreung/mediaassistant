
import React from 'react';
import { AlertTriangle, CheckCircle2, ArrowRight, FileText, Clock, AlignLeft, MoveRight } from 'lucide-react';

export const PremiereFixerVisual = () => {
  return (
    <div className="w-full max-w-lg mx-auto my-6 bg-slate-50 rounded-xl border border-slate-200 p-4 flex flex-col sm:flex-row items-center justify-center gap-4 text-xs sm:text-sm shadow-inner">
      {/* Before State */}
      <div className="flex-1 w-full bg-white border border-red-200 rounded-lg p-3 shadow-sm opacity-80 relative overflow-hidden group">
        <div className="absolute top-0 right-0 bg-red-100 text-red-600 px-2 py-0.5 rounded-bl text-[10px] font-bold">
          ERROR
        </div>
        <div className="flex items-center gap-2 mb-2 text-red-500 font-medium">
          <AlertTriangle className="w-4 h-4" />
          <span>미디어 오프라인</span>
        </div>
        <div className="font-mono text-slate-400 text-xs mb-1">File Path:</div>
        <div className="font-mono text-slate-800 bg-slate-100 p-1.5 rounded truncate">
          /.../ᄒ ᅡ ᆫ ᄀ ᅳ ᆯ.mov
        </div>
        <div className="mt-2 text-[10px] text-red-400 text-center">(자소 분리 현상)</div>
      </div>

      <ArrowRight className="w-5 h-5 text-slate-400 rotate-90 sm:rotate-0 flex-shrink-0" />

      {/* After State */}
      <div className="flex-1 w-full bg-white border border-green-200 rounded-lg p-3 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 bg-green-100 text-green-600 px-2 py-0.5 rounded-bl text-[10px] font-bold">
          FIXED
        </div>
        <div className="flex items-center gap-2 mb-2 text-green-600 font-medium">
          <CheckCircle2 className="w-4 h-4" />
          <span>정상 연결됨</span>
        </div>
        <div className="font-mono text-slate-400 text-xs mb-1">File Path:</div>
        <div className="font-mono text-slate-800 bg-indigo-50 p-1.5 rounded truncate border border-indigo-100">
          /.../한글.mov
        </div>
        <div className="mt-2 text-[10px] text-green-500 text-center">(정상 자모 결합)</div>
      </div>
    </div>
  );
};

export const TextReformatVisual = () => {
  return (
    <div className="w-full max-w-lg mx-auto my-6 bg-slate-900 rounded-xl p-6 text-white text-center shadow-lg">
      <div className="text-xs text-slate-400 mb-4 font-medium uppercase tracking-wider">Before & After Preview</div>
      
      <div className="space-y-6">
        {/* Before */}
        <div className="opacity-50 scale-95 transition-all">
          <div className="inline-block bg-black/40 backdrop-blur-sm px-4 py-2 rounded-lg text-sm sm:text-base border border-white/10">
            화면에 표시하기에는 너무 길어서 한눈에 읽기 힘든 자막입니다
          </div>
          <div className="text-[10px] text-slate-500 mt-1">너무 긴 문장 (가독성 저하)</div>
        </div>

        {/* Arrow */}
        <div className="flex justify-center">
           <div className="w-px h-6 bg-gradient-to-b from-slate-700 to-indigo-500"></div>
        </div>

        {/* After */}
        <div className="relative">
          <div className="inline-flex flex-col gap-1 items-center bg-black/60 backdrop-blur-md px-6 py-3 rounded-xl text-sm sm:text-base border border-indigo-500/30 shadow-indigo-500/10 shadow-lg">
            <span>화면에 표시하기에는 너무 길어서</span>
            <span>한눈에 읽기 힘든 자막입니다</span>
          </div>
          <div className="text-[10px] text-indigo-300 mt-2 font-medium">최적화된 줄바꿈 (가독성 향상)</div>
        </div>
      </div>
    </div>
  );
};

export const TextExtractVisual = () => {
  return (
    <div className="w-full max-w-lg mx-auto my-6 flex items-stretch gap-0 rounded-xl border border-slate-200 overflow-hidden text-xs sm:text-sm shadow-sm">
      {/* SRT Side */}
      <div className="flex-1 bg-slate-50 p-4 border-r border-slate-200 flex flex-col gap-2">
        <div className="flex items-center gap-1.5 text-slate-400 mb-1">
          <Clock className="w-3 h-3" />
          <span className="font-mono text-[10px]">SRT FORMAT</span>
        </div>
        <div className="font-mono text-slate-600 leading-relaxed opacity-60">
          <div className="text-orange-400 text-[10px]">00:01:23 --> 00:01:25</div>
          <div>안녕하세요</div>
          <div className="h-2"></div>
          <div className="text-orange-400 text-[10px]">00:01:26 --> 00:01:29</div>
          <div>반갑습니다</div>
        </div>
      </div>

      {/* Center Icon */}
      <div className="bg-white flex items-center justify-center w-8 border-r border-slate-200 z-10">
        <MoveRight className="w-4 h-4 text-indigo-500" />
      </div>

      {/* TXT Side */}
      <div className="flex-1 bg-white p-4 flex flex-col gap-2">
        <div className="flex items-center gap-1.5 text-indigo-600 mb-1">
          <AlignLeft className="w-3 h-3" />
          <span className="font-mono text-[10px] font-bold">PLAIN TEXT</span>
        </div>
        <div className="font-medium text-slate-800 leading-relaxed flex flex-col gap-3 pt-0.5">
          <div className="bg-indigo-50 px-2 py-1 rounded w-fit">안녕하세요</div>
          <div className="bg-indigo-50 px-2 py-1 rounded w-fit">반갑습니다</div>
        </div>
      </div>
    </div>
  );
};
