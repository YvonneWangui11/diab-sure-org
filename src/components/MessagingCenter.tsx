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
import { MessageSquare, Send, Plus, User, Clock, CheckCheck, Search, Bell } from "lucide-react";
import { format } from "date-fns";

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
  const [patients, setPatients] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [hasNewMessage, setHasNewMessage] = useState(false);
  const { toast } = useToast();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const initialLoadRef = useRef(true);

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

  // Clear new message indicator when viewing conversation
  useEffect(() => {
    if (selectedConversation) {
      setHasNewMessage(false);
    }
  }, [selectedConversation]);

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

      await Promise.all([loadMessages(), loadPatients()]);
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

  const sendMessage = async () => {
    if (!newMessage.to_patient_id || !newMessage.content.trim()) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please select a patient and enter a message",
      });
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase.from("messages").insert({
        from_user_id: user.id,
        to_patient_id: newMessage.to_patient_id,
        subject: newMessage.subject || null,
        content: newMessage.content,
        status: "sent",
        sent_at: new Date().toISOString(),
      });

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

  const sendReply = async () => {
    if (!selectedConversation || !replyContent.trim()) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Determine if we're sending to a clinician or patient
      const messageData = isClinician
        ? {
            from_user_id: user.id,
            to_patient_id: selectedConversation,
            content: replyContent,
            status: "sent",
            sent_at: new Date().toISOString(),
          }
        : {
            from_user_id: user.id,
            to_clinician_id: selectedConversation,
            content: replyContent,
            status: "sent",
            sent_at: new Date().toISOString(),
          };

      const { error } = await supabase.from("messages").insert(messageData);

      if (error) throw error;

      toast({
        title: "Message sent",
        description: "Your reply has been sent",
      });

      setReplyContent("");
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    }
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
        const patient = patients.find(p => p.user_id === partnerId);
        conversationMap.set(partnerId, {
          partnerId,
          partnerName: patient?.full_name || "Unknown User",
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
              {isClinician ? "Send and receive messages with your patients" : "View messages from your healthcare team"}
            </CardDescription>
          </div>
          {isClinician && (
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
                    Send a message to one of your patients
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">To Patient</label>
                    <Select
                      value={newMessage.to_patient_id}
                      onValueChange={(value) => setNewMessage({ ...newMessage, to_patient_id: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select a patient" />
                      </SelectTrigger>
                      <SelectContent>
                        {patients.map((patient) => (
                          <SelectItem key={patient.user_id} value={patient.user_id}>
                            {patient.full_name}
                          </SelectItem>
                        ))}
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
          )}
        </div>
      </CardHeader>
      <CardContent className="flex-1 p-0 flex overflow-hidden">
        {/* Conversations List */}
        <div className="w-1/3 border-r flex flex-col">
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
        </div>

        {/* Message Thread */}
        <div className="flex-1 flex flex-col">
          {selectedConversation ? (
            <>
              <ScrollArea className="flex-1 p-4">
                <div className="space-y-4">
                  {selectedMessages.map((msg) => {
                    const isOwn = msg.from_user_id === currentUserId;
                    return (
                      <div
                        key={msg.id}
                        className={`flex ${isOwn ? "justify-end" : "justify-start"}`}
                      >
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
                          <div className={`flex items-center gap-1 mt-2 text-xs ${isOwn ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                            <Clock className="h-3 w-3" />
                            {format(new Date(msg.created_at), "p")}
                            {isOwn && msg.read_at && (
                              <CheckCheck className="h-3 w-3 ml-1" />
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>
              </ScrollArea>
              {/* Reply input - shown for both clinicians and patients */}
              <div className="p-3 border-t">
                <div className="flex gap-2">
                  <Textarea
                    placeholder="Type a reply..."
                    className="min-h-[60px] resize-none"
                    value={replyContent}
                    onChange={(e) => setReplyContent(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        if (replyContent.trim()) {
                          sendReply();
                        }
                      }
                    }}
                  />
                  <Button 
                    onClick={sendReply}
                    disabled={!replyContent.trim()}
                    className="self-end"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
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
