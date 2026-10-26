import React, { useState, useEffect, useRef } from 'react';

interface BobMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface ChatPanelProps {
  selectedFile: string | null;
  fileContent: string;
  onAskBob: (system: string, messages: BobMessage[]) => void;
}

export const ChatPanel: React.FC<ChatPanelProps> = ({ selectedFile, fileContent, onAskBob }) => {
  const [messages, setMessages] = useState<BobMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (selectedFile && fileContent) {
      setMessages([{
        role: 'assistant',
        content: `File loaded: ${selectedFile}\n\nYou can ask me questions about this file or request changes.`
      }]);
    }
  }, [selectedFile, fileContent]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = () => {
    if (!input.trim() || !selectedFile) return;

    const userMessage: BobMessage = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    const system = `You are a helpful coding assistant. The user is working on file: ${selectedFile}

File content:
\`\`\`
${fileContent}
\`\`\`

Help the user understand or modify this code.`;

    onAskBob(system, [...messages, userMessage]);
  };

  const handleBobResponse = (content: string) => {
    setMessages(prev => [...prev, { role: 'assistant', content }]);
    setIsLoading(false);
  };

  // Expose method to parent
  useEffect(() => {
    (window as any).handleBobResponse = handleBobResponse;
  }, []);

  return (
    <div style={{
      width: '350px',
      borderTop: '1px solid var(--vscode-panel-border)',
      display: 'flex',
      flexDirection: 'column',
      background: 'var(--vscode-sideBar-background)',
      padding: '10px',
      gap: '10px'
    }}>
      <div style={{ fontWeight: 'bold', fontSize: '14px' }}>AI Assistant</div>
      
      <div style={{
        flex: 1,
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        padding: '5px'
      }}>
        {messages.map((msg, idx) => (
          <MessageBubble key={idx} message={msg} />
        ))}
        {isLoading && (
          <div style={{
            padding: '8px 12px',
            background: 'var(--vscode-editor-background)',
            borderRadius: '8px',
            fontSize: '13px',
            alignSelf: 'flex-start',
            animation: 'pulse 1.5s ease-in-out infinite'
          }}>
            Thinking...
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div style={{ display: 'flex', gap: '5px' }}>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder="Ask about the code..."
          disabled={!selectedFile}
          style={{
            flex: 1,
            padding: '8px',
            background: 'var(--vscode-input-background)',
            color: 'var(--vscode-input-foreground)',
            border: '1px solid var(--vscode-input-border)',
            borderRadius: '4px',
            fontFamily: 'var(--vscode-font-family)',
            fontSize: '13px',
            resize: 'vertical',
            height: '60px',
            outline: 'none'
          }}
        />
        <button
          onClick={handleSend}
          disabled={!input.trim() || !selectedFile || isLoading}
          style={{
            padding: '8px 16px',
            background: 'var(--vscode-button-background)',
            color: 'var(--vscode-button-foreground)',
            border: 'none',
            borderRadius: '4px',
            cursor: input.trim() && selectedFile && !isLoading ? 'pointer' : 'not-allowed',
            fontSize: '13px',
            fontWeight: 'bold'
          }}
        >
          Send
        </button>
      </div>
    </div>
  );
};

interface MessageBubbleProps {
  message: BobMessage;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({ message }) => {
  const isUser = message.role === 'user';
  
  return (
    <div style={{
      padding: '8px 12px',
      background: isUser ? 'var(--vscode-button-background)' : 'var(--vscode-editor-background)',
      color: isUser ? 'var(--vscode-button-foreground)' : 'var(--vscode-foreground)',
      borderRadius: '8px',
      fontSize: '13px',
      alignSelf: isUser ? 'flex-end' : 'flex-start',
      maxWidth: '85%',
      whiteSpace: 'pre-wrap',
      fontFamily: 'var(--vscode-font-family)',
      lineHeight: '1.5'
    }}>
      {message.content}
    </div>
  );
};

// Made with Bob