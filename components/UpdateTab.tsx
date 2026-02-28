
import React, { useState } from 'react';
import { Post } from '../types';
import { generateAIInsight } from '../services/gemini';
import { updatePost } from '../services/storage';

interface UpdateTabProps {
  posts: Post[];
  setPosts: React.Dispatch<React.SetStateAction<Post[]>>;
}

const UpdateTab: React.FC<UpdateTabProps> = ({ posts, setPosts }) => {
  const [isUpdating, setIsUpdating] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: posts.length });
  const [logs, setLogs] = useState<string[]>([]);

  const startBatchUpdate = async () => {
    if (posts.length === 0) {
      alert("No posts to update.");
      return;
    }

    setIsUpdating(true);
    setLogs(["Starting batch update..."]);
    setProgress({ current: 0, total: posts.length });

    const updatedPostsList = [...posts];

    for (let i = 0; i < updatedPostsList.length; i++) {
      const post = updatedPostsList[i];
      setProgress(prev => ({ ...prev, current: i + 1 }));
      setLogs(prev => [`Updating: ${post.title} (${i + 1}/${posts.length})`, ...prev.slice(0, 9)]);

      try {
        const aiResponse = await generateAIInsight(post.prompt, post.images);
        const updatedPost: Post = {
          ...post,
          aiInsight: aiResponse.insight,
          originalityAnalysis: aiResponse.originality,
          categorizedSentences: aiResponse.sentences,
          isAIPending: false
        };

        await updatePost(updatedPost);

        // Update state immediately for visual feedback in other tabs
        setPosts(prev => prev.map(p => p.id === updatedPost.id ? updatedPost : p));

        setLogs(prev => [`✓ Success: ${post.title}`, ...prev.slice(0, 9)]);
      } catch (error) {
        console.error(`Failed to update post ${post.id}:`, error);
        setLogs(prev => [`✗ Error: ${post.title} - Retrying next...`, ...prev.slice(0, 9)]);
      }

      // Small delay between calls to be safe with rate limits
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    setIsUpdating(false);
    setLogs(prev => ["Batch update completed!", ...prev]);
  };

  return (
    <div className="max-w-2xl mx-auto py-12 animate-in fade-in duration-700">
      <div className="bg-[#0a0a0a] rounded-[32px] md:rounded-[40px] p-8 md:p-16 border border-neutral-900 shadow-2xl space-y-8 md:space-y-12">
        <div className="text-center space-y-4">
          <h2 className="text-2xl font-semibold text-white">System Re-categorization</h2>
          <p className="text-sm text-neutral-500 leading-relaxed max-w-sm mx-auto">
            Update your entire archive to support the latest category logic:
            <span className="text-neutral-300"> 주제, 의상, 화면 구성</span>.
          </p>
        </div>

        <div className="space-y-8">
          {/* Progress Section */}
          <div className="space-y-3">
            <div className="flex justify-between items-end px-1">
              <span className="text-[10px] font-semibold text-neutral-600 uppercase">
                Progress
              </span>
              <span className="text-[10px] font-semibold text-neutral-400 uppercase">
                {progress.current} / {progress.total} Posts
              </span>
            </div>
            <div className="h-2 w-full bg-neutral-900 rounded-full overflow-hidden">
              <div
                className="h-full bg-white transition-all duration-500 ease-out"
                style={{ width: `${(progress.current / progress.total) * 100}%` }}
              />
            </div>
          </div>

          <button
            onClick={startBatchUpdate}
            disabled={isUpdating || posts.length === 0}
            className={`w-full h-16 rounded-3xl font-semibold transition-all shadow-xl hover:scale-[1.01] active:scale-[0.99] ${isUpdating ? 'bg-neutral-900 text-neutral-600 cursor-not-allowed' : 'bg-white text-black hover:bg-neutral-100'
              }`}
          >
            {isUpdating ? 'Processing AI Logic...' : 'Start Global Update'}
          </button>
        </div>

        {/* Status Logs */}
        <div className="space-y-4 pt-4">
          <label className="block text-[10px] font-semibold text-neutral-600 uppercase px-1">
            Activity Log
          </label>
          <div className="bg-black rounded-2xl p-6 min-h-[160px] border border-neutral-900/50 space-y-2">
            {logs.length > 0 ? logs.map((log, i) => (
              <p key={i} className={`text-[11px] font-medium tracking-tight ${i === 0 ? 'text-neutral-300' : 'text-neutral-700'}`}>
                {log}
              </p>
            )) : (
              <p className="text-[11px] text-neutral-800 italic">No activity yet. Press start to update your archive.</p>
            )}
          </div>
        </div>

        <div className="text-center pt-4">
          <p className="text-[10px] text-neutral-700 font-medium italic">
            Note: This process uses AI analysis for each post sequentially.
          </p>
        </div>
      </div>
    </div>
  );
};

export default UpdateTab;
