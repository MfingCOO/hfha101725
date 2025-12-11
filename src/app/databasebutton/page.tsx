'use client';

import { useState } from 'react';

export default function DatabaseButtonPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleClick = async () => {
    setIsLoading(true);
    setResult(null);
    setError(null);

    try {
      // This is a standard browser fetch request.
      // It will ALWAYS appear in the F12 Network tab.
      const response = await fetch('/api/temp-test');
      
      if (!response.ok) {
        // If the server returns an error (like 404), we will see it.
        throw new Error(`Network response was not ok. Status: ${response.status}`);
      }
      
      const data = await response.json();
      setResult(data.message); // Should display "Success! The API route is working."

    } catch (e: any) {
      console.error('Fetch failed:', e);
      setError(e.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ padding: '2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
      <h1>Simple API Route Test</h1>
      <p>This button makes a standard `fetch` call to `/api/temp-test`.</p>
      <button onClick={handleClick} disabled={isLoading} style={{ padding: '0.5rem 1rem', fontSize: '1rem' }}>
        {isLoading ? 'Testing...' : 'Run Simple API Test'}
      </button>
      
      {result && (
        <div style={{ marginTop: '1rem', padding: '1rem', border: '1px solid green' }}>
          <p><strong>Success:</strong> {result}</p>
        </div>
      )}
      {error && (
        <div style={{ marginTop: '1rem', padding: '1rem', border: '1px solid red' }}>
          <p><strong>Error:</strong> {error}</p>
        </div>
      )}
    </div>
  );
}
