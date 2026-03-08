import React from 'react';
import { MessageSquare } from 'lucide-react';
import { Link } from 'react-router-dom';

// simple floating button linking to the AI Companion page
const AIAssistant = () => {
  return (
    <Link
      to="/ai-companion"
      style={{
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        background: '#238636',
        borderRadius: '50%',
        padding: '14px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
        color: 'white',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <MessageSquare size={24} />
    </Link>
  );
};

export default AIAssistant;
