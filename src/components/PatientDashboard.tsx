import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Heart, 
  Pill, 
  Apple, 
  Activity, 
  Calendar, 
  TrendingUp, 
  AlertTriangle,
  CheckCircle,
  Clock,
  Target,
  Droplet
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { AnnouncementBanner } from "./AnnouncementBanner";
import { EmptyState } from "./EmptyState";

interface PatientDashboardProps {
  userId: string;
  onNavigate?: (page: string) => void;
}

interface Medication {
  id: string;
  medication_name: string;
  dosage: string;
  frequency: string;
  instructions?: string;
  is_active: boolean;
}

interface MedicationLog {
  id: string;
  medication_id: string;
  taken_at: string;
  status: string;
}

interface GlucoseReading {
  id: string;
  glucose_value: number;
  test_time: string;
  notes?: string;
}

interface Appointment {
  id: string;
  start_time: string;
  status: string;
  doctor_id: string;
}

export const PatientDashboard = ({ userId, onNavigate }: PatientDashboardProps) => {
  const [userProfile, setUserProfile] = useState<any>(null);
  const [medications, setMedications] = useState<Medication[]>([]);
  const [medicationLogs, setMedicationLogs] = useState<MedicationLog[]>([]);
  const [glucoseReadings, setGlucoseReadings] = useState<GlucoseReading[]>([]);
  const [upcomingAppointments, setUpcomingAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    if (userId) {
      loadDashboardData();
      
      // Real-time subscriptions
      const channel = supabase
        .channel('patient-dashboard-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'medications' }, () => loadDashboardData())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'medication_logs' }, () => loadDashboardData())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'glucose_readings' }, () => loadDashboardData())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments' }, () => loadDashboardData())
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [userId]);

  const loadDashboardData = async () => {
    try {
      // Load profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .single();
      
      setUserProfile(profile);

      // Load medications
      const { data: meds } = await supabase
        .from('medications')
        .select('*')
        .eq('patient_id', userId)
        .eq('is_active', true);
      
      setMedications(meds || []);

      // Load today's medication logs
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const { data: logs } = await supabase
        .from('medication_logs')
        .select('*')
        .eq('patient_id', userId)
        .gte('taken_at', today.toISOString())
        .order('taken_at', { ascending: false });
      
      setMedicationLogs(logs || []);

      // Load recent glucose readings
      const { data: glucose } = await supabase
        .from('glucose_readings')
        .select('*')
        .eq('patient_id', userId)
        .order('test_time', { ascending: false })
        .limit(7);
      
      setGlucoseReadings(glucose || []);

      // Load upcoming appointments
      const { data: appointments } = await supabase
        .from('appointments')
        .select('*')
        .eq('patient_id', userId)
        .gte('start_time', new Date().toISOString())
        .order('start_time', { ascending: true })
        .limit(3);
      
      setUpcomingAppointments(appointments || []);

    } catch (error) {
      console.error('Error loading dashboard data:', error);
      toast({
        title: "Error",
        description: "Failed to load dashboard data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const markMedicationAsTaken = async (medicationId: string) => {
    try {
      const { error } = await supabase
        .from('medication_logs')
        .insert({
          medication_id: medicationId,
          patient_id: userId,
          status: 'taken',
        });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Medication marked as taken!",
      });
      
      loadDashboardData();
    } catch (error) {
      console.error('Error marking medication:', error);
      toast({
        title: "Error",
        description: "Failed to log medication",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  const getFirstName = () => userProfile?.full_name?.split(' ')[0] || 'there';
  
  const getMedicationCompliance = () => {
    if (medications.length === 0) return 0;
    const takenToday = medicationLogs.filter(log => log.status === 'taken').length;
    return Math.min(Math.round((takenToday / medications.length) * 100), 100);
  };

  const getLatestGlucose = () => glucoseReadings[0]?.glucose_value || null;
  
  const getGlucoseStatus = (value: number | null) => {
    if (!value) return { label: 'No data', color: 'text-muted-foreground' };
    if (value < 70) return { label: 'Low', color: 'text-warning' };
    if (value > 180) return { label: 'High', color: 'text-destructive' };
    return { label: 'In range', color: 'text-success' };
  };

  const glucoseStatus = getGlucoseStatus(getLatestGlucose());

  return (
    <div className="space-y-6">
      {/* Announcements */}
      <AnnouncementBanner userRole="patient" />

      {/* Welcome Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">
            Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 18 ? 'afternoon' : 'evening'}, {getFirstName()}! 👋
          </h1>
          <p className="text-muted-foreground">Here's your daily health snapshot.</p>
        </div>
        <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">
          <Target className="h-4 w-4 mr-1" />
          Stay on track today
        </Badge>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Glucose Card */}
        <Card 
          className="cursor-pointer hover:shadow-lg transition-all hover:scale-[1.02]"
          onClick={() => onNavigate?.('glucose')}
        >
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Blood Glucose</p>
                <p className="text-2xl font-bold">
                  {getLatestGlucose() ? `${getLatestGlucose()} mg/dL` : '--'}
                </p>
                <p className={`text-sm ${glucoseStatus.color}`}>{glucoseStatus.label}</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Droplet className="h-6 w-6 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Medication Card */}
        <Card 
          className="cursor-pointer hover:shadow-lg transition-all hover:scale-[1.02]"
          onClick={() => onNavigate?.('medications')}
        >
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Today's Medications</p>
                <p className="text-2xl font-bold">
                  {medicationLogs.filter(l => l.status === 'taken').length}/{medications.length}
                </p>
                <p className="text-sm text-muted-foreground">{getMedicationCompliance()}% complete</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-secondary/10 flex items-center justify-center">
                <Pill className="h-6 w-6 text-secondary" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Exercise Card */}
        <Card 
          className="cursor-pointer hover:shadow-lg transition-all hover:scale-[1.02]"
          onClick={() => onNavigate?.('exercise')}
        >
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Today's Activity</p>
                <p className="text-2xl font-bold">Log Now</p>
                <p className="text-sm text-muted-foreground">Track your workout</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-accent/10 flex items-center justify-center">
                <Activity className="h-6 w-6 text-accent" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Appointments Card */}
        <Card 
          className="cursor-pointer hover:shadow-lg transition-all hover:scale-[1.02]"
          onClick={() => onNavigate?.('appointments')}
        >
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Next Appointment</p>
                {upcomingAppointments.length > 0 ? (
                  <>
                    <p className="text-lg font-bold">
                      {new Date(upcomingAppointments[0].start_time).toLocaleDateString()}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(upcomingAppointments[0].start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-2xl font-bold">--</p>
                    <p className="text-sm text-muted-foreground">No upcoming</p>
                  </>
                )}
              </div>
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Calendar className="h-6 w-6 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Medication Tracker */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Pill className="h-5 w-5 text-primary" />
              Today's Medications
            </CardTitle>
            <CardDescription>Track your medication intake</CardDescription>
          </CardHeader>
          <CardContent>
            {medications.length === 0 ? (
              <EmptyState
                icon={Pill}
                title="No medications assigned"
                description="Your doctor hasn't assigned any medications yet."
              />
            ) : (
              <div className="space-y-3">
                {medications.map((med) => {
                  const isTaken = medicationLogs.some(log => log.medication_id === med.id && log.status === 'taken');
                  return (
                    <div 
                      key={med.id} 
                      className={`flex items-center justify-between p-4 rounded-lg border ${
                        isTaken ? 'bg-success/10 border-success/30' : 'bg-muted/50 border-border'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`h-10 w-10 rounded-full flex items-center justify-center ${
                          isTaken ? 'bg-success/20' : 'bg-primary/10'
                        }`}>
                          {isTaken ? (
                            <CheckCircle className="h-5 w-5 text-success" />
                          ) : (
                            <Pill className="h-5 w-5 text-primary" />
                          )}
                        </div>
                        <div>
                          <p className="font-medium">{med.medication_name}</p>
                          <p className="text-sm text-muted-foreground">{med.dosage} • {med.frequency}</p>
                        </div>
                      </div>
                      {!isTaken && (
                        <Button 
                          size="sm" 
                          onClick={() => markMedicationAsTaken(med.id)}
                        >
                          Mark Taken
                        </Button>
                      )}
                      {isTaken && (
                        <Badge variant="outline" className="bg-success/10 text-success border-success/30">
                          Taken
                        </Badge>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions & Progress */}
        <div className="space-y-6">
          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button 
                className="w-full justify-start" 
                onClick={() => onNavigate?.('glucose')}
              >
                <Droplet className="h-4 w-4 mr-2" />
                Log Glucose Reading
              </Button>
              <Button 
                className="w-full justify-start" 
                variant="secondary"
                onClick={() => onNavigate?.('nutrition')}
              >
                <Apple className="h-4 w-4 mr-2" />
                Log Meal
              </Button>
              <Button 
                className="w-full justify-start" 
                variant="outline"
                onClick={() => onNavigate?.('exercise')}
              >
                <Activity className="h-4 w-4 mr-2" />
                Log Exercise
              </Button>
              <Button 
                className="w-full justify-start" 
                variant="outline"
                onClick={() => onNavigate?.('progress')}
              >
                <TrendingUp className="h-4 w-4 mr-2" />
                View Progress
              </Button>
            </CardContent>
          </Card>

          {/* Weekly Progress */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                Weekly Progress
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="flex justify-between mb-2">
                  <span className="text-sm font-medium">Medication Adherence</span>
                  <span className="text-sm text-muted-foreground">{getMedicationCompliance()}%</span>
                </div>
                <Progress value={getMedicationCompliance()} className="h-2" />
              </div>
              <div>
                <div className="flex justify-between mb-2">
                  <span className="text-sm font-medium">Glucose in Range</span>
                  <span className="text-sm text-muted-foreground">
                    {glucoseReadings.length > 0 
                      ? Math.round((glucoseReadings.filter(g => g.glucose_value >= 70 && g.glucose_value <= 180).length / glucoseReadings.length) * 100)
                      : 0}%
                  </span>
                </div>
                <Progress 
                  value={glucoseReadings.length > 0 
                    ? (glucoseReadings.filter(g => g.glucose_value >= 70 && g.glucose_value <= 180).length / glucoseReadings.length) * 100
                    : 0} 
                  className="h-2" 
                />
              </div>
            </CardContent>
          </Card>

          {/* Alerts */}
          {(getLatestGlucose() && (getLatestGlucose()! < 70 || getLatestGlucose()! > 180)) && (
            <Card className="border-warning/50 bg-warning/5">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-warning">
                  <AlertTriangle className="h-5 w-5" />
                  Health Alert
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm">
                  Your latest glucose reading ({getLatestGlucose()} mg/dL) is {getLatestGlucose()! < 70 ? 'below' : 'above'} the recommended range.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};
