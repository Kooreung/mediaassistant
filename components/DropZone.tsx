import React, { useCallback } from 'react';
import { Upload, FileType, FileText } from 'lucide-react';
import { clsx } from 'clsx';

interface DropZoneProps {
  onFilesDropped: (files: File[]) => void;
  acceptExtension: string; // 예: ".prproj" 또는 ".srt,.txt"
  title: string;
  subTitle: string;
  fileTypeLabel: string;
}

export const DropZone: React.FC<DropZoneProps> = ({ 
  onFilesDropped, 
  acceptExtension,
  title,
  subTitle,
  fileTypeLabel
}) => {
  const getExtensions = useCallback(() => {
    return acceptExtension.split(',').map(ext => ext.trim().toLowerCase());
  }, [acceptExtension]);

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      
      const extensions = getExtensions();
      const droppedFiles = Array.from(e.dataTransfer.files).filter(
        (file: File) => extensions.some(ext => file.name.toLowerCase().endsWith(ext))
      );
      
      if (droppedFiles.length > 0) {
        onFilesDropped(droppedFiles);
      }
    },
    [onFilesDropped, getExtensions]
  );

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const extensions = getExtensions();
      const selectedFiles = Array.from(e.target.files).filter(
        (file: File) => extensions.some(ext => file.name.toLowerCase().endsWith(ext))
      );
      onFilesDropped(selectedFiles);
    }
  };

  const isTextMode = acceptExtension.includes('.srt') || acceptExtension.includes('.txt');

  return (
    <div
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      className={clsx(
        "border-2 border-dashed border-indigo-200 rounded-2xl p-10 text-center cursor-pointer transition-all duration-200",
        "hover:border-indigo-500 hover:bg-indigo-50/50 group"
      )}
    >
      <input
        type="file"
        multiple
        accept={acceptExtension}
        className="hidden"
        id="fileInput"
        onChange={handleFileInput}
      />
      <label htmlFor="fileInput" className="cursor-pointer flex flex-col items-center justify-center gap-4">
        <div className="bg-indigo-100 p-4 rounded-full group-hover:scale-110 transition-transform duration-200">
          {isTextMode ? (
            <FileText className="w-8 h-8 text-indigo-600" />
          ) : (
            <Upload className="w-8 h-8 text-indigo-600" />
          )}
        </div>
        <div className="space-y-1">
          <p className="text-lg font-semibold text-slate-700">
            {title}
          </p>
          <p className="text-sm text-slate-500">
            {subTitle}
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-400 mt-2 bg-slate-100 px-3 py-1 rounded-full">
          <FileType className="w-3 h-3" />
          <span>{fileTypeLabel}</span>
        </div>
      </label>
    </div>
  );
};