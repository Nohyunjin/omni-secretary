import { SUGGESTED_PROMPTS } from '../../types/chat';

type SuggestedPromptsProps = {
  onPromptClick: (prompt: string) => void;
};

export const SuggestedPrompts = ({ onPromptClick }: SuggestedPromptsProps) => {
  return (
    <div className="p-2 border-t border-slate-200 dark:border-slate-700 overflow-x-auto shrink-0">
      <div className="flex gap-2">
        {SUGGESTED_PROMPTS.map((prompt, i) => (
          <button
            key={i}
            onClick={() => onPromptClick(prompt)}
            className="whitespace-nowrap px-3 py-1 text-xs rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700"
          >
            {prompt}
          </button>
        ))}
      </div>
    </div>
  );
};
