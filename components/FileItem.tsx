
import React from 'react';
import { FileVideo, Loader2, AlertCircle, Download, Trash2, FileText } from 'lucide-react';
import { ProcessedFile, FileStatus } from '../types';

interface FileItemProps {
  item: ProcessedFile;
  onRemove: (id: string) => void;
}

export const FileItem: React.FC<FileItemProps> = ({ item, onRemove }) => {
  // 파일 확장자에 따라 아이콘 변경
  const isSrt = item.originalName.toLowerCase().endsWith('.srt');
  // outputExtension이 있으면 그것을 사용, 없으면 기존 로직
  const extension = item.outputExtension || (isSrt ? '.txt' : '');
  const downloadPrefix = isSrt 
    ? (extension === '.srt' ? 'FIXED_' : 'TEXT_')
    : 'FIXED_';

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center justify-between shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center gap-4 overflow-hidden">
        <div className={`p-2 rounded-lg ${
          item.status === FileStatus.COMPLETED ? 'bg-green-100 text-green-600' :
          item.status === FileStatus.ERROR ? 'bg-red-100 text-red-600' :
          'bg-slate-100 text-slate-500'
        }`}>
          {isSrt ? <FileText className="w-6 h-6" /> : <FileVideo className="w-6 h-6" />}
        </div>
        
        <div className="min-w-0">
          <h4 className="font-medium text-slate-800 truncate max-w-[200px] sm:max-w-xs">
            {item.originalName}
          </h4>
          <div className="flex items-center gap-2 text-xs">
             {item.status === FileStatus.PENDING && <span className="text-slate-400">대기 중</span>}
             {item.status === FileStatus.PROCESSING && <span className="text-indigo-500">처리 중...</span>}
             {item.status === FileStatus.COMPLETED && (
               <span className="text-green-600">
                 {item.resultMessage || "완료"}
               </span>
             )}
             {item.status === FileStatus.ERROR && <span className="text-red-500">실패</span>}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {item.status === FileStatus.PROCESSING && (
          <Loader2 className="w-5 h-5 text-indigo-500 animate-spin" />
        )}
        
        {item.status === FileStatus.COMPLETED && item.downloadUrl && (
          <a
            href={item.downloadUrl}
            download={`${downloadPrefix}${item.originalName.replace(/\.srt$/i, '')}${extension}`}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
          >
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">다운로드</span>
          </a>
        )}

        {item.status === FileStatus.ERROR && (
          <div className="group relative">
            <AlertCircle className="w-5 h-5 text-red-500 cursor-help" />
            <div className="absolute right-0 top-8 w-48 p-2 bg-red-800 text-white text-xs rounded shadow-lg hidden group-hover:block z-10">
              {item.errorMessage}
            </div>
          </div>
        )}

        <button
          onClick={() => onRemove(item.id)}
          className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
          title="목록에서 제거"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};