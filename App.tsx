
import React, { useState, useCallback, useEffect } from 'react';
import { ArrowRightLeft, Monitor, Apple, Sparkles, Info, Laptop, FileText, Video, AlignLeft, Text, Settings2, Eye } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { clsx } from 'clsx';

import { DropZone } from './components/DropZone';
import { FileItem } from './components/FileItem';
import { PremiereFixerVisual, TextReformatVisual, TextExtractVisual } from './components/VisualExamples'; 
import { ConversionMode, FileStatus, ProcessedFile, AppTab, TextProcessMode } from './types';
import { fixProjectFile } from './services/projectFixer';
import { processTextFile, generatePreview } from './services/srtService';

export default function App() {
  const [activeTab, setActiveTab] = useState<AppTab>(AppTab.FIXER);
  const [conversionMode, setConversionMode] = useState<ConversionMode>(ConversionMode.MAC_TO_WIN);
  const [textProcessMode, setTextProcessMode] = useState<TextProcessMode>(TextProcessMode.REFORMAT);
  const [configMinLength, setConfigMinLength] = useState<number>(10);
  const [configMaxLength, setConfigMaxLength] = useState<number>(32);
  const [files, setFiles] = useState<ProcessedFile[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [previewContent, setPreviewContent] = useState<string>("");

  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      setInstallPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  // Preview Effect
  useEffect(() => {
    // Only generate preview if we are in SRT tab and have pending files
    if (activeTab !== AppTab.SRT) return;

    const pendingFile = files.find(f => f.status === FileStatus.PENDING);
    if (!pendingFile) {
      setPreviewContent("");
      return;
    }

    const timer = setTimeout(async () => {
      const result = await generatePreview(
        pendingFile.file, 
        textProcessMode, 
        { minLength: configMinLength, maxLength: configMaxLength }
      );
      setPreviewContent(result);
    }, 200); // Debounce

    return () => clearTimeout(timer);
  }, [files, activeTab, textProcessMode, configMinLength, configMaxLength]);

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
          // SRT/TXT 처리
          const config = { minLength: configMinLength, maxLength: configMaxLength };
          const result = await processTextFile(newFiles[index].file, textProcessMode, config);
          resultBlob = result.blob;
          resultCount = result.count;
          
          const isInputSrt = newFiles[index].originalName.toLowerCase().endsWith('.srt');

          if (textProcessMode === TextProcessMode.EXTRACT_TEXT) {
            successMsg = `텍스트 추출 완료 (${resultCount}줄)`;
            ext = ".txt";
          } else {
             if (isInputSrt) {
               successMsg = `SRT 정리 완료 (${resultCount}줄)`;
               ext = ".srt";
             } else {
               successMsg = `텍스트 정리 완료 (${resultCount}줄)`;
               ext = ".txt";
             }
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
      
      // Reduce delay to 50ms for faster batch processing while keeping UI responsive
      await new Promise(r => setTimeout(r, 50));
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
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Media Assistant</h1>
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
              텍스트/자막 도구
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

            <PremiereFixerVisual />

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
              <h2 className="text-2xl sm:text-3xl font-bold text-slate-900">텍스트 가독성 최적화</h2>
              <p className="text-slate-500 text-base sm:text-lg max-w-xl mx-auto">
                자막 파일의 타임코드를 제거하거나, 텍스트의 줄바꿈을 지정된 길이에 맞춰 자동으로 재정렬합니다.
              </p>
            </div>

            {/* Preview Section vs Static Visuals */}
            {previewContent ? (
              <div className="w-full max-w-lg mx-auto my-6 text-left shadow-lg rounded-xl overflow-hidden border border-slate-200">
                 <div className="bg-slate-800 text-slate-300 text-xs px-4 py-2 flex items-center justify-between">
                   <div className="flex items-center gap-2">
                     <Eye className="w-3.5 h-3.5" />
                     <span className="font-semibold tracking-wide">실시간 미리보기</span>
                   </div>
                   <span className="text-[10px] opacity-70">
                     {files.filter(f => f.status === FileStatus.PENDING).length > 1 
                       ? "첫 번째 파일 예시 (일부)" 
                       : "변환 예시 (일부)"}
                   </span>
                 </div>
                 <div className="bg-slate-900 p-4 overflow-x-auto">
                   <pre className="text-sm font-mono text-slate-200 whitespace-pre-wrap leading-relaxed">
                     {previewContent}
                   </pre>
                 </div>
                 {files.filter(f => f.status === FileStatus.PENDING).length > 1 && (
                   <div className="bg-slate-50 px-4 py-2 text-[10px] text-slate-500 text-right border-t border-slate-200">
                     * 여러 파일 중 첫 번째 파일만 미리보기에 표시됩니다.
                   </div>
                 )}
              </div>
            ) : (
              textProcessMode === TextProcessMode.REFORMAT ? <TextReformatVisual /> : <TextExtractVisual />
            )}

            <div className="inline-flex bg-white p-1.5 rounded-2xl shadow-sm border border-slate-200">
              <button
                onClick={() => setTextProcessMode(TextProcessMode.REFORMAT)}
                className={`flex items-center gap-2 px-4 py-2 sm:px-6 sm:py-3 rounded-xl text-sm font-semibold transition-all duration-200 ${
                  textProcessMode === TextProcessMode.REFORMAT
                    ? 'bg-indigo-600 text-white shadow-md transform scale-105'
                    : 'text-slate-500 hover:bg-slate-50'
                }`}
              >
                <Text className="w-4 h-4" />
                <span>줄바꿈 재정렬 (포맷 유지)</span>
              </button>
              <button
                onClick={() => setTextProcessMode(TextProcessMode.EXTRACT_TEXT)}
                className={`flex items-center gap-2 px-4 py-2 sm:px-6 sm:py-3 rounded-xl text-sm font-semibold transition-all duration-200 ${
                  textProcessMode === TextProcessMode.EXTRACT_TEXT
                    ? 'bg-indigo-600 text-white shadow-md transform scale-105'
                    : 'text-slate-500 hover:bg-slate-50'
                }`}
              >
                <AlignLeft className="w-4 h-4" />
                <span>순수 텍스트 추출</span>
              </button>
            </div>

            {/* Config Sliders for Reformat Mode */}
            {textProcessMode === TextProcessMode.REFORMAT && (
              <div className="max-w-md mx-auto mt-4 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-6 text-left">
                <div className="flex items-center gap-2 text-slate-800 font-semibold mb-4 border-b border-slate-100 pb-2">
                  <Settings2 className="w-5 h-5 text-indigo-500" />
                  <span>설정 (줄바꿈 최적화)</span>
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between items-center text-sm">
                    <label htmlFor="minLen" className="text-slate-600 font-medium">최소 병합 길이</label>
                    <span className="bg-slate-100 px-2 py-0.5 rounded text-indigo-600 font-bold">{configMinLength}자</span>
                  </div>
                  <input
                    id="minLen"
                    type="range"
                    min="1"
                    max="50"
                    value={configMinLength}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      if (val <= configMaxLength) setConfigMinLength(val);
                    }}
                    className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                  />
                  <p className="text-xs text-slate-400">이보다 짧은 문장은 앞뒤 문맥을 고려하여 자동으로 병합합니다.</p>
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between items-center text-sm">
                    <label htmlFor="maxLen" className="text-slate-600 font-medium">최대 줄바꿈 길이</label>
                    <span className="bg-slate-100 px-2 py-0.5 rounded text-indigo-600 font-bold">{configMaxLength}자</span>
                  </div>
                  <input
                    id="maxLen"
                    type="range"
                    min="1"
                    max="50"
                    value={configMaxLength}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      if (val >= configMinLength) setConfigMaxLength(val);
                    }}
                    className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                  />
                  <p className="text-xs text-slate-400">이보다 긴 문장은 가독성을 위해 적절한 위치에서 줄바꿈합니다.</p>
                </div>
              </div>
            )}
          </section>
        )}

        {/* Dropzone */}
        <section className="animate-in fade-in slide-in-from-bottom-8 duration-500 fill-mode-backwards delay-100">
          <DropZone 
            onFilesDropped={handleFilesDropped}
            acceptExtension={activeTab === AppTab.FIXER ? ".prproj" : ".srt,.txt"}
            title={activeTab === AppTab.FIXER ? ".prproj 파일을 이곳에 놓으세요" : ".srt 또는 .txt 파일을 이곳에 놓으세요"}
            subTitle="클릭하여 파일 탐색기에서 선택 가능"
            fileTypeLabel={activeTab === AppTab.FIXER ? "Adobe Premiere Project" : "자막 또는 텍스트 파일"}
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
                  disabled={isProcessing}
                  className={`text-xs px-3 py-2 transition-colors rounded-lg ${
                    isProcessing 
                      ? 'text-slate-300 cursor-not-allowed' 
                      : 'text-slate-400 hover:text-red-500 hover:bg-slate-50'
                  }`}
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
                        {activeTab === AppTab.FIXER ? "변환 시작" : (textProcessMode === TextProcessMode.EXTRACT_TEXT ? "추출 시작" : "정리 시작")}
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
