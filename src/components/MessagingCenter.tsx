import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { MessageSquare, Send, Plus, User, Clock, CheckCheck, Search, Bell, Smile, Pin, PinOff, Reply, ChevronDown, ChevronRight, Paperclip, X, FileText, Image as ImageIcon, Download } from "lucide-react";
import { format } from "date-fns";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

const REACTION_EMOJIS = ["👍", "❤️", "✅", "😊", "👏", "🙏"];

interface MessageReaction {
  id: string;
  message_id: string;
  user_id: string;
  emoji: string;
  created_at: string;
}

interface PinnedMessage {
  id: string;
  message_id: string;
  user_id: string;
  pinned_at: string;
}

interface Message {
  id: string;
  from_user_id: string | null;
  to_patient_id: string | null;
  to_clinician_id: string | null;
  subject: string | null;
  content: string;
  status: string | null;
  sent_at: string | null;
  read_at: string | null;
  created_at: string;
  parent_message_id: string | null;
  thread_id: string | null;
  attachment_url: string | null;
  attachment_name: string | null;
  attachment_type: string | null;
}

interface UserProfile {
  user_id: string;
  full_name: string;
  email: string;
}

interface MessagingCenterProps {
  userRole: string;
}

export const MessagingCenter = ({ userRole }: MessagingCenterProps) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [reactions, setReactions] = useState<MessageReaction[]>([]);
  const [pinnedMessages, setPinnedMessages] = useState<PinnedMessage[]>([]);
  const [patients, setPatients] = useState<UserProfile[]>([]);
  const [clinicians, setClinicians] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [hasNewMessage, setHasNewMessage] = useState(false);
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState("conversations");
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [expandedThreads, setExpandedThreads] = useState<Set<string>>(new Set());
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const initialLoadRef = useRef(true);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const presenceChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const [newMessage, setNewMessage] = useState({
    to_patient_id: "",
    subject: "",
    content: "",
  });

  const isClinician = userRole === "clinician" || userRole === "admin";

  // Initialize notification sound
  useEffect(() => {
    audioRef.current = new Audio("https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3");
    audioRef.current.volume = 0.5;
  }, []);

  const playNotificationSound = () => {
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(() => {
        // Audio play failed - likely due to browser autoplay policy
      });
    }
  };

  useEffect(() => {
    initializeData();

    // Real-time subscription for new messages
    const channel = supabase
      .channel("messages_changes")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
        },
        (payload) => {
          const newMsg = payload.new as Message;
          
          // Only notify if message is NOT from current user
          if (newMsg.from_user_id !== currentUserId && !initialLoadRef.current) {
            playNotificationSound();
            setHasNewMessage(true);
            
            toast({
              title: "New Message",
              description: "You have received a new message",
              duration: 4000,
            });
          }
          
          loadMessages();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "messages",
        },
        () => {
          loadMessages();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUserId]);

  // Mark messages as read and clear new message indicator when viewing conversation
  useEffect(() => {
    if (selectedConversation && currentUserId) {
      setHasNewMessage(false);
      markMessagesAsRead(selectedConversation);
    }
  }, [selectedConversation, currentUserId]);

  const markMessagesAsRead = async (partnerId: string) => {
    try {
      // Find unread messages from this partner to current user
      const unreadMessages = messages.filter(msg => 
        msg.from_user_id === partnerId &&
        (msg.to_patient_id === currentUserId || msg.to_clinician_id === currentUserId) &&
        !msg.read_at
      );

      if (unreadMessages.length === 0) return;

      const messageIds = unreadMessages.map(msg => msg.id);
      
      const { error } = await supabase
        .from("messages")
        .update({ read_at: new Date().toISOString() })
        .in("id", messageIds);

      if (error) throw error;
    } catch (error) {
      console.error("Error marking messages as read:", error);
    }
  };

  // Set up presence channel for typing indicators
  useEffect(() => {
    if (!currentUserId || !selectedConversation) return;

    const channelName = `typing:${[currentUserId, selectedConversation].sort().join('-')}`;
    
    presenceChannelRef.current = supabase.channel(channelName);
    
    presenceChannelRef.current
      .on('presence', { event: 'sync' }, () => {
        const state = presenceChannelRef.current?.presenceState() || {};
        const typing = new Set<string>();
        
        Object.values(state).forEach((presences: any) => {
          presences.forEach((presence: any) => {
            if (presence.isTyping && presence.userId !== currentUserId) {
              typing.add(presence.userId);
            }
          });
        });
        
        setTypingUsers(typing);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await presenceChannelRef.current?.track({
            userId: currentUserId,
            isTyping: false,
          });
        }
      });

    return () => {
      if (presenceChannelRef.current) {
        supabase.removeChannel(presenceChannelRef.current);
        presenceChannelRef.current = null;
      }
    };
  }, [currentUserId, selectedConversation]);

  // Handle typing indicator
  const handleTyping = () => {
    if (!presenceChannelRef.current || !currentUserId) return;

    // Update presence to show typing
    presenceChannelRef.current.track({
      userId: currentUserId,
      isTyping: true,
    });

    // Clear previous timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Set timeout to stop typing indicator after 2 seconds of inactivity
    typingTimeoutRef.current = setTimeout(() => {
      presenceChannelRef.current?.track({
        userId: currentUserId,
        isTyping: false,
      });
    }, 2000);
  };

  // Stop typing when message is sent
  const stopTyping = () => {
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    presenceChannelRef.current?.track({
      userId: currentUserId,
      isTyping: false,
    });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, selectedConversation]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const initializeData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setCurrentUserId(user.id);
      }

      await Promise.all([loadMessages(), loadPatients(), loadClinicians(), loadReactions(), loadPinnedMessages()]);
    } catch (error) {
      console.error("Error initializing data:", error);
    } finally {
      setLoading(false);
      // Mark initial load complete after a short delay to avoid false notifications
      setTimeout(() => {
        initialLoadRef.current = false;
      }, 1000);
    }
  };

  const loadMessages = async () => {
    try {
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .order("created_at", { ascending: true });

      if (error) throw error;
      setMessages(data || []);
    } catch (error: any) {
      console.error("Error loading messages:", error);
    }
  };

  const loadReactions = async () => {
    try {
      const { data, error } = await supabase
        .from("message_reactions")
        .select("*");

      if (error) throw error;
      setReactions(data || []);
    } catch (error: any) {
      console.error("Error loading reactions:", error);
    }
  };

  const toggleReaction = async (messageId: string, emoji: string) => {
    if (!currentUserId) return;

    try {
      // Check if reaction already exists
      const existingReaction = reactions.find(
        r => r.message_id === messageId && r.user_id === currentUserId && r.emoji === emoji
      );

      if (existingReaction) {
        // Remove reaction
        const { error } = await supabase
          .from("message_reactions")
          .delete()
          .eq("id", existingReaction.id);

        if (error) throw error;
        setReactions(prev => prev.filter(r => r.id !== existingReaction.id));
      } else {
        // Add reaction
        const { data, error } = await supabase
          .from("message_reactions")
          .insert({
            message_id: messageId,
            user_id: currentUserId,
            emoji: emoji,
          })
          .select()
          .single();

        if (error) throw error;
        if (data) {
          setReactions(prev => [...prev, data]);
        }
      }
    } catch (error: any) {
      console.error("Error toggling reaction:", error);
    }
  };

  const getMessageReactions = (messageId: string) => {
    const messageReactions = reactions.filter(r => r.message_id === messageId);
    const grouped = messageReactions.reduce((acc, r) => {
      if (!acc[r.emoji]) {
        acc[r.emoji] = { count: 0, hasOwn: false };
      }
      acc[r.emoji].count++;
      if (r.user_id === currentUserId) {
        acc[r.emoji].hasOwn = true;
      }
      return acc;
    }, {} as Record<string, { count: number; hasOwn: boolean }>);
    return grouped;
  };

  const loadPinnedMessages = async () => {
    try {
      const { data, error } = await supabase
        .from("pinned_messages")
        .select("*");

      if (error) throw error;
      setPinnedMessages(data || []);
    } catch (error: any) {
      console.error("Error loading pinned messages:", error);
    }
  };

  const togglePin = async (messageId: string) => {
    if (!currentUserId) return;

    try {
      const existingPin = pinnedMessages.find(
        p => p.message_id === messageId && p.user_id === currentUserId
      );

      if (existingPin) {
        // Unpin
        const { error } = await supabase
          .from("pinned_messages")
          .delete()
          .eq("id", existingPin.id);

        if (error) throw error;
        setPinnedMessages(prev => prev.filter(p => p.id !== existingPin.id));
        toast({
          title: "Message unpinned",
          description: "Message removed from pinned",
        });
      } else {
        // Pin
        const { data, error } = await supabase
          .from("pinned_messages")
          .insert({
            message_id: messageId,
            user_id: currentUserId,
          })
          .select()
          .single();

        if (error) throw error;
        if (data) {
          setPinnedMessages(prev => [...prev, data]);
          toast({
            title: "Message pinned",
            description: "Message saved to pinned for quick access",
          });
        }
      }
    } catch (error: any) {
      console.error("Error toggling pin:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update pin status",
      });
    }
  };

  const isMessagePinned = (messageId: string) => {
    return pinnedMessages.some(p => p.message_id === messageId && p.user_id === currentUserId);
  };

  const getPinnedMessagesList = () => {
    const pinnedIds = pinnedMessages.map(p => p.message_id);
    return messages.filter(m => pinnedIds.includes(m.id));
  };

  const loadPatients = async () => {
    if (!isClinician) return;

    try {
      // Get patients assigned to this clinician
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: mappings } = await supabase
        .from("doctor_patients")
        .select("patient_id")
        .eq("doctor_id", user.id)
        .eq("status", "active");

      if (mappings && mappings.length > 0) {
        const patientIds = mappings.map(m => m.patient_id);
        
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, full_name, email")
          .in("user_id", patientIds);

        setPatients(profiles || []);
      }
    } catch (error) {
      console.error("Error loading patients:", error);
    }
  };

  const loadClinicians = async () => {
    if (isClinician) return;

    try {
      // Get clinicians assigned to this patient
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: mappings } = await supabase
        .from("doctor_patients")
        .select("doctor_id")
        .eq("patient_id", user.id)
        .eq("status", "active");

      if (mappings && mappings.length > 0) {
        const doctorIds = mappings.map(m => m.doctor_id);
        
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, full_name, email")
          .in("user_id", doctorIds);

        setClinicians(profiles || []);
      }
    } catch (error) {
      console.error("Error loading clinicians:", error);
    }
  };

  const sendMessage = async () => {
    if (!newMessage.to_patient_id || !newMessage.content.trim()) {
      toast({
        variant: "destructive",
        title: "Error",
        description: isClinician ? "Please select a patient and enter a message" : "Please select a doctor and enter a message",
      });
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const messageData = isClinician
        ? {
            from_user_id: user.id,
            to_patient_id: newMessage.to_patient_id,
            subject: newMessage.subject || null,
            content: newMessage.content,
            status: "sent",
            sent_at: new Date().toISOString(),
          }
        : {
            from_user_id: user.id,
            to_clinician_id: newMessage.to_patient_id,
            subject: newMessage.subject || null,
            content: newMessage.content,
            status: "sent",
            sent_at: new Date().toISOString(),
          };

      const { error } = await supabase.from("messages").insert(messageData);

      if (error) throw error;

      toast({
        title: "Message sent",
        description: "Your message has been sent successfully",
      });

      setNewMessage({ to_patient_id: "", subject: "", content: "" });
      setDialogOpen(false);
      setSelectedConversation(newMessage.to_patient_id);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    }
  };

  const [replyContent, setReplyContent] = useState("");

  const uploadFile = async (file: File): Promise<{ url: string; name: string; type: string } | null> => {
    if (!currentUserId) return null;
    
    setUploadingFile(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${currentUserId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('message-attachments')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('message-attachments')
        .getPublicUrl(fileName);

      return {
        url: publicUrl,
        name: file.name,
        type: file.type,
      };
    } catch (error: any) {
      console.error('Upload error:', error);
      toast({
        variant: "destructive",
        title: "Upload failed",
        description: error.message,
      });
      return null;
    } finally {
      setUploadingFile(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Check file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        toast({
          variant: "destructive",
          title: "File too large",
          description: "Maximum file size is 10MB",
        });
        return;
      }
      setSelectedFile(file);
    }
  };

  const removeSelectedFile = () => {
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const isImageFile = (type: string | null) => {
    return type?.startsWith('image/');
  };

  const sendReply = async () => {
    if (!selectedConversation || (!replyContent.trim() && !selectedFile)) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Upload file if selected
      let attachmentData: { url: string; name: string; type: string } | null = null;
      if (selectedFile) {
        attachmentData = await uploadFile(selectedFile);
        if (!attachmentData && selectedFile) {
          return; // Upload failed, don't send message
        }
      }

      // Calculate thread_id: use existing thread_id or the parent message's id
      let threadId = null;
      if (replyingTo) {
        threadId = replyingTo.thread_id || replyingTo.id;
      }

      // Determine if we're sending to a clinician or patient
      const messageData = isClinician
        ? {
            from_user_id: user.id,
            to_patient_id: selectedConversation,
            content: replyContent || (attachmentData ? `📎 ${attachmentData.name}` : ''),
            status: "sent",
            sent_at: new Date().toISOString(),
            parent_message_id: replyingTo?.id || null,
            thread_id: threadId,
            attachment_url: attachmentData?.url || null,
            attachment_name: attachmentData?.name || null,
            attachment_type: attachmentData?.type || null,
          }
        : {
            from_user_id: user.id,
            to_clinician_id: selectedConversation,
            content: replyContent || (attachmentData ? `📎 ${attachmentData.name}` : ''),
            status: "sent",
            sent_at: new Date().toISOString(),
            parent_message_id: replyingTo?.id || null,
            thread_id: threadId,
            attachment_url: attachmentData?.url || null,
            attachment_name: attachmentData?.name || null,
            attachment_type: attachmentData?.type || null,
          };

      const { error } = await supabase.from("messages").insert(messageData);

      if (error) throw error;

      toast({
        title: "Message sent",
        description: replyingTo ? "Your reply has been sent" : "Your message has been sent",
      });

      setReplyContent("");
      setReplyingTo(null);
      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      stopTyping();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    }
  };

  const toggleThreadExpanded = (threadId: string) => {
    setExpandedThreads(prev => {
      const newSet = new Set(prev);
      if (newSet.has(threadId)) {
        newSet.delete(threadId);
      } else {
        newSet.add(threadId);
      }
      return newSet;
    });
  };

  // Get root messages (messages without parent_message_id or that are thread starters)
  const getRootMessages = (msgs: Message[]) => {
    return msgs.filter(msg => !msg.parent_message_id);
  };

  // Get replies for a specific message
  const getReplies = (parentId: string) => {
    return messages.filter(msg => msg.parent_message_id === parentId || msg.thread_id === parentId)
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  };

  // Get thread count for a message
  const getThreadCount = (messageId: string) => {
    return messages.filter(msg => msg.thread_id === messageId || msg.parent_message_id === messageId).length;
  };

  const getConversations = () => {
    const conversationMap = new Map<string, { 
      partnerId: string; 
      partnerName: string; 
      lastMessage: Message; 
      unreadCount: number 
    }>();

    messages.forEach((msg) => {
      const partnerId = msg.from_user_id === currentUserId 
        ? (msg.to_patient_id || msg.to_clinician_id) 
        : msg.from_user_id;

      if (!partnerId) return;

      const existing = conversationMap.get(partnerId);
      const isUnread = !msg.read_at && msg.from_user_id !== currentUserId;

      if (!existing || new Date(msg.created_at) > new Date(existing.lastMessage.created_at)) {
        // Look in both patients and clinicians lists
        const patient = patients.find(p => p.user_id === partnerId);
        const clinician = clinicians.find(c => c.user_id === partnerId);
        const partner = patient || clinician;
        conversationMap.set(partnerId, {
          partnerId,
          partnerName: partner?.full_name || "Unknown User",
          lastMessage: msg,
          unreadCount: (existing?.unreadCount || 0) + (isUnread ? 1 : 0),
        });
      } else if (isUnread) {
        existing.unreadCount++;
      }
    });

    return Array.from(conversationMap.values())
      .filter(conv => conv.partnerName.toLowerCase().includes(searchQuery.toLowerCase()))
      .sort((a, b) => new Date(b.lastMessage.created_at).getTime() - new Date(a.lastMessage.created_at).getTime());
  };

  const getConversationMessages = (partnerId: string) => {
    return messages.filter(msg => 
      (msg.from_user_id === partnerId && (msg.to_patient_id === currentUserId || msg.to_clinician_id === currentUserId)) ||
      (msg.from_user_id === currentUserId && (msg.to_patient_id === partnerId || msg.to_clinician_id === partnerId))
    );
  };

  const conversations = getConversations();
  const selectedMessages = selectedConversation ? getConversationMessages(selectedConversation) : [];

  if (loading) {
    return (
      <Card>
        <CardContent className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-[600px] flex flex-col">
      <CardHeader className="border-b">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <div className="relative">
                <MessageSquare className="h-5 w-5" />
                {hasNewMessage && (
                  <span className="absolute -top-1 -right-1 h-3 w-3 bg-destructive rounded-full animate-pulse" />
                )}
              </div>
              Messages
              {hasNewMessage && (
                <Badge variant="destructive" className="ml-2 animate-bounce">
                  <Bell className="h-3 w-3 mr-1" />
                  New
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              {isClinician ? "Send and receive messages with your patients" : "Send and receive messages with your healthcare team"}
            </CardDescription>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                New Message
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Send New Message</DialogTitle>
                <DialogDescription>
                  {isClinician ? "Send a message to one of your patients" : "Send a message to your healthcare provider"}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">{isClinician ? "To Patient" : "To Doctor"}</label>
                  <Select
                    value={newMessage.to_patient_id}
                    onValueChange={(value) => setNewMessage({ ...newMessage, to_patient_id: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={isClinician ? "Select a patient" : "Select a doctor"} />
                    </SelectTrigger>
                    <SelectContent>
                      {isClinician ? (
                        patients.map((patient) => (
                          <SelectItem key={patient.user_id} value={patient.user_id}>
                            {patient.full_name}
                          </SelectItem>
                        ))
                      ) : (
                        clinicians.map((clinician) => (
                          <SelectItem key={clinician.user_id} value={clinician.user_id}>
                            {clinician.full_name}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Subject (Optional)</label>
                  <Input
                    value={newMessage.subject}
                    onChange={(e) => setNewMessage({ ...newMessage, subject: e.target.value })}
                    placeholder="Message subject"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Message</label>
                  <Textarea
                    value={newMessage.content}
                    onChange={(e) => setNewMessage({ ...newMessage, content: e.target.value })}
                    placeholder="Type your message..."
                    rows={4}
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={sendMessage} disabled={!newMessage.content.trim() || !newMessage.to_patient_id}>
                    <Send className="h-4 w-4 mr-2" />
                    Send
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent className="flex-1 p-0 flex overflow-hidden">
        {/* Conversations List */}
        <div className="w-1/3 border-r flex flex-col">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col h-full">
            <TabsList className="w-full rounded-none border-b justify-start">
              <TabsTrigger value="conversations" className="flex-1">Messages</TabsTrigger>
              <TabsTrigger value="pinned" className="flex-1">
                <Pin className="h-3 w-3 mr-1" />
                Pinned ({pinnedMessages.length})
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="conversations" className="flex-1 flex flex-col m-0 data-[state=inactive]:hidden">
              <div className="p-3 border-b">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search conversations..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <ScrollArea className="flex-1">
                {conversations.length === 0 ? (
                  <div className="p-4 text-center text-muted-foreground">
                    No conversations yet
                  </div>
                ) : (
                  conversations.map((conv) => (
                    <div
                      key={conv.partnerId}
                      onClick={() => setSelectedConversation(conv.partnerId)}
                      className={`p-3 border-b cursor-pointer hover:bg-accent/50 transition-colors ${
                        selectedConversation === conv.partnerId ? "bg-accent" : ""
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <User className="h-5 w-5 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <span className="font-medium truncate">{conv.partnerName}</span>
                            {conv.unreadCount > 0 && (
                              <Badge variant="default" className="ml-2">
                                {conv.unreadCount}
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground truncate">
                            {conv.lastMessage.content}
                          </p>
                          <span className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                            <Clock className="h-3 w-3" />
                            {format(new Date(conv.lastMessage.created_at), "PP")}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </ScrollArea>
            </TabsContent>

            <TabsContent value="pinned" className="flex-1 flex flex-col m-0 data-[state=inactive]:hidden">
              <ScrollArea className="flex-1">
                {getPinnedMessagesList().length === 0 ? (
                  <div className="p-4 text-center text-muted-foreground">
                    <Pin className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>No pinned messages</p>
                    <p className="text-xs mt-1">Pin important messages for quick access</p>
                  </div>
                ) : (
                  getPinnedMessagesList().map((msg) => {
                    const isOwn = msg.from_user_id === currentUserId;
                    const partnerId = isOwn ? (msg.to_patient_id || msg.to_clinician_id) : msg.from_user_id;
                    const patient = patients.find(p => p.user_id === partnerId);
                    const clinician = clinicians.find(c => c.user_id === partnerId);
                    const partner = patient || clinician;
                    return (
                      <div
                        key={msg.id}
                        className="p-3 border-b hover:bg-accent/50 transition-colors"
                      >
                        <div className="flex items-start gap-2">
                          <Pin className="h-4 w-4 text-primary mt-1 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium">
                                {isOwn ? "You" : partner?.full_name || "Unknown"}
                              </span>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0"
                                onClick={() => togglePin(msg.id)}
                              >
                                <PinOff className="h-3 w-3" />
                              </Button>
                            </div>
                            <p className="text-sm text-muted-foreground truncate">
                              {msg.content}
                            </p>
                            <span className="text-xs text-muted-foreground">
                              {format(new Date(msg.created_at), "PP p")}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </div>

        {/* Message Thread */}
        <div className="flex-1 flex flex-col">
          {selectedConversation ? (
            <>
              <ScrollArea className="flex-1 p-4">
                <div className="space-y-4">
                  {getRootMessages(selectedMessages).map((msg) => {
                    const isOwn = msg.from_user_id === currentUserId;
                    const msgReactions = getMessageReactions(msg.id);
                    const threadCount = getThreadCount(msg.id);
                    const isExpanded = expandedThreads.has(msg.id);
                    const replies = getReplies(msg.id);

                    return (
                      <div key={msg.id} className="space-y-2">
                        {/* Main message */}
                        <div className={`flex ${isOwn ? "justify-end" : "justify-start"}`}>
                          <div className="group relative">
                            <div
                              className={`max-w-[70%] rounded-lg p-3 ${
                                isOwn
                                  ? "bg-primary text-primary-foreground"
                                  : "bg-muted"
                              }`}
                            >
                              {msg.subject && (
                                <p className={`text-sm font-semibold mb-1 ${isOwn ? "text-primary-foreground/80" : "text-foreground"}`}>
                                  {msg.subject}
                                </p>
                              )}
                              <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                              
                              {/* Attachment display */}
                              {msg.attachment_url && (
                                <div className={`mt-2 ${isOwn ? "text-primary-foreground" : ""}`}>
                                  {isImageFile(msg.attachment_type) ? (
                                    <div className="relative">
                                      <img 
                                        src={msg.attachment_url} 
                                        alt={msg.attachment_name || "Attachment"}
                                        className="max-w-[200px] max-h-[200px] rounded-md object-cover cursor-pointer hover:opacity-90 transition-opacity"
                                        onClick={() => window.open(msg.attachment_url!, '_blank')}
                                      />
                                    </div>
                                  ) : (
                                    <a 
                                      href={msg.attachment_url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className={`flex items-center gap-2 p-2 rounded-md border ${isOwn ? "border-primary-foreground/30 hover:bg-primary-foreground/10" : "border-border bg-background hover:bg-accent"} transition-colors`}
                                    >
                                      <FileText className="h-4 w-4 flex-shrink-0" />
                                      <span className="text-xs truncate max-w-[150px]">{msg.attachment_name}</span>
                                      <Download className="h-3 w-3 flex-shrink-0" />
                                    </a>
                                  )}
                                </div>
                              )}
                              
                              <div className={`flex items-center gap-1 mt-2 text-xs ${isOwn ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                                <Clock className="h-3 w-3" />
                                {format(new Date(msg.created_at), "p")}
                                {isOwn && (
                                  <span className="flex items-center ml-1" title={msg.read_at ? `Read ${format(new Date(msg.read_at), "PP p")}` : "Sent"}>
                                    <CheckCheck className={`h-3 w-3 ${msg.read_at ? "text-blue-400" : "opacity-50"}`} />
                                    {msg.read_at && (
                                      <span className="ml-1 text-blue-400">Read</span>
                                    )}
                                  </span>
                                )}
                              </div>
                            </div>
                            
                            {/* Reactions display */}
                            {Object.keys(msgReactions).length > 0 && (
                              <div className={`flex flex-wrap gap-1 mt-1 ${isOwn ? "justify-end" : "justify-start"}`}>
                                {Object.entries(msgReactions).map(([emoji, data]) => (
                                  <button
                                    key={emoji}
                                    onClick={() => toggleReaction(msg.id, emoji)}
                                    className={`text-xs px-1.5 py-0.5 rounded-full border transition-colors ${
                                      data.hasOwn 
                                        ? "bg-primary/20 border-primary" 
                                        : "bg-muted border-border hover:bg-accent"
                                    }`}
                                  >
                                    {emoji} {data.count > 1 && data.count}
                                  </button>
                                ))}
                              </div>
                            )}
                            
                            {/* Action buttons */}
                            <div className={`absolute ${isOwn ? "-left-20" : "-right-20"} top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1`}>
                              {/* Reply button */}
                              <button
                                onClick={() => setReplyingTo(msg)}
                                className="p-1 rounded-full hover:bg-accent text-muted-foreground"
                                title="Reply to this message"
                              >
                                <Reply className="h-4 w-4" />
                              </button>
                              
                              {/* Pin button */}
                              <button
                                onClick={() => togglePin(msg.id)}
                                className={`p-1 rounded-full hover:bg-accent ${isMessagePinned(msg.id) ? "text-primary" : "text-muted-foreground"}`}
                                title={isMessagePinned(msg.id) ? "Unpin message" : "Pin message"}
                              >
                                {isMessagePinned(msg.id) ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
                              </button>
                              
                              {/* Reaction picker */}
                              <Popover>
                                <PopoverTrigger asChild>
                                  <button className="p-1 rounded-full hover:bg-accent">
                                    <Smile className="h-4 w-4 text-muted-foreground" />
                                  </button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-2" side={isOwn ? "left" : "right"}>
                                  <div className="flex gap-1">
                                    {REACTION_EMOJIS.map((emoji) => (
                                      <button
                                        key={emoji}
                                        onClick={() => toggleReaction(msg.id, emoji)}
                                        className={`text-lg p-1 rounded hover:bg-accent transition-colors ${
                                          msgReactions[emoji]?.hasOwn ? "bg-primary/20" : ""
                                        }`}
                                      >
                                        {emoji}
                                      </button>
                                    ))}
                                  </div>
                                </PopoverContent>
                              </Popover>
                            </div>
                          </div>
                        </div>

                        {/* Thread replies */}
                        {threadCount > 0 && (
                          <Collapsible open={isExpanded} onOpenChange={() => toggleThreadExpanded(msg.id)}>
                            <CollapsibleTrigger asChild>
                              <button className={`flex items-center gap-2 text-xs text-primary hover:underline ${isOwn ? "ml-auto mr-4" : "ml-4"}`}>
                                {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                                <MessageSquare className="h-3 w-3" />
                                {threadCount} {threadCount === 1 ? "reply" : "replies"}
                              </button>
                            </CollapsibleTrigger>
                            <CollapsibleContent>
                              <div className={`space-y-2 mt-2 ${isOwn ? "pr-6" : "pl-6"} border-l-2 border-primary/30 ml-4`}>
                                {replies.map((reply) => {
                                  const isReplyOwn = reply.from_user_id === currentUserId;
                                  const replyReactions = getMessageReactions(reply.id);
                                  
                                  return (
                                    <div key={reply.id} className={`flex ${isReplyOwn ? "justify-end" : "justify-start"}`}>
                                      <div className="group relative">
                                        <div
                                          className={`max-w-[60%] rounded-lg p-2 text-sm ${
                                            isReplyOwn
                                              ? "bg-primary/80 text-primary-foreground"
                                              : "bg-muted/80"
                                          }`}
                                        >
                                          <p className="whitespace-pre-wrap">{reply.content}</p>
                                          <div className={`flex items-center gap-1 mt-1 text-xs ${isReplyOwn ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                                            <Clock className="h-2.5 w-2.5" />
                                            {format(new Date(reply.created_at), "p")}
                                            {isReplyOwn && reply.read_at && (
                                              <CheckCheck className="h-2.5 w-2.5 text-blue-400" />
                                            )}
                                          </div>
                                        </div>
                                        
                                        {/* Reply reactions */}
                                        {Object.keys(replyReactions).length > 0 && (
                                          <div className={`flex flex-wrap gap-1 mt-1 ${isReplyOwn ? "justify-end" : "justify-start"}`}>
                                            {Object.entries(replyReactions).map(([emoji, data]) => (
                                              <button
                                                key={emoji}
                                                onClick={() => toggleReaction(reply.id, emoji)}
                                                className={`text-xs px-1 py-0.5 rounded-full border transition-colors ${
                                                  data.hasOwn 
                                                    ? "bg-primary/20 border-primary" 
                                                    : "bg-muted border-border hover:bg-accent"
                                                }`}
                                              >
                                                {emoji} {data.count > 1 && data.count}
                                              </button>
                                            ))}
                                          </div>
                                        )}
                                        
                                        {/* Reply action buttons */}
                                        <div className={`absolute ${isReplyOwn ? "-left-16" : "-right-16"} top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1`}>
                                          <button
                                            onClick={() => setReplyingTo(msg)}
                                            className="p-1 rounded-full hover:bg-accent text-muted-foreground"
                                            title="Reply"
                                          >
                                            <Reply className="h-3 w-3" />
                                          </button>
                                          <Popover>
                                            <PopoverTrigger asChild>
                                              <button className="p-1 rounded-full hover:bg-accent">
                                                <Smile className="h-3 w-3 text-muted-foreground" />
                                              </button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-auto p-2" side={isReplyOwn ? "left" : "right"}>
                                              <div className="flex gap-1">
                                                {REACTION_EMOJIS.map((emoji) => (
                                                  <button
                                                    key={emoji}
                                                    onClick={() => toggleReaction(reply.id, emoji)}
                                                    className={`text-lg p-1 rounded hover:bg-accent transition-colors ${
                                                      replyReactions[emoji]?.hasOwn ? "bg-primary/20" : ""
                                                    }`}
                                                  >
                                                    {emoji}
                                                  </button>
                                                ))}
                                              </div>
                                            </PopoverContent>
                                          </Popover>
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </CollapsibleContent>
                          </Collapsible>
                        )}
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>
              </ScrollArea>
              {/* Typing indicator */}
              {typingUsers.size > 0 && (
                <div className="px-4 py-2 border-t bg-muted/30">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <div className="flex gap-1">
                      <span className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                    <span>typing...</span>
                  </div>
                </div>
              )}
              
              {/* Replying to indicator */}
              {replyingTo && (
                <div className="px-3 py-2 border-t bg-primary/5 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm">
                    <Reply className="h-4 w-4 text-primary" />
                    <span className="text-muted-foreground">Replying to:</span>
                    <span className="text-foreground truncate max-w-[200px]">{replyingTo.content}</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                    onClick={() => setReplyingTo(null)}
                  >
                    ×
                  </Button>
                </div>
              )}
              
              {/* Selected file preview */}
              {selectedFile && (
                <div className="px-3 py-2 border-t bg-muted/30 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm">
                    {isImageFile(selectedFile.type) ? (
                      <ImageIcon className="h-4 w-4 text-primary" />
                    ) : (
                      <FileText className="h-4 w-4 text-primary" />
                    )}
                    <span className="truncate max-w-[200px]">{selectedFile.name}</span>
                    <span className="text-muted-foreground text-xs">
                      ({(selectedFile.size / 1024).toFixed(1)} KB)
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                    onClick={removeSelectedFile}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )}
              
              {/* Reply input - shown for both clinicians and patients */}
              <div className="p-3 border-t">
                <div className="flex gap-2">
                  <div className="flex-1 flex flex-col gap-2">
                    <Textarea
                      placeholder={replyingTo ? "Type your reply..." : "Type a message..."}
                      className="min-h-[60px] resize-none"
                      value={replyContent}
                      onChange={(e) => {
                        setReplyContent(e.target.value);
                        handleTyping();
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          if (replyContent.trim() || selectedFile) {
                            sendReply();
                          }
                        }
                      }}
                    />
                  </div>
                  <div className="flex flex-col gap-2 self-end">
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileSelect}
                      className="hidden"
                      accept="image/*,.pdf,.doc,.docx,.txt"
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadingFile}
                      title="Attach file"
                    >
                      <Paperclip className="h-4 w-4" />
                    </Button>
                    <Button 
                      onClick={sendReply}
                      disabled={(!replyContent.trim() && !selectedFile) || uploadingFile}
                    >
                      {uploadingFile ? (
                        <div className="h-4 w-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Select a conversation to view messages</p>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
