import pako from 'pako';
import { ConversionMode } from '../types';

/**
 * Fixes the encoding issues in a .prproj file by normalizing Unicode strings.
 * 
 * .prproj files are typically GZIP compressed XML files.
 * Mac uses NFD (Decomposed) - e.g., ㅎ+ㅏ+ㄴ
 * Windows uses NFC (Composed) - e.g., 한
 */
export const fixProjectFile = async (
  file: File, 
  mode: ConversionMode
): Promise<{ blob: Blob; count: number }> => {
  
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        if (!event.target?.result) throw new Error("File read failed");
        
        const arrayBuffer = event.target.result as ArrayBuffer;
        const uint8Array = new Uint8Array(arrayBuffer);
        
        // Check for GZIP signature (1F 8B)
        const isGzipped = uint8Array[0] === 0x1f && uint8Array[1] === 0x8b;

        let xmlContent: string;
        
        if (isGzipped) {
          try {
            // Decompress
            const decompressed = pako.ungzip(uint8Array);
            xmlContent = new TextDecoder('utf-8').decode(decompressed);
          } catch (e) {
            throw new Error("Failed to decompress project file. It might be corrupted.");
          }
        } else {
          // Treat as plain XML
          xmlContent = new TextDecoder('utf-8').decode(uint8Array);
        }

        // Perform Normalization
        // We compare the original string length/content to count changes roughly
        const originalLength = xmlContent.length; // Proxy for change detection
        
        let fixedXml = '';
        const targetForm = mode === ConversionMode.MAC_TO_WIN ? 'NFC' : 'NFD';
        
        // Normalize the entire XML content. 
        // This is generally safe for XML text content and fixes file paths embedded in tags.
        fixedXml = xmlContent.normalize(targetForm);

        // Calculate a rough "fixed" score. 
        // Exact count of changed paths is hard without full DOM parsing, 
        // but we can check if string identity changed.
        const hasChanges = fixedXml !== xmlContent;
        const changeScore = hasChanges ? 1 : 0; // Simplification for the UI

        // Re-compress
        const encoder = new TextEncoder();
        const fixedData = encoder.encode(fixedXml);
        
        let outputData: Uint8Array;

        if (isGzipped) {
          outputData = pako.gzip(fixedData);
        } else {
          outputData = fixedData;
        }

        const fixedBlob = new Blob([outputData], { type: 'application/x-premiere-service' });
        
        resolve({ blob: fixedBlob, count: changeScore });

      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsArrayBuffer(file);
  });
};