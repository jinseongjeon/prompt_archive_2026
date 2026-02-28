
import React, { useState, useRef, useEffect } from 'react';
import { Post } from '../types';

interface PostCardProps {
  post: Post;
  onClick: (post: Post) => void;
  onEdit: (post: Post) => void;
  onDelete: (id: string) => void;
}

const PostCard: React.FC<PostCardProps> = ({ post, onClick, onEdit, onDelete }) => {
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="flex flex-col gap-3 group">
      {/* Image Container */}
      <div
        onClick={() => onClick(post)}
        className="relative aspect-[3/4] overflow-hidden rounded-xl bg-neutral-900 cursor-pointer"
      >
        <img
          src={post.images[0]}
          alt={post.title}
          loading="lazy"
          className="h-full w-full object-cover opacity-100 transition-transform duration-700 ease-out group-hover:scale-110"
        />
        {post.isAIPending && (
          <div className="absolute top-2 right-2 px-2 py-0.5 bg-black/60 backdrop-blur-md rounded-full border border-white/10 flex items-center gap-1.5">
            <div className="w-1 h-1 bg-neutral-400 rounded-full animate-pulse" />
            <span className="text-[8px] font-semibold text-neutral-400 uppercase">Processing</span>
          </div>
        )}
      </div>

      <div className="px-1 flex justify-between items-start gap-1 md:gap-3 relative min-h-[40px] md:min-h-[48px]">
        <div className="flex-1 min-w-0" onClick={() => onClick(post)}>
          <h3 className="text-xs md:text-base font-semibold text-neutral-200 leading-5 md:leading-6 line-clamp-2 cursor-pointer transition-colors group-hover:text-white">
            {post.title}
          </h3>
        </div>

        <div ref={menuRef} className="relative shrink-0 flex items-center h-6">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowMenu(!showMenu);
            }}
            className="p-1 text-neutral-600 hover:text-neutral-300 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="currentColor" viewBox="0 0 16 16">
              <path d="M3 9.5a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm5 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm5 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3z" />
            </svg>
          </button>

          {showMenu && (
            <div className="absolute right-0 top-full mt-1 w-24 bg-neutral-900 border border-neutral-800 rounded-lg shadow-2xl z-[50] overflow-hidden py-1 animate-in fade-in slide-in-from-top-1 duration-200">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(post);
                  setShowMenu(false);
                }}
                className="w-full px-3 py-2 text-[10px] text-left text-neutral-300 hover:bg-neutral-800 font-semibold transition-colors"
              >
                Edit
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(post.id);
                  setShowMenu(false);
                }}
                className="w-full px-3 py-2 text-[10px] text-left text-red-400 hover:bg-neutral-800 font-semibold transition-colors"
              >
                Delete
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PostCard;
