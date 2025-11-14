import React from 'react';

interface MessageInputFormProps {
  inputMessage: string;
  isConnected: boolean;
  onSubmit: (e: React.FormEvent) => void;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
}

const MessageInputForm: React.FC<MessageInputFormProps> = ({
  inputMessage,
  isConnected,
  onSubmit,
  onChange,
  placeholder = 'Type a message...',
}) => {
  return (
    <form className="flex gap-2.5 p-4 bg-white border-t border-gray-200" onSubmit={onSubmit}>
      <input
        type="text"
        value={inputMessage}
        onChange={onChange}
        placeholder={placeholder}
        className="flex-1 px-4 py-3 border border-gray-300 rounded-full text-sm outline-none focus:border-blue-500 transition-colors disabled:bg-gray-100 disabled:cursor-not-allowed"
        disabled={!isConnected}
      />
      <button
        type="submit"
        className="px-6 py-3 bg-blue-500 text-white rounded-full text-sm font-semibold hover:bg-blue-600 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
        disabled={!isConnected || !inputMessage.trim()}
      >
        Send
      </button>
    </form>
  );
};

export default MessageInputForm;
