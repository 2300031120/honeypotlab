import React from 'react';
import { MessageSquare } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';

const AIAssistant = () => {
  const location = useLocation();
  const publicPaths = [
    '/',
    '/platform',
    '/architecture',
    '/use-cases',
    '/demo',
    '/contact',
    '/privacy',
    '/terms',
    '/security',
  ];
  const isPublicPage = publicPaths.includes(location.pathname);

  return (
    <Link
      to="/ai-companion"
      aria-label="Ask AI Companion"
      className={`ai-assistant-fab ${isPublicPage ? 'ai-assistant-fab-public' : 'ai-assistant-fab-private'}`}
    >
      <MessageSquare size={24} />
      {isPublicPage ? <span>Ask AI Companion</span> : null}
    </Link>
  );
};

export default AIAssistant;
