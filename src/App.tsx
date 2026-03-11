import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import LandingPageLogin from './components/LandingPageLogin';
import Dashboard from './components/Dashboard';
import DocumentUpload from './components/DocumentUpload';
import AnalysisResults from './components/AnalysisResults';
import ChatInterface from './components/ChatInterface';
import Settings from './components/Settings';
import Footer from './components/Footer';
import Chatbot from './components/Chatbot';
import { LegalDocument, ChatMessage, User } from './types';
import { sampleDocument, sampleAnalysis, sampleUser } from './data/sampleData';

type Page = 'home' | 'analyze' | 'results' | 'chat' | 'settings';

// Mock authentication service
const authService = {
  async signIn(email: string, password: string): Promise<{ user: { id: string; email: string; name: string } | null; error: any }> {
    // Mock successful login
    await new Promise(resolve => setTimeout(resolve, 1000));
    return { 
      user: { id: '1', email, name: 'Demo User' }, 
      error: null 
    };
  },
  async signUp(email: string, password: string, name: string): Promise<{ user: { id: string; email: string; name: string } | null; error: any }> {
    // Mock successful signup
    await new Promise(resolve => setTimeout(resolve, 1000));
    return { 
      user: { id: '1', email, name }, 
      error: null 
    };
  },
  async signOut(): Promise<{ error: any }> {
    await new Promise(resolve => setTimeout(resolve, 500));
    return { error: null };
  },
  async getCurrentUser(): Promise<{ user: { id: string; email: string; name: string } | null; error: any }> {
    // Mock user check - return null for demo (no existing session)
    return { user: null, error: null };
  },
  async getUserProfile(userId: string): Promise<{ user: User | null; error: any }> {
    // Mock profile
    await new Promise(resolve => setTimeout(resolve, 500));
    return { 
      user: { 
        id: userId, 
        name: 'Demo User', 
        email: 'demo@example.com',
        plan: 'free' as const,
        documentsAnalyzed: 0,
        joinDate: new Date()
      }, 
      error: null 
    };
  },
  async updateUserProfile(userId: string, updates: Partial<User>): Promise<{ data: any; error: any }> {
    await new Promise(resolve => setTimeout(resolve, 500));
    return { data: updates, error: null };
  }
};

// Mock chat service
const chatService = {
  async saveMessage(userId: string, message: Omit<ChatMessage, 'id'>): Promise<{ message: ChatMessage | null; error: any }> {
    await new Promise(resolve => setTimeout(resolve, 300));
    return { 
      message: { ...message, id: Date.now().toString() }, 
      error: null 
    };
  },
  async getChatHistory(userId: string): Promise<{ messages: ChatMessage[] | null; error: any }> {
    await new Promise(resolve => setTimeout(resolve, 500));
    return { messages: [], error: null };
  }
};

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [currentPage, setCurrentPage] = useState<Page>('home');
  const [uploadedDocument, setUploadedDocument] = useState<LegalDocument | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisComplete, setAnalysisComplete] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);

  // Check for existing session on app load
  useEffect(() => {
    const checkSession = async () => {
      try {
        const { user } = await authService.getCurrentUser();
        if (user) {
          const { user: profile } = await authService.getUserProfile(user.id);
          if (profile) {
            setCurrentUser(profile);
            setIsLoggedIn(true);
            // Load user's chat history
            const { messages } = await chatService.getChatHistory(user.id);
            if (messages) {
              setChatMessages(messages);
            }
          }
        }
      } catch (error) {
        console.error('Session check failed:', error);
      } finally {
        setIsLoading(false);
      }
    };

    checkSession();
  }, []);

  const handleLogin = async (email: string, password: string) => {
    try {
      const { user, error } = await authService.signIn(email, password);
      
      if (error) {
        console.error('Login error:', error);
        const errorMessage = typeof error === 'object' && error !== null && 'message' in error 
          ? (error as any).message 
          : 'Invalid email or password';
        throw new Error(errorMessage);
      }

      if (!user) {
        throw new Error('Invalid email or password');
      }

      // Get user profile with retry logic
      let profile = null;
      let attempts = 0;
      const maxAttempts = 3;

      while (!profile && attempts < maxAttempts) {
        attempts++;
        const { user: fetchedProfile, error: profileError } = await authService.getUserProfile(user.id);
        
        if (fetchedProfile) {
          profile = fetchedProfile;
          break;
        }

        if (attempts < maxAttempts) {
          console.log(`Profile not found, retrying... (${attempts}/${maxAttempts})`);
          await new Promise(resolve => setTimeout(resolve, 1000));
        } else {
          console.error('Profile error after retries:', profileError);
          throw new Error('Unable to load user profile. Please try again.');
        }
      }

      if (!profile) {
        throw new Error('Unable to load user profile. Please try again.');
      }

      setCurrentUser(profile);
      setIsLoggedIn(true);
      
      // Load user's chat history
      const { messages } = await chatService.getChatHistory(user.id);
      if (messages) {
        setChatMessages(messages);
      }
      
      // Redirect to dashboard
      setCurrentPage('home');
    } catch (error: any) {
      console.error('Login failed:', error);
      throw error;
    }
  };

  const handleSignUp = async (email: string, password: string, name: string) => {
    try {
      const { user, error } = await authService.signUp(email, password, name);
      if (error) {
        const errorMessage = typeof error === 'object' && error !== null && 'message' in error 
          ? (error as any).message 
          : 'Sign up failed';
        throw new Error(errorMessage);
      }

      if (user) {
        // Try to auto-login after signup with retry logic
        try {
          let profile = null;
          let attempts = 0;
          const maxAttempts = 3;

          while (!profile && attempts < maxAttempts) {
            attempts++;
            const { user: fetchedProfile } = await authService.getUserProfile(user.id);
            
            if (fetchedProfile) {
              profile = fetchedProfile;
              break;
            }

            if (attempts < maxAttempts) {
              console.log(`Waiting for profile creation... (${attempts}/${maxAttempts})`);
              await new Promise(resolve => setTimeout(resolve, 1000));
            }
          }

          if (profile) {
            setCurrentUser(profile);
            setIsLoggedIn(true);
            setCurrentPage('home');
            return;
          }
        } catch (profileError) {
          console.log('Profile not ready yet, showing confirmation message');
        }
        // If we get here, profile wasn't ready - show confirmation
        return 'confirmation_required';
      }
      throw new Error('Sign up failed');
    } catch (error: any) {
      console.error('Sign up failed:', error);
      throw error;
    }
  };

  const handleLogout = async () => {
    try {
      await authService.signOut();
      setIsLoggedIn(false);
      setCurrentUser(null);
      setCurrentPage('home');
      setUploadedDocument(null);
      setAnalysisComplete(false);
      setChatMessages([]);
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const handleNavigate = (page: string) => {
    setCurrentPage(page as Page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleUpdateUser = (updates: Partial<User>) => {
    if (currentUser) {
      setCurrentUser({ ...currentUser, ...updates });
    }
  };

  const handleUpload = (document: LegalDocument) => {
    setUploadedDocument(document);
  };

  const handleAnalyze = async (document: LegalDocument) => {
    setIsAnalyzing(true);
    setCurrentPage('analyze');
    
    // Simulate analysis delay
    setTimeout(() => {
      setIsAnalyzing(false);
      setAnalysisComplete(true);
      setCurrentPage('results');
    }, 2500);
  };

  const handleAskQuestion = async (question: string) => {
    setCurrentPage('chat');
    
    // Add user message to chat
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: question,
      timestamp: new Date(),
    };
    
    setChatMessages(prev => [...prev, userMessage]);
    
    // Save to database if logged in
    if (currentUser) {
      await chatService.saveMessage(currentUser.id, userMessage);
    }
  };

  
  // Show loading screen while checking session
  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary-100 flex items-center justify-center">
            <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin"></div>
          </div>
          <h2 className="text-xl font-semibold text-slate-900">Loading LegalAI...</h2>
        </div>
      </div>
    );
  }

  const renderContent = () => {
    // Show landing page if not logged in
    if (!isLoggedIn) {
      return (
        <LandingPageLogin
          onLogin={handleLogin}
          onSignUp={handleSignUp}
          onGetStarted={() => {}}
        />
      );
    }

    switch (currentPage) {
      case 'home':
        return (
          <>
            <Dashboard
              user={currentUser || sampleUser}
              onNavigate={handleNavigate}
            />
            <Footer onNavigate={handleNavigate} />
          </>
        );

      case 'analyze':
        return (
          <>
            <DocumentUpload
              onUpload={handleUpload}
              onAnalyze={handleAnalyze}
              isProcessing={isAnalyzing}
              uploadedDocument={uploadedDocument}
            />
            {isAnalyzing && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                <div className="bg-white rounded-2xl p-8 max-w-md mx-4 text-center">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary-100 flex items-center justify-center">
                    <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin"></div>
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 mb-2">Analyzing Your Document</h3>
                  <p className="text-slate-600">Our AI is reviewing your document for key clauses, obligations, and risks...</p>
                </div>
              </div>
            )}
            <Footer onNavigate={handleNavigate} />
          </>
        );

      case 'results':
        return (
          <>
            <AnalysisResults
              document={uploadedDocument || sampleDocument}
              onAskQuestion={handleAskQuestion}
              onBack={() => handleNavigate('analyze')}
            />
            <Footer onNavigate={handleNavigate} />
          </>
        );

      case 'chat':
        return (
          <>
            <ChatInterface
              documentContext={uploadedDocument?.name || sampleDocument.name}
              initialMessages={chatMessages}
              onBack={() => handleNavigate(analysisComplete ? 'results' : 'analyze')}
            />
            <Footer onNavigate={handleNavigate} />
          </>
        );

      case 'settings':
        return (
          <>
            <Settings
              user={currentUser || sampleUser}
              onUpdateUser={handleUpdateUser}
              onLogout={handleLogout}
              onBack={() => handleNavigate('home')}
            />
            <Footer onNavigate={handleNavigate} />
          </>
        );

      default:
        return (
          <LandingPageLogin
            onLogin={handleLogin}
            onSignUp={handleSignUp}
            onGetStarted={() => {}}
          />
        );
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {isLoggedIn && (
        <Navbar
          isLoggedIn={true}
          userName={currentUser?.name || 'User'}
          currentPage={currentPage === 'results' ? 'analyze' : currentPage}
          onNavigate={handleNavigate}
          onLogout={handleLogout}
        />
      )}
      <main className={`${isLoggedIn ? 'min-h-[calc(100vh-80px)]' : 'min-h-screen'}`}>
        {renderContent()}
      </main>
      {isLoggedIn && <Chatbot userName={currentUser?.name} />}
    </div>
  );
}

export default App;
