import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { 
  AlertTriangle, TrendingUp, Clock, Pill, MessageSquare, 
  Calendar, ChevronRight, Filter, RefreshCw, CheckCircle,
  User, MoreHorizontal, Eye, Send
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow, format } from "date-fns";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { EmptyState } from "@/components/EmptyState";

interface TriageItem {
  id: string;
  type: "alert" | "missed_dose" | "glucose_trend" | "no_activity" | "message";
  severity: "critical" | "warning" | "info";
  patientId: string;
  patientName: string;
  message: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
  resolved?: boolean;
}

interface TriageFeedProps {
  doctorId: string;
  onViewPatient: (patientId: string, patientName: string) => void;
  onSendMessage: (patientId: string, patientName: string) => void;
  onScheduleAppointment: (patientId: string, patientName: string) => void;
}

const severityConfig = {
  critical: {
    color: "bg-destructive text-destructive-foreground",
    icon: AlertTriangle,
    label: "Critical",
  },
  warning: {
    color: "bg-warning text-warning-foreground",
    icon: TrendingUp,
    label: "Warning",
  },
  info: {
    color: "bg-primary text-primary-foreground",
    icon: Clock,
    label: "Info",
  },
};

const typeConfig = {
  alert: { icon: AlertTriangle, label: "Health Alert" },
  missed_dose: { icon: Pill, label: "Missed Medication" },
  glucose_trend: { icon: TrendingUp, label: "Glucose Trend" },
  no_activity: { icon: Clock, label: "Inactivity" },
  message: { icon: MessageSquare, label: "Message" },
};

export const TriageFeed = ({
  doctorId,
  onViewPatient,
  onSendMessage,
  onScheduleAppointment,
}: TriageFeedProps) => {
  const [items, setItems] = useState<TriageItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<"all" | "critical" | "warning" | "info">("all");
  const { toast } = useToast();

  const loadTriageItems = async (showRefresh = false) => {
    try {
      if (showRefresh) setRefreshing(true);
      else setLoading(true);

      // Fetch health alerts
      const { data: alerts, error: alertsError } = await supabase
        .from("health_alerts")
        .select("*")
        .eq("doctor_id", doctorId)
        .eq("resolved", false)
        .order("created_at", { ascending: false })
        .limit(50);

      if (alertsError) throw alertsError;

      // Get patient profiles for all alerts
      const patientIds = [...new Set(alerts?.map((a) => a.patient_id) || [])];
      let profileMap = new Map<string, string>();

      if (patientIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, full_name")
          .in("user_id", patientIds);

        profileMap = new Map(profiles?.map((p) => [p.user_id, p.full_name]) || []);
      }

      // Transform alerts to triage items
      const triageItems: TriageItem[] = (alerts || []).map((alert) => ({
        id: alert.id,
        type: "alert" as const,
        severity: alert.severity as "critical" | "warning" | "info",
        patientId: alert.patient_id,
        patientName: profileMap.get(alert.patient_id) || "Unknown Patient",
        message: alert.message,
        timestamp: new Date(alert.created_at),
        metadata: { alertType: alert.alert_type },
        resolved: alert.resolved,
      }));

      // Sort by severity (critical first) then by timestamp
      triageItems.sort((a, b) => {
        const severityOrder = { critical: 0, warning: 1, info: 2 };
        if (severityOrder[a.severity] !== severityOrder[b.severity]) {
          return severityOrder[a.severity] - severityOrder[b.severity];
        }
        return b.timestamp.getTime() - a.timestamp.getTime();
      });

      setItems(triageItems);
    } catch (error) {
      console.error("Error loading triage items:", error);
      toast({
        title: "Error",
        description: "Failed to load triage feed",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleAcknowledge = async (itemId: string) => {
    try {
      const { error } = await supabase
        .from("health_alerts")
        .update({ resolved: true, updated_at: new Date().toISOString() })
        .eq("id", itemId);

      if (error) throw error;

      setItems((prev) => prev.filter((item) => item.id !== itemId));
      toast({
        title: "Alert Resolved",
        description: "The alert has been marked as resolved",
      });
    } catch (error) {
      console.error("Error acknowledging alert:", error);
      toast({
        title: "Error",
        description: "Failed to resolve alert",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    loadTriageItems();

    // Subscribe to real-time updates
    const channel = supabase
      .channel("triage-feed")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "health_alerts", filter: `doctor_id=eq.${doctorId}` },
        () => loadTriageItems(true)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [doctorId]);

  const filteredItems = items.filter(
    (item) => filter === "all" || item.severity === filter
  );

  const criticalCount = items.filter((i) => i.severity === "critical").length;
  const warningCount = items.filter((i) => i.severity === "warning").length;

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <LoadingSpinner size="lg" text="Loading triage feed..." />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4 border-b">
        <div>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Triage Feed
            {criticalCount > 0 && (
              <Badge variant="destructive" className="ml-2">
                {criticalCount} Critical
              </Badge>
            )}
          </CardTitle>
          <CardDescription>
            Prioritized patient items requiring attention
          </CardDescription>
        </div>
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Filter className="h-4 w-4 mr-2" />
                {filter === "all" ? "All" : severityConfig[filter].label}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => setFilter("all")}>
                All ({items.length})
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setFilter("critical")}>
                Critical ({criticalCount})
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setFilter("warning")}>
                Warning ({warningCount})
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setFilter("info")}>
                Info ({items.length - criticalCount - warningCount})
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => loadTriageItems(true)}
            disabled={refreshing}
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="flex-1 p-0">
        {filteredItems.length === 0 ? (
          <EmptyState
            icon={CheckCircle}
            title="All Clear!"
            description="No items require immediate attention"
            className="py-12"
          />
        ) : (
          <ScrollArea className="h-[calc(100vh-300px)] min-h-[400px]">
            <div className="divide-y divide-border">
              {filteredItems.map((item) => {
                const SeverityIcon = severityConfig[item.severity].icon;
                const TypeIcon = typeConfig[item.type].icon;

                return (
                  <div
                    key={item.id}
                    className="p-4 hover:bg-muted/50 transition-colors group"
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`p-2 rounded-full ${
                          item.severity === "critical"
                            ? "bg-destructive/10 text-destructive"
                            : item.severity === "warning"
                            ? "bg-warning/10 text-warning"
                            : "bg-primary/10 text-primary"
                        }`}
                      >
                        <SeverityIcon className="h-4 w-4" />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <button
                            onClick={() => onViewPatient(item.patientId, item.patientName)}
                            className="font-medium hover:text-primary transition-colors flex items-center gap-1"
                          >
                            <User className="h-3 w-3" />
                            {item.patientName}
                          </button>
                          <Badge variant="outline" className="text-xs">
                            <TypeIcon className="h-3 w-3 mr-1" />
                            {typeConfig[item.type].label}
                          </Badge>
                          <Badge className={`${severityConfig[item.severity].color} text-xs`}>
                            {severityConfig[item.severity].label}
                          </Badge>
                        </div>

                        <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                          {item.message}
                        </p>

                        <div className="flex items-center justify-between">
                          <span className="text-xs text-muted-foreground">
                            {formatDistanceToNow(item.timestamp, { addSuffix: true })}
                          </span>

                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => onViewPatient(item.patientId, item.patientName)}
                            >
                              <Eye className="h-3 w-3 mr-1" />
                              View
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => onSendMessage(item.patientId, item.patientName)}
                            >
                              <Send className="h-3 w-3 mr-1" />
                              Message
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => onScheduleAppointment(item.patientId, item.patientName)}
                            >
                              <Calendar className="h-3 w-3 mr-1" />
                              Schedule
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-success hover:text-success"
                              onClick={() => handleAcknowledge(item.id)}
                            >
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Resolve
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
};
