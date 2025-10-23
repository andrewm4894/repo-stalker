// Generate or retrieve a session ID that persists for the browser session
export const getSessionId = (): string => {
  const SESSION_KEY = 'repostalker_session_id';
  
  let sessionId = sessionStorage.getItem(SESSION_KEY);
  
  if (!sessionId) {
    // Generate a new UUID v4
    sessionId = crypto.randomUUID();
    sessionStorage.setItem(SESSION_KEY, sessionId);
  }
  
  return sessionId;
};
