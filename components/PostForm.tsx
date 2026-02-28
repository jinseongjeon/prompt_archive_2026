import React, { useState, useRef, useEffect } from 'react';
import { PostFormValues, Post } from '../types';
import { optimizeImage } from '../utils/imageUtils';

interface PostFormProps {
  onSubmit: (values: PostFormValues) => Promise<void>;
  onClose: () => void;
  isSubmitting: boolean;
  initialData?: Post | null;
}

interface ImageItem {
  id: string;
  preview: string;
  file?: File;
}

const PostForm: React.FC<PostFormProps> = ({ onSubmit, onClose, isSubmitting, initialData }) => {
  const [title, setTitle] = useState('');
  const [prompt, setPrompt] = useState('');
  const [imageItems, setImageItems] = useState<ImageItem[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [draggedImageIndex, setDraggedImageIndex] = useState<number | null>(null);
  const [dragOverImageIndex, setDragOverImageIndex] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (initialData) {
      setTitle(initialData.title);
      setPrompt(initialData.prompt);
      const initialItems: ImageItem[] = initialData.images.map((img) => ({
        id: crypto.randomUUID(),
        preview: img,
      }));
      setImageItems(initialItems);
    }
  }, [initialData]);

  const handleFiles = (files: File[]) => {
    const validImageFiles = files.filter(file => file.type.startsWith('image/'));

    if (imageItems.length + validImageFiles.length > 5) {
      alert("Maximum 5 images allowed");
      return;
    }

    const newItems: ImageItem[] = validImageFiles.map(file => ({
      id: crypto.randomUUID(),
      preview: URL.createObjectURL(file),
      file,
    }));

    setImageItems(prev => [...prev, ...newItems]);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []) as File[];
    handleFiles(files);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!isSubmitting) setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (isSubmitting) return;

    const files = Array.from(e.dataTransfer.files) as File[];
    handleFiles(files);
  };

  const removeImage = (index: number) => {
    setImageItems(prev => {
      const item = prev[index];
      if (item.file) {
        URL.revokeObjectURL(item.preview);
      }
      const newItems = [...prev];
      newItems.splice(index, 1);
      return newItems;
    });
  };

  const handleImageDragStart = (idx: number) => {
    setDraggedImageIndex(idx);
  };

  const handleImageDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    setDragOverImageIndex(idx);
  };

  const handleImageDrop = (e: React.DragEvent, targetIdx: number) => {
    e.preventDefault();
    if (draggedImageIndex === null || draggedImageIndex === targetIdx) {
      setDraggedImageIndex(null);
      setDragOverImageIndex(null);
      return;
    }

    const updatedItems = [...imageItems];
    const [draggedItem] = updatedItems.splice(draggedImageIndex, 1);
    updatedItems.splice(targetIdx, 0, draggedItem);

    setImageItems(updatedItems);
    setDraggedImageIndex(null);
    setDragOverImageIndex(null);
  };

  const handlePostSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !prompt.trim() || imageItems.length === 0) return;

    try {
      const finalImages: string[] = await Promise.all(
        imageItems.map(async (item) => {
          if (item.file) {
            return await optimizeImage(item.file);
          }
          return item.preview;
        })
      );

      await onSubmit({ title, prompt, files: [], imageStrings: finalImages });
      // Clear blob URLs to prevent memory leaks
      imageItems.forEach(item => {
        if (item.file && item.preview.startsWith('blob:')) {
          URL.revokeObjectURL(item.preview);
        }
      });
      onClose();
    } catch (error) {
      console.error("Optimization failed:", error);
      alert("이미지 처리 중 오류가 발생했습니다.");
    }
  };

  return (
    <div className="bg-neutral-900 rounded-2xl md:rounded-3xl p-6 md:p-8 shadow-2xl w-full max-w-lg mx-auto overflow-hidden animate-in fade-in zoom-in duration-300">
      <div className="flex justify-between items-center mb-6 md:mb-8">
        <h2 className="text-lg md:text-xl font-normal text-neutral-100">{initialData ? 'Edit Prompt' : 'Upload Prompt'}</h2>
        <button
          onClick={onClose}
          className="text-neutral-500 hover:text-neutral-200 transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 md:h-6 md:w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <form onSubmit={handlePostSubmit} className="space-y-8">
        <div>
          <label className="block text-[10px] font-semibold text-neutral-500 mb-2">Title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Archive Title..."
            className="w-full bg-neutral-950 rounded-xl p-4 text-sm text-neutral-200 focus:outline-none transition-all placeholder:text-neutral-700"
            disabled={isSubmitting}
          />
        </div>

        <div>
          <label className="block text-[10px] font-semibold text-neutral-500 mb-2">Prompt</label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Document your vision..."
            className="w-full bg-neutral-950 rounded-2xl p-5 text-sm text-neutral-200 focus:outline-none transition-all min-h-[100px] resize-none placeholder:text-neutral-700"
            disabled={isSubmitting}
          />
        </div>

        <div>
          <label className="block text-[10px] font-semibold text-neutral-500 mb-2">
            Output Example ({imageItems.length}/5)
          </label>
          <div
            className={`grid grid-cols-5 gap-3 p-4 rounded-2xl border border-neutral-800 transition-all ${isDragging ? 'bg-neutral-800/50' : 'bg-transparent'
              }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            {imageItems.map((item, idx) => (
              <div
                key={item.id}
                className={`relative aspect-square rounded-xl overflow-hidden group shadow-lg cursor-grab active:cursor-grabbing transition-all duration-300 border-2 ${dragOverImageIndex === idx && draggedImageIndex !== idx
                  ? 'border-white/50 scale-105 z-10'
                  : 'border-transparent'
                  } ${draggedImageIndex === idx ? 'opacity-30' : 'opacity-100'}`}
                draggable
                onDragStart={() => handleImageDragStart(idx)}
                onDragOver={(e) => handleImageDragOver(e, idx)}
                onDrop={(e) => handleImageDrop(e, idx)}
                onDragEnd={() => {
                  setDraggedImageIndex(null);
                  setDragOverImageIndex(null);
                }}
              >
                <img src={item.preview} alt="Preview" className="w-full h-full object-cover opacity-80" />
                <button
                  type="button"
                  onClick={() => removeImage(idx)}
                  className="absolute inset-0 bg-neutral-950/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
            ))}
            {imageItems.length < 5 && (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isSubmitting}
                className="aspect-square bg-neutral-950 rounded-xl flex items-center justify-center hover:bg-neutral-800 transition-all text-neutral-600 hover:text-neutral-400"
              >
                <div className="flex flex-col items-center gap-1">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
                  </svg>
                </div>
              </button>
            )}
          </div>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept="image/*"
            multiple
            className="hidden"
          />
        </div>

        <button
          type="submit"
          disabled={isSubmitting || imageItems.length === 0 || !prompt.trim() || !title.trim()}
          className={`w-full py-4 rounded-2xl text-xs font-semibold transition-all ${isSubmitting
            ? 'bg-neutral-800 text-neutral-600 cursor-not-allowed'
            : 'bg-white text-black hover:bg-neutral-200'
            }`}
        >
          {isSubmitting ? 'Uploading...' : initialData ? 'Update' : 'Upload'}
        </button>
      </form>
    </div>
  );
};

export default PostForm;
