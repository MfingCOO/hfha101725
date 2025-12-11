import React from 'react';

interface InsightPopupProps {
  message: string;
  onClose: () => void;
}

const InsightPopup: React.FC<InsightPopupProps> = ({ message, onClose }) => {
  // Prevents the popup from closing if the user clicks inside the content area.
  const handleContentClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000, // High z-index to ensure it's on top
      }}
      onClick={onClose} // Close when clicking the overlay
    >
      <div
        style={{
          background: 'white',
          borderRadius: '8px',
          padding: '24px',
          maxWidth: '450px',
          width: '90%',
          boxShadow: '0 4px 15px rgba(0,0,0,0.2)',
          color: '#333', // Dark text color for readability
        }}
        onClick={handleContentClick}
      >
        <h3
          style={{
            marginTop: 0,
            marginBottom: '16px',
            fontSize: '1.25rem',
            fontWeight: '600',
            color: '#111',
          }}
        >
          A Note For You
        </h3>
        <div
          style={{
            whiteSpace: 'pre-wrap', // Preserves newlines from the AI response
            lineHeight: '1.6',
            fontSize: '1rem',
          }}
        >
          {message}
        </div>
        <button
          onClick={onClose}
          style={{
            marginTop: '24px',
            width: '100%',
            padding: '12px',
            border: 'none',
            borderRadius: '6px',
            backgroundColor: '#007bff', // A common primary blue
            color: 'white',
            fontSize: '1rem',
            fontWeight: 'bold',
            cursor: 'pointer',
            transition: 'background-color 0.2s ease',
          }}
        >
          Got it
        </button>
      </div>
    </div>
  );
};

export default InsightPopup;