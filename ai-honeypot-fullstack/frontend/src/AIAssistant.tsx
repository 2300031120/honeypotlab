import React from 'react';
import { MessageSquare } from 'lucide-react';
import { Link } from 'react-router-dom';
import { isAuthenticated } from './utils/auth';

const AIAssistant = () => {
  const isSignedIn = isAuthenticated();

  if (!isSignedIn) {
    return null;
  }

  return (
    <Link
      to="/ai-companion"
      aria-label="Ask AI Companion"
      className="ai-assistant-fab ai-assistant-fab-private"
    >
      <MessageSquare size={24} />
    </Link>
  );
};

export default AIAssistant;
