import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  User, Activity, Pill, Apple, Calendar, 
  AlertTriangle, TrendingUp, TrendingDown, Minus,
  MessageSquare, FileText, Clock, Heart
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format, subDays } from "date-fns";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, AreaChart, Area } from "recharts";

interface PatientQuickViewProps {
  patientId: string;
  patientName: string;
  onViewFullProfile: () => void;
  onSendMessage: () => void;
  onScheduleAppointment: () => void;
}

interface PatientStats {
  avgGlucose: number;
  glucoseTrend: "up" | "down" | "stable";
  adherenceRate: number;
  exerciseMinutes: number;
  recentAlerts: number;
}

interface GlucoseReading {
  date: string;
  value: number;
}

export const PatientQuickView = ({
  patientId,
  patientName,
  onViewFullProfile,
  onSendMessage,
  onScheduleAppointment,
}: PatientQuickViewProps) => {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<PatientStats | null>(null);
  const [glucoseData, setGlucoseData] = useState<GlucoseReading[]>([]);
  const [recentMeals, setRecentMeals] = useState<Array<{ date: string; description: string }>>([]);
  const [recentExercise, setRecentExercise] = useState<Array<{ date: string; type: string; duration: number }>>([]);
  const [prescriptions, setPrescriptions] = useState<Array<{ name: string; dosage: string; frequency: string }>>([]);

  useEffect(() => {
    loadPatientData();
  }, [patientId]);

  const loadPatientData = async () => {
    try {
      setLoading(true);
      const sevenDaysAgo = subDays(new Date(), 7).toISOString();

      // Fetch glucose readings
      const { data: glucose } = await supabase
        .from("glucose_readings")
        .select("*")
        .eq("patient_id", patientId)
        .gte("test_time", sevenDaysAgo)
        .order("test_time", { ascending: true });

      // Fetch meal logs
      const { data: meals } = await supabase
        .from("meal_logs")
        .select("*")
        .eq("patient_id", patientId)
        .gte("date_time", sevenDaysAgo)
        .order("date_time", { ascending: false })
        .limit(5);

      // Fetch exercise logs
      const { data: exercise } = await supabase
        .from("exercise_logs")
        .select("*")
        .eq("patient_id", patientId)
        .gte("date_time", sevenDaysAgo)
        .order("date_time", { ascending: false })
        .limit(5);

      // Fetch prescriptions
      const { data: rx } = await supabase
        .from("prescriptions")
        .select("*")
        .eq("patient_id", patientId)
        .eq("status", "active");

      // Fetch recent alerts count
      const { count: alertCount } = await supabase
        .from("health_alerts")
        .select("*", { count: "exact", head: true })
        .eq("patient_id", patientId)
        .eq("resolved", false);

      // Calculate stats
      const glucoseValues = glucose?.map((g) => g.glucose_value) || [];
      const avgGlucose = glucoseValues.length > 0 
        ? Math.round(glucoseValues.reduce((a, b) => a + b, 0) / glucoseValues.length)
        : 0;

      // Determine trend
      let glucoseTrend: "up" | "down" | "stable" = "stable";
      if (glucoseValues.length >= 3) {
        const recent = glucoseValues.slice(-3);
        const older = glucoseValues.slice(0, 3);
        const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
        const olderAvg = older.reduce((a, b) => a + b, 0) / older.length;
        if (recentAvg > olderAvg + 10) glucoseTrend = "up";
        else if (recentAvg < olderAvg - 10) glucoseTrend = "down";
      }

      const exerciseMinutes = exercise?.reduce((sum, e) => sum + e.duration_minutes, 0) || 0;

      setStats({
        avgGlucose,
        glucoseTrend,
        adherenceRate: 85, // Placeholder - would calculate from medication_intake
        exerciseMinutes,
        recentAlerts: alertCount || 0,
      });

      setGlucoseData(
        glucose?.map((g) => ({
          date: format(new Date(g.test_time), "MMM d"),
          value: g.glucose_value,
        })) || []
      );

      setRecentMeals(
        meals?.map((m) => ({
          date: format(new Date(m.date_time), "MMM d, h:mm a"),
          description: m.description,
        })) || []
      );

      setRecentExercise(
        exercise?.map((e) => ({
          date: format(new Date(e.date_time), "MMM d"),
          type: e.exercise_type,
          duration: e.duration_minutes,
        })) || []
      );

      setPrescriptions(
        rx?.map((p) => ({
          name: p.drug_name,
          dosage: p.dosage,
          frequency: p.frequency,
        })) || []
      );
    } catch (error) {
      console.error("Error loading patient data:", error);
    } finally {
      setLoading(false);
    }
  };

  const getTrendIcon = () => {
    if (stats?.glucoseTrend === "up") return <TrendingUp className="h-4 w-4 text-destructive" />;
    if (stats?.glucoseTrend === "down") return <TrendingDown className="h-4 w-4 text-success" />;
    return <Minus className="h-4 w-4 text-muted-foreground" />;
  };

  const getGlucoseStatus = (value: number) => {
    if (value < 70) return { label: "Low", color: "destructive" };
    if (value > 180) return { label: "High", color: "destructive" };
    if (value > 140) return { label: "Elevated", color: "warning" };
    return { label: "Normal", color: "success" };
  };

  if (loading) {
    return (
      <Card className="h-full">
        <CardContent className="flex items-center justify-center py-12">
          <LoadingSpinner size="lg" text="Loading patient data..." />
        </CardContent>
      </Card>
    );
  }

  const glucoseStatus = stats ? getGlucoseStatus(stats.avgGlucose) : { label: "N/A", color: "muted" };

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
              <User className="h-6 w-6 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">{patientName}</CardTitle>
              <CardDescription className="flex items-center gap-2">
                <Badge variant={stats?.recentAlerts ? "destructive" : "secondary"}>
                  {stats?.recentAlerts || 0} Active Alerts
                </Badge>
              </CardDescription>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="flex gap-2 mt-4">
          <Button size="sm" onClick={onViewFullProfile}>
            <FileText className="h-4 w-4 mr-1" />
            Full Profile
          </Button>
          <Button size="sm" variant="outline" onClick={onSendMessage}>
            <MessageSquare className="h-4 w-4 mr-1" />
            Message
          </Button>
          <Button size="sm" variant="outline" onClick={onScheduleAppointment}>
            <Calendar className="h-4 w-4 mr-1" />
            Schedule
          </Button>
        </div>
      </CardHeader>

      <CardContent className="flex-1 overflow-hidden">
        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="rounded-lg bg-muted/50 p-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground">Avg Glucose</span>
              {getTrendIcon()}
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold">{stats?.avgGlucose || "—"}</span>
              <span className="text-xs text-muted-foreground">mg/dL</span>
            </div>
            <Badge variant={glucoseStatus.color === "success" ? "default" : glucoseStatus.color === "warning" ? "secondary" : "destructive"} className="mt-1 text-xs">
              {glucoseStatus.label}
            </Badge>
          </div>

          <div className="rounded-lg bg-muted/50 p-3">
            <span className="text-xs text-muted-foreground">Adherence</span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold">{stats?.adherenceRate || 0}%</span>
            </div>
            <div className="w-full h-1.5 bg-muted rounded-full mt-2">
              <div 
                className="h-full bg-primary rounded-full transition-all" 
                style={{ width: `${stats?.adherenceRate || 0}%` }}
              />
            </div>
          </div>

          <div className="rounded-lg bg-muted/50 p-3">
            <span className="text-xs text-muted-foreground">Exercise (7d)</span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold">{stats?.exerciseMinutes || 0}</span>
              <span className="text-xs text-muted-foreground">min</span>
            </div>
          </div>

          <div className="rounded-lg bg-muted/50 p-3">
            <span className="text-xs text-muted-foreground">Active Rx</span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold">{prescriptions.length}</span>
              <span className="text-xs text-muted-foreground">medications</span>
            </div>
          </div>
        </div>

        {/* Glucose Trend Chart */}
        {glucoseData.length > 0 && (
          <div className="mb-4">
            <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
              <Activity className="h-4 w-4" />
              7-Day Glucose Trend
            </h4>
            <div className="h-[120px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={glucoseData}>
                  <defs>
                    <linearGradient id="glucoseGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                  <YAxis domain={[60, 200]} tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Area 
                    type="monotone" 
                    dataKey="value" 
                    stroke="hsl(var(--primary))" 
                    fill="url(#glucoseGradient)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Tabs for Details */}
        <Tabs defaultValue="medications" className="flex-1">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="medications" className="text-xs">
              <Pill className="h-3 w-3 mr-1" />
              Meds
            </TabsTrigger>
            <TabsTrigger value="meals" className="text-xs">
              <Apple className="h-3 w-3 mr-1" />
              Meals
            </TabsTrigger>
            <TabsTrigger value="exercise" className="text-xs">
              <Activity className="h-3 w-3 mr-1" />
              Exercise
            </TabsTrigger>
          </TabsList>

          <ScrollArea className="h-[150px] mt-2">
            <TabsContent value="medications" className="mt-0 space-y-2">
              {prescriptions.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No active prescriptions</p>
              ) : (
                prescriptions.map((rx, i) => (
                  <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-muted/30">
                    <div>
                      <p className="font-medium text-sm">{rx.name}</p>
                      <p className="text-xs text-muted-foreground">{rx.dosage} • {rx.frequency}</p>
                    </div>
                  </div>
                ))
              )}
            </TabsContent>

            <TabsContent value="meals" className="mt-0 space-y-2">
              {recentMeals.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No recent meals logged</p>
              ) : (
                recentMeals.map((meal, i) => (
                  <div key={i} className="p-2 rounded-lg bg-muted/30">
                    <p className="text-xs text-muted-foreground">{meal.date}</p>
                    <p className="text-sm truncate">{meal.description}</p>
                  </div>
                ))
              )}
            </TabsContent>

            <TabsContent value="exercise" className="mt-0 space-y-2">
              {recentExercise.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No recent exercise logged</p>
              ) : (
                recentExercise.map((ex, i) => (
                  <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-muted/30">
                    <div>
                      <p className="font-medium text-sm capitalize">{ex.type}</p>
                      <p className="text-xs text-muted-foreground">{ex.date}</p>
                    </div>
                    <Badge variant="secondary">{ex.duration} min</Badge>
                  </div>
                ))
              )}
            </TabsContent>
          </ScrollArea>
        </Tabs>
      </CardContent>
    </Card>
  );
};
