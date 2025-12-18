import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Send, User, LogOut, Wifi, WifiOff, Users, Hash, Loader2, Smile, MessageSquare, Menu, X, ArrowLeft, ArrowDown } from 'lucide-react';

/**
 * CONFIGURATION
 * Toggle this to FALSE to connect to the real Node.js server.
 * Set to TRUE to use the in-browser simulation for the preview.
 */
const USE_MOCK_SERVER = false;
const WS_URL = 'wss://chat-server-2zeu.onrender.com';
const MAX_CHARS = 500; // Match backend constraint

// --- MOCK SERVER IMPLEMENTATION (For Preview Only) ---
class MockWebSocket {
  constructor(url) {
    this.url = url;
    this.readyState = 0; // CONNECTING
    this.currentUser = 'You'; 

    setTimeout(() => {
      this.readyState = 1; // OPEN
      if (this.onopen) this.onopen({});
      
      this.receive({
        type: 'history',
        payload: [
          { id: 'm1', text: 'Welcome to the chat!', user: 'System', type: 'system', timestamp: Date.now() - 86400000 * 2 }, // 2 days ago
          { id: 'm2', text: 'This was sent yesterday.', user: 'Alex', type: 'chat', color: 'bg-blue-500', timestamp: Date.now() - 86400000 }, // 1 day ago
          { id: 'm3', text: 'Hey everyone! 👋', user: 'Alex', type: 'chat', color: 'bg-blue-500', timestamp: Date.now() - 60000 },
        ]
      });

      this.simulationInterval = setInterval(() => {
        const rand = Math.random();
        if (rand > 0.7) {
          const users = ['Alex', 'Sarah', 'DevBot', 'Mike'];
          const user = users[Math.floor(Math.random() * users.length)];
          const msgs = ['cool', 'nice UI!', 'working on the backend?', 'lol', 'Any updates?'];
          
          this.receive({
            type: 'message',
            payload: {
              id: Date.now(),
              user,
              text: msgs[Math.floor(Math.random() * msgs.length)],
              type: 'chat',
              color: 'bg-indigo-500',
              timestamp: Date.now()
            }
          });
        }
      }, 4000);

      this.receive({
        type: 'users',
        payload: ['You', 'Alex', 'Sarah', 'DevBot', 'Mike']
      });

    }, 800);
  }

  send(data) {
    const parsed = JSON.parse(data);
    if (parsed.type === 'join') this.currentUser = parsed.payload;
    
    // Echo back locally
    if (parsed.type === 'message') {
        // Broadcast simulation
        setTimeout(() => this.receive({ type: 'message', payload: { ...parsed.payload, id: Date.now(), timestamp: Date.now() } }), 100);
    } else if (parsed.type === 'direct_message') {
        // DM Simulation
        const directPayload = parsed.payload;
        // Echo to sender
        setTimeout(() => {
             this.receive({
                type: 'message',
                payload: { ...directPayload, type: 'direct_message', from: this.currentUser, id: Date.now(), timestamp: Date.now() }
            });
        }, 100);
    }
  }

  receive(data) {
    if (this.onmessage) this.onmessage({ data: JSON.stringify(data) });
  }

  close() {
    this.readyState = 3; 
    if (this.simulationInterval) clearInterval(this.simulationInterval);
    if (this.onclose) this.onclose({});
  }
}

// --- HELPER: DATE FORMATTING ---
const formatDateHeader = (timestamp) => {
    const date = new Date(timestamp);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) return 'Today';
    if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return date.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
};

// --- APP COMPONENT ---

export default function App() {
  const [screen, setScreen] = useState('join'); 
  const [username, setUsername] = useState('');
  const [socket, setSocket] = useState(null);
  
  const [messages, setMessages] = useState([]);
  const [users, setUsers] = useState([]);
  const [typingUsers, setTypingUsers] = useState(new Set());
  
  const [activeChannel, setActiveChannel] = useState('general'); 
  const [unreadCounts, setUnreadCounts] = useState({});
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState('');
  
  // Mobile UI State
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Connection Logic
  const connect = (user) => {
    setError('');
    const ws = USE_MOCK_SERVER ? new MockWebSocket(WS_URL) : new WebSocket(WS_URL);

    ws.onopen = () => {
      setIsConnected(true);
      ws.send(JSON.stringify({ type: 'join', payload: user }));
      setScreen('chat');
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      handleServerEvent(data, user);
    };

    ws.onclose = () => {
      setIsConnected(false);
      setScreen('join');
      setMessages([]);
      setUsers([]);
      setUnreadCounts({});
    };

    ws.onerror = () => {
      setError('Connection failed. Is the server running?');
      setIsConnected(false);
    };

    setSocket(ws);
  };

  const handleServerEvent = (data, currentUser) => {
    switch (data.type) {
      case 'history':
        setMessages(data.payload);
        break;
      case 'message':
        const newMsg = data.payload;
        setMessages((prev) => [...prev, newMsg]);
        break;
      case 'users':
        setUsers(data.payload);
        break;
      case 'typing':
        setTypingUsers((prev) => {
          const newSet = new Set(prev);
          if (data.payload.isTyping) newSet.add(data.payload.user);
          else newSet.delete(data.payload.user);
          return newSet;
        });
        break;
      default:
        break;
    }
  };

  // Manage unreads
  useEffect(() => {
    if (messages.length === 0) return;
    const lastMsg = messages[messages.length - 1];
    
    if (lastMsg.type === 'direct_message') {
        const otherParty = lastMsg.from === username ? lastMsg.to : lastMsg.from;
        if (activeChannel !== otherParty && lastMsg.from !== username) {
            setUnreadCounts(prev => ({
                ...prev,
                [otherParty]: (prev[otherParty] || 0) + 1
            }));
        }
    }
  }, [messages, activeChannel, username]);

  // Clear unreads
  useEffect(() => {
    if (activeChannel !== 'general') {
        setUnreadCounts(prev => {
            const newCounts = { ...prev };
            delete newCounts[activeChannel];
            return newCounts;
        });
    }
  }, [activeChannel]);

  const disconnect = () => {
    if (socket) {
      socket.close();
      setSocket(null);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-slate-100 font-sans antialiased overflow-hidden">
      {screen === 'join' ? (
        <JoinScreen 
            onJoin={connect} 
            username={username} 
            setUsername={setUsername} 
            error={error} 
        />
      ) : (
        <ChatScreen 
            username={username}
            messages={messages}
            users={users}
            socket={socket}
            isConnected={isConnected}
            typingUsers={typingUsers}
            activeChannel={activeChannel}
            setActiveChannel={(channel) => {
                setActiveChannel(channel);
                setIsSidebarOpen(false); // Close mobile sidebar on selection
            }}
            unreadCounts={unreadCounts}
            onLogout={disconnect}
            isSidebarOpen={isSidebarOpen}
            setIsSidebarOpen={setIsSidebarOpen}
        />
      )}
      
      {USE_MOCK_SERVER && (
        <div className="fixed bottom-2 right-2 px-3 py-1 bg-amber-500/20 text-amber-300 text-xs rounded-full border border-amber-500/30 backdrop-blur-sm pointer-events-none z-50">
          Simulation Mode
        </div>
      )}
    </div>
  );
}

// --- SUB COMPONENTS ---

const JoinScreen = ({ onJoin, username, setUsername, error }) => {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    const trimmedUsername = username.trim(); // Trim whitespace to prevent mobile keyboard issues
    
    if (!trimmedUsername) return;

    // IMPORTANT: Update state to the trimmed version so it matches what we send to server
    setUsername(trimmedUsername); 
    setIsSubmitting(true);
    
    setTimeout(() => {
      onJoin(trimmedUsername);
      setIsSubmitting(false);
    }, 600);
  };

  return (
    <div className="h-[100dvh] flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0">
         <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-600/20 rounded-full blur-[100px] animate-pulse"></div>
         <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-600/20 rounded-full blur-[100px] animate-pulse" style={{ animationDelay: '2s' }}></div>
      </div>

      <div className="w-full max-w-md bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl p-8 z-10">
        <div className="flex justify-center mb-8">
            <div className="w-16 h-16 bg-gradient-to-tr from-indigo-500 to-purple-500 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/30">
                <Hash className="w-8 h-8 text-white" />
            </div>
        </div>
        
        <h1 className="text-3xl font-bold text-center mb-2 bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">
          StreamChat
        </h1>
        <p className="text-center text-slate-400 mb-8">Enter your alias</p>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <div className="relative">
                <User className="absolute left-3 top-3.5 w-5 h-5 text-slate-500" />
                <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full bg-slate-900/50 border border-slate-700 rounded-xl py-3 pl-10 pr-4 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                    placeholder="Username"
                    autoFocus
                    maxLength={15}
                />
            </div>
          </div>

          {error && (
            <div className="text-red-400 text-sm text-center bg-red-500/10 py-2 rounded-lg border border-red-500/20">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={!username.trim() || isSubmitting}
            className={`w-full py-3.5 rounded-xl font-semibold text-white shadow-lg flex items-center justify-center gap-2 transition-all transform active:scale-95 ${
              username.trim() && !isSubmitting
                ? 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:shadow-indigo-500/25' 
                : 'bg-slate-700 cursor-not-allowed opacity-50'
            }`}
          >
            {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Join Channel'}
          </button>
        </form>
      </div>
    </div>
  );
};

const ChatScreen = ({ 
    username, messages, users, socket, isConnected, 
    typingUsers, onLogout, activeChannel, setActiveChannel, unreadCounts,
    isSidebarOpen, setIsSidebarOpen
}) => {
  const [inputText, setInputText] = useState('');
  const [showScrollButton, setShowScrollButton] = useState(false);
  const messagesEndRef = useRef(null);
  const scrollContainerRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  const scrollToBottom = (behavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  };

  useEffect(() => {
    // Only scroll to bottom if we are already near bottom or it's a new session
    scrollToBottom();
  }, [messages.length, activeChannel]); // Trigger when count changes or channel changes

  // Scroll listener for "Scroll to Bottom" button
  const handleScroll = () => {
    if (!scrollContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
    // Show button if we are more than 300px away from bottom
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 300;
    setShowScrollButton(!isNearBottom);
  };

  const displayedMessages = useMemo(() => {
    return messages.filter(msg => {
      if (activeChannel === 'general') {
        return msg.type === 'chat' || msg.type === 'system';
      } else {
        if (msg.type !== 'direct_message') return false;
        return (msg.from === activeChannel && msg.to === username) || 
               (msg.from === username && msg.to === activeChannel);
      }
    });
  }, [messages, activeChannel, username]);

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!inputText.trim() || !socket) return;

    if (activeChannel === 'general') {
        socket.send(JSON.stringify({
            type: 'message',
            payload: {
                text: inputText,
                user: username,
                type: 'chat',
                color: 'bg-indigo-500' 
            }
        }));
    } else {
        socket.send(JSON.stringify({
            type: 'direct_message',
            payload: {
                text: inputText,
                to: activeChannel,
                type: 'direct_message' 
            }
        }));
    }
    
    setInputText('');
    handleTyping(false);
  };

  const handleTyping = (isTyping) => {
    if (!socket || activeChannel !== 'general') return;
    socket.send(JSON.stringify({
        type: 'typing',
        payload: { user: username, isTyping }
    }));
  };

  const handleInputChange = (e) => {
    setInputText(e.target.value);
    handleTyping(true);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => handleTyping(false), 1500);
  };

  const activeTypers = Array.from(typingUsers).filter(u => u !== username);

  return (
    <div className="flex h-[100dvh] w-full max-w-7xl mx-auto shadow-2xl overflow-hidden bg-slate-900 md:rounded-xl md:my-4 md:h-[calc(100vh-2rem)] border border-slate-800 relative">
      
      {/* Sidebar - Desktop: Static, Mobile: Overlay */}
      <aside className={`
        flex flex-col bg-slate-950 md:bg-slate-950/50 border-r border-slate-800 transition-all duration-300
        ${isSidebarOpen ? 'absolute inset-0 z-50 w-full' : 'hidden md:flex w-64'}
      `}>
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <h2 className="font-bold text-slate-100 px-2">Channels</h2>
          {/* Close button for mobile */}
          <button 
            onClick={() => setIsSidebarOpen(false)}
            className="md:hidden p-2 text-slate-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-4 flex-1 overflow-y-auto">
             <button 
                onClick={() => setActiveChannel('general')}
                className={`w-full flex items-center gap-2 px-3 py-3 rounded-xl transition-colors mb-6 ${
                    activeChannel === 'general' 
                    ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30' 
                    : 'text-slate-400 hover:bg-white/5 hover:text-slate-200 border border-transparent'
                }`}
              >
                <div className={`p-1.5 rounded-lg ${activeChannel === 'general' ? 'bg-indigo-500 text-white' : 'bg-slate-800'}`}>
                    <Hash className="w-4 h-4" />
                </div>
                <span className="font-medium">General Chat</span>
              </button>

              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 px-2 flex items-center justify-between">
                <span>Active Users</span>
                <span className="bg-slate-800 text-slate-400 px-1.5 rounded text-[10px]">{users.length - 1 > 0 ? users.length - 1 : 0}</span>
              </h3>
              
              <div className="space-y-1">
                {users.map((u, i) => {
                   if (u === username) return null;
                   const unread = unreadCounts[u] || 0;
                   return (
                      <button
                        key={i}
                        onClick={() => setActiveChannel(u)}
                        className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg transition-all group ${
                            activeChannel === u 
                            ? 'bg-indigo-600/20 text-indigo-300' 
                            : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                            <div className="relative">
                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-xs font-bold text-white shadow-lg">
                                    {u.charAt(0).toUpperCase()}
                                </div>
                                <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-green-500 border-2 border-slate-950 rounded-full"></div>
                            </div>
                            <span className="text-sm font-medium">{u}</span>
                        </div>
                        {unread > 0 && (
                            <span className="bg-indigo-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center animate-pulse">
                                {unread}
                            </span>
                        )}
                      </button>
                   );
                })}
                {users.length === 1 && (
                    <div className="text-sm text-slate-600 italic px-4 py-2">
                        No one else is here...
                    </div>
                )}
              </div>
        </div>
        
        <div className="p-4 border-t border-slate-800 bg-slate-900/50">
           <div className="flex items-center gap-3 mb-3 px-2">
                <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-slate-700 to-slate-600 flex items-center justify-center font-bold text-sm text-white shadow-lg border border-slate-600">
                    {username.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold text-white truncate">{username}</div>
                    <div className="text-xs text-green-400 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse"></span>
                        Online
                    </div>
                </div>
           </div>
          <button 
            onClick={onLogout}
            className="flex items-center gap-2 text-xs text-slate-500 hover:text-red-400 transition-colors w-full px-2 py-2 rounded-lg hover:bg-red-500/10"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Chat Area */}
      <main className="flex-1 flex flex-col bg-slate-900 relative min-w-0">
        {/* Header */}
        <header className="flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-slate-900/95 backdrop-blur z-10 h-16">
            <div className="flex items-center gap-3 overflow-hidden">
                {/* Mobile Menu Button */}
                <button 
                    onClick={() => setIsSidebarOpen(true)}
                    className="md:hidden p-2 -ml-2 text-slate-400 hover:text-white rounded-lg hover:bg-white/5"
                >
                    <Menu className="w-6 h-6" />
                </button>

                {activeChannel === 'general' ? (
                     <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center text-slate-400 shrink-0">
                        <Hash className="w-5 h-5" />
                     </div>
                ) : (
                    <div className="w-10 h-10 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0">
                        <User className="w-5 h-5" />
                    </div>
                )}
                <div className="min-w-0">
                    <h2 className="font-bold text-slate-100 leading-tight truncate">
                        {activeChannel === 'general' ? 'general' : activeChannel}
                    </h2>
                    <p className="text-xs text-slate-500 font-medium truncate">
                        {activeChannel === 'general' 
                            ? `${users.length} members online` 
                            : 'Private Conversation'
                        }
                    </p>
                </div>
            </div>
            
            <div className="md:hidden">
                 <button onClick={onLogout} className="p-2 text-slate-500 hover:text-red-400"><LogOut className="w-5 h-5" /></button>
            </div>
        </header>

        {/* Messages List */}
        <div 
            ref={scrollContainerRef}
            onScroll={handleScroll}
            className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4 scroll-smooth relative"
        >
          {displayedMessages.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-slate-600 space-y-4 opacity-50">
               {activeChannel === 'general' ? <MessageSquare className="w-12 h-12" /> : <User className="w-12 h-12" />}
               <p className="text-sm">
                   {activeChannel === 'general' ? "No messages yet." : `Start chatting with ${activeChannel}`}
               </p>
            </div>
          )}
          
          {displayedMessages.map((msg, idx) => {
            const isMe = msg.from ? msg.from === username : msg.user === username;
            const senderName = msg.from || msg.user;
            const isSystem = msg.type === 'system';
            const previousMsg = displayedMessages[idx - 1];
            
            // UI Logic: Time Grouping
            const showDateHeader = !previousMsg || new Date(msg.timestamp).toDateString() !== new Date(previousMsg.timestamp).toDateString();
            
            // UI Logic: Sender Grouping
            const showHeader = idx === 0 || 
                               (previousMsg?.user !== senderName && previousMsg?.from !== senderName) || 
                               (msg.timestamp - previousMsg?.timestamp > 60000) ||
                               showDateHeader;

            return (
              <React.Fragment key={idx}>
                {/* Date Separator */}
                {showDateHeader && (
                    <div className="flex justify-center my-6">
                        <span className="bg-slate-800 text-slate-500 text-xs font-medium py-1 px-3 rounded-full border border-slate-700">
                            {formatDateHeader(msg.timestamp)}
                        </span>
                    </div>
                )}

                {isSystem ? (
                  <div className="flex justify-center my-4 px-4">
                    <span className="bg-slate-800/50 text-slate-400 text-xs py-1 px-3 rounded-full border border-slate-700/50 text-center">
                      {msg.text}
                    </span>
                  </div>
                ) : (
                  <div className={`group flex ${isMe ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2 duration-300`}>
                    <div className={`flex flex-col max-w-[85%] md:max-w-[70%] ${isMe ? 'items-end' : 'items-start'}`}>
                      
                      {(!isMe && showHeader && activeChannel === 'general') && (
                        <span className="ml-1 mb-1 text-xs text-slate-400 font-medium flex items-center gap-2">
                            {senderName}
                            <span className="text-[10px] text-slate-600">{new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                        </span>
                      )}
                      
                      <div className={`px-4 py-2.5 rounded-2xl shadow-sm text-[15px] leading-relaxed break-words ${
                        isMe 
                          ? 'bg-indigo-600 text-white rounded-tr-sm' 
                          : activeChannel !== 'general' 
                            ? 'bg-slate-800 text-slate-200 rounded-tl-sm border border-slate-700' 
                            : 'bg-slate-800 text-slate-200 rounded-tl-sm'
                      }`}>
                        {msg.text}
                      </div>
                      
                      <span className="text-[10px] text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity mt-1 px-1">
                          {new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                      </span>
                    </div>
                  </div>
                )}
              </React.Fragment>
            );
          })}
          
          {activeChannel === 'general' && activeTypers.length > 0 && (
            <div className="flex items-center gap-2 ml-2 mt-2">
                <div className="flex gap-1 bg-slate-800/50 p-2 rounded-xl rounded-tl-none">
                    <span className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                    <span className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                    <span className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                </div>
                <span className="text-xs text-slate-500">
                    {activeTypers.join(', ')} typing...
                </span>
            </div>
          )}
          
          <div ref={messagesEndRef} />

          {/* Scroll to Bottom Button */}
          {showScrollButton && (
            <button 
                onClick={() => scrollToBottom()}
                className="absolute bottom-6 right-6 bg-slate-800 text-slate-200 p-2.5 rounded-full shadow-lg border border-slate-700 hover:bg-slate-700 hover:text-white transition-all animate-in fade-in slide-in-from-bottom-2 z-20"
            >
                <ArrowDown className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Input Area */}
        <div className="p-3 md:p-4 bg-slate-900 border-t border-slate-800">
          <form onSubmit={handleSendMessage} className="relative flex items-center gap-2 bg-slate-950 p-2 rounded-xl border border-slate-800 focus-within:border-indigo-500/50 focus-within:ring-1 focus-within:ring-indigo-500/20 transition-all">
            <button type="button" className="p-2 text-slate-500 hover:text-indigo-400 transition-colors hidden sm:block">
                <Smile className="w-5 h-5" />
            </button>
            <input
              type="text"
              value={inputText}
              onChange={handleInputChange}
              maxLength={MAX_CHARS}
              className="flex-1 bg-transparent text-white placeholder-slate-600 focus:outline-none py-2 text-sm min-w-0"
              placeholder={activeChannel === 'general' ? "Message #general" : `Message @${activeChannel}`}
              autoComplete="off"
            />
            {/* Character Counter */}
            <span className={`text-[10px] ${inputText.length > MAX_CHARS * 0.9 ? 'text-red-400' : 'text-slate-600'} w-8 text-right`}>
                {inputText.length > 0 && `${MAX_CHARS - inputText.length}`}
            </span>

            <button 
              type="submit" 
              disabled={!inputText.trim() || !isConnected}
              className={`p-2 rounded-lg transition-all shrink-0 ${
                inputText.trim() && isConnected
                    ? 'bg-indigo-600 text-white hover:bg-indigo-500 shadow-lg shadow-indigo-500/20' 
                    : 'bg-slate-800 text-slate-600 cursor-not-allowed'
              }`}
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
          {!isConnected && !USE_MOCK_SERVER && (
              <div className="absolute top-0 left-0 w-full h-full bg-slate-900/50 backdrop-blur-[1px] flex items-center justify-center rounded-xl z-10">
                  <div className="flex items-center gap-2 text-red-400 bg-slate-900 px-4 py-2 rounded-full border border-red-900/50 shadow-xl">
                      <WifiOff className="w-4 h-4" />
                      <span className="text-xs font-bold">Reconnecting...</span>
                  </div>
              </div>
          )}
        </div>
      </main>
    </div>
  );
}