
import React, { useState, useCallback, useEffect } from 'react';
import { ArrowRightLeft, Monitor, Apple, Sparkles, Info, Laptop, FileText, Video, AlignLeft, Text } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { clsx } from 'clsx';

import { DropZone } from './components/DropZone';
import { FileItem } from './components/FileItem';
import { ConversionMode, FileStatus, ProcessedFile, AppTab, SrtMode } from './types';
import { fixProjectFile } from './services/projectFixer';
import { processSrtFile } from './services/srtService';

export default function App() {
  const [activeTab, setActiveTab] = useState<AppTab>(AppTab.FIXER);
  const [conversionMode, setConversionMode] = useState<ConversionMode>(ConversionMode.MAC_TO_WIN);
  const [srtMode, setSrtMode] = useState<SrtMode>(SrtMode.REFORMAT_32); // Default to Reformat
  const [files, setFiles] = useState<ProcessedFile[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<any>(null);

  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      setInstallPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallClick = () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    installPrompt.userChoice.then((choiceResult: any) => {
      if (choiceResult.outcome === 'accepted') {
        setInstallPrompt(null);
      }
    });
  };

  // 탭 변경 시 파일 목록 초기화
  const handleTabChange = (tab: AppTab) => {
    if (files.length > 0) {
      if (confirm('탭을 변경하면 현재 작업 목록이 초기화됩니다. 계속하시겠습니까?')) {
        setFiles([]);
        setActiveTab(tab);
      }
    } else {
      setActiveTab(tab);
    }
  };

  const handleFilesDropped = useCallback((newFiles: File[]) => {
    const mappedFiles = newFiles.map((file) => ({
      id: uuidv4(),
      originalName: file.name,
      file,
      status: FileStatus.PENDING,
    }));
    setFiles((prev) => [...prev, ...mappedFiles]);
  }, []);

  const removeFile = (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const clearAll = () => {
    if(window.confirm('모든 작업을 초기화하시겠습니까?')) {
      setFiles([]);
    }
  }

  const handleProcess = async () => {
    setIsProcessing(true);

    const newFiles = [...files];
    const pendingIndices = newFiles
      .map((f, i) => (f.status === FileStatus.PENDING ? i : -1))
      .filter((i) => i !== -1);

    for (const index of pendingIndices) {
      newFiles[index].status = FileStatus.PROCESSING;
      setFiles([...newFiles]);

      try {
        let resultBlob: Blob;
        let resultCount: number;
        let successMsg = "완료";
        let ext = "";

        if (activeTab === AppTab.FIXER) {
          const result = await fixProjectFile(newFiles[index].file, conversionMode);
          resultBlob = result.blob;
          resultCount = result.count;
          successMsg = "변환 완료 (인코딩 수정됨)";
          ext = ".prproj"; 
        } else {
          // SRT 처리
          const result = await processSrtFile(newFiles[index].file, srtMode);
          resultBlob = result.blob;
          resultCount = result.count;
          
          if (srtMode === SrtMode.EXTRACT_ONLY) {
            successMsg = `텍스트 추출 완료 (${resultCount}줄)`;
            ext = ".txt";
          } else {
             successMsg = `SRT 정리 완료 (${resultCount}줄)`;
             ext = ".srt";
          }
        }
        
        const url = URL.createObjectURL(resultBlob);
        newFiles[index].status = FileStatus.COMPLETED;
        newFiles[index].downloadUrl = url;
        newFiles[index].fixedCount = resultCount;
        newFiles[index].blob = resultBlob;
        newFiles[index].resultMessage = successMsg;
        newFiles[index].outputExtension = ext;

      } catch (error: any) {
        newFiles[index].status = FileStatus.ERROR;
        newFiles[index].errorMessage = error.message || "Unknown error";
      }
      
      await new Promise(r => setTimeout(r, 300));
      setFiles([...newFiles]);
    }

    setIsProcessing(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-20 select-none">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10 draggable-region">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-600 p-2 rounded-lg shadow-sm">
              <ArrowRightLeft className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Media Tools</h1>
          </div>
          <div className="flex items-center gap-3">
            {installPrompt && (
              <button 
                onClick={handleInstallClick}
                className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-slate-100 text-slate-600 rounded-full text-xs font-medium hover:bg-slate-200 transition-colors"
              >
                <Laptop className="w-3.5 h-3.5" />
                앱으로 설치
              </button>
            )}
            <div className="flex items-center gap-4 text-sm text-slate-500">
              <div className="hover:text-indigo-600 transition-colors cursor-help" title="로컬 브라우저에서 안전하게 처리됩니다">
                <Info className="w-5 h-5" />
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-8">
        
        {/* Tab Navigation */}
        <div className="flex justify-center">
          <div className="bg-white p-1 rounded-xl shadow-sm border border-slate-200 inline-flex">
            <button
              onClick={() => handleTabChange(AppTab.FIXER)}
              className={clsx(
                "flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all",
                activeTab === AppTab.FIXER 
                  ? "bg-indigo-50 text-indigo-700" 
                  : "text-slate-500 hover:bg-slate-50 hover:text-slate-700"
              )}
            >
              <Video className="w-4 h-4" />
              Premiere 복구
            </button>
            <button
              onClick={() => handleTabChange(AppTab.SRT)}
              className={clsx(
                "flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all",
                activeTab === AppTab.SRT 
                  ? "bg-indigo-50 text-indigo-700" 
                  : "text-slate-500 hover:bg-slate-50 hover:text-slate-700"
              )}
            >
              <FileText className="w-4 h-4" />
              SRT 관리
            </button>
          </div>
        </div>

        {/* Conditional Intro / Controls */}
        {activeTab === AppTab.FIXER ? (
          <section className="space-y-6 text-center animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className="space-y-2">
              <h2 className="text-2xl sm:text-3xl font-bold text-slate-900">프로젝트 파일 호환성 복구</h2>
              <p className="text-slate-500 text-base sm:text-lg">
                Mac/Win 간 한글 자소 분리(NFD ↔ NFC) 문제를 해결합니다.
              </p>
            </div>

            <div className="inline-flex bg-white p-1.5 rounded-2xl shadow-sm border border-slate-200">
              <button
                onClick={() => setConversionMode(ConversionMode.MAC_TO_WIN)}
                className={`flex items-center gap-2 px-4 py-2 sm:px-6 sm:py-3 rounded-xl text-sm font-semibold transition-all duration-200 ${
                  conversionMode === ConversionMode.MAC_TO_WIN
                    ? 'bg-indigo-600 text-white shadow-md transform scale-105'
                    : 'text-slate-500 hover:bg-slate-50'
                }`}
              >
                <Apple className="w-4 h-4" />
                <span>Mac</span>
                <ArrowRightLeft className="w-3 h-3 opacity-50" />
                <Monitor className="w-4 h-4" />
                <span>Windows</span>
              </button>
              <button
                onClick={() => setConversionMode(ConversionMode.WIN_TO_MAC)}
                className={`flex items-center gap-2 px-4 py-2 sm:px-6 sm:py-3 rounded-xl text-sm font-semibold transition-all duration-200 ${
                  conversionMode === ConversionMode.WIN_TO_MAC
                    ? 'bg-indigo-600 text-white shadow-md transform scale-105'
                    : 'text-slate-500 hover:bg-slate-50'
                }`}
              >
                <Monitor className="w-4 h-4" />
                <span>Windows</span>
                <ArrowRightLeft className="w-3 h-3 opacity-50" />
                <Apple className="w-4 h-4" />
                <span>Mac</span>
              </button>
            </div>
          </section>
        ) : (
          <section className="space-y-6 text-center animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className="space-y-2">
              <h2 className="text-2xl sm:text-3xl font-bold text-slate-900">자막 파일(SRT) 관리</h2>
              <p className="text-slate-500 text-base sm:text-lg">
                타임코드 제거 및 가독성을 위한 문장 자동 줄바꿈 기능을 제공합니다.
              </p>
            </div>

             <div className="inline-flex bg-white p-1.5 rounded-2xl shadow-sm border border-slate-200">
              <button
                onClick={() => setSrtMode(SrtMode.REFORMAT_32)}
                className={`flex items-center gap-2 px-4 py-2 sm:px-6 sm:py-3 rounded-xl text-sm font-semibold transition-all duration-200 ${
                  srtMode === SrtMode.REFORMAT_32
                    ? 'bg-indigo-600 text-white shadow-md transform scale-105'
                    : 'text-slate-500 hover:bg-slate-50'
                }`}
              >
                <Text className="w-4 h-4" />
                <span>줄바꿈 정리 (SRT 유지)</span>
              </button>
              <button
                onClick={() => setSrtMode(SrtMode.EXTRACT_ONLY)}
                className={`flex items-center gap-2 px-4 py-2 sm:px-6 sm:py-3 rounded-xl text-sm font-semibold transition-all duration-200 ${
                  srtMode === SrtMode.EXTRACT_ONLY
                    ? 'bg-indigo-600 text-white shadow-md transform scale-105'
                    : 'text-slate-500 hover:bg-slate-50'
                }`}
              >
                <AlignLeft className="w-4 h-4" />
                <span>단순 텍스트 추출</span>
              </button>
            </div>
          </section>
        )}

        {/* Dropzone */}
        <section className="animate-in fade-in slide-in-from-bottom-8 duration-500 fill-mode-backwards delay-100">
          <DropZone 
            onFilesDropped={handleFilesDropped}
            acceptExtension={activeTab === AppTab.FIXER ? ".prproj" : ".srt"}
            title={activeTab === AppTab.FIXER ? ".prproj 파일을 이곳에 놓으세요" : ".srt 파일을 이곳에 놓으세요"}
            subTitle="클릭하여 파일 탐색기에서 선택 가능"
            fileTypeLabel={activeTab === AppTab.FIXER ? "Adobe Premiere Project" : "SubRip Subtitle File"}
          />
        </section>

        {/* File List */}
        {files.length > 0 && (
          <section className="space-y-4 animate-in fade-in slide-in-from-bottom-8 duration-500 fill-mode-backwards delay-200">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                작업 목록 
                <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full text-xs">{files.length}</span>
              </h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={clearAll}
                  className="text-xs text-slate-400 hover:text-red-500 px-3 py-2 transition-colors"
                >
                  목록 비우기
                </button>
                {files.some(f => f.status === FileStatus.PENDING) && (
                  <button
                    onClick={handleProcess}
                    disabled={isProcessing}
                    className={`px-5 py-2 rounded-lg font-medium text-sm transition-colors flex items-center gap-2 ${
                      isProcessing 
                        ? 'bg-slate-100 text-slate-400 cursor-not-allowed' 
                        : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-md hover:shadow-lg'
                    }`}
                  >
                    {isProcessing ? (
                      <>
                        <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                        처리 중...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        {activeTab === AppTab.FIXER ? "변환 시작" : (srtMode === SrtMode.EXTRACT_ONLY ? "추출 시작" : "정리 시작")}
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
            
            <div className="space-y-3">
              {files.map((file) => (
                <FileItem key={file.id} item={file} onRemove={removeFile} />
              ))}
            </div>
          </section>
        )}
        
        <section className="text-center text-xs text-slate-400 mt-10">
          <p>서버로 파일이 전송되지 않으며, 브라우저 내에서 안전하게 처리됩니다.</p>
        </section>
      </main>
    </div>
  );
}
