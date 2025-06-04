import { useState } from 'react';

export default function Index() {
  const [phrase, setPhrase] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    try {
      const response = await fetch(`/api/sentiment/${phrase}`);
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Something went wrong');
      }
      
      setResult(data);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <main style={{ maxWidth: '600px', margin: '0 auto', padding: '2rem' }}>
      <h1 style={{ textAlign: 'center' }}>MCP Sentiment Analysis</h1>
      
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <label>
          Enter a phrase:
          <input 
            type="text" 
            value={phrase} 
            onChange={(e) => setPhrase(e.target.value)} 
            required
            style={{ display: 'block', width: '100%', padding: '0.5rem', margin: '0.5rem 0' }}
          />
        </label>
        <button 
          type="submit" 
          style={{ 
            padding: '0.5rem 1rem', 
            backgroundColor: '#3b82f6', 
            color: 'white', 
            border: 'none', 
            borderRadius: '0.25rem'
          }}
        >
          Analyze Sentiment
        </button>
      </form>

      {error && <div style={{ color: 'red', marginTop: '1rem' }}>{error}</div>}
      
      {result && (
        <div style={{ marginTop: '1rem', padding: '1rem', backgroundColor: '#f0f0f0', borderRadius: '0.25rem' }}>
          <h2>Result</h2>
          <p><strong>Phrase:</strong> {result.input}</p>
          <p><strong>Sentiment:</strong> {result.sentiment}</p>
          {result.polarityScore !== null && (
            <p><strong>Polarity Score:</strong> {result.polarityScore}</p>
          )}
          <p><strong>Full Response:</strong> {result.fullResponse}</p>
        </div>
      )}
    </main>
  );
}
