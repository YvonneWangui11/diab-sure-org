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
  Clock
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { MedicationManager } from "./MedicationManager";

interface UserProfile {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  phone?: string;
  date_of_birth?: string;
  role: string;
}

interface PatientDetails {
  id: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  insurance_provider?: string;
  insurance_id?: string;
  medical_history?: string;
  current_medications?: string[];
  allergies?: string[];
}

interface Medication {
  id: string;
  medication_name: string;
  dosage: string;
  frequency: string;
  instructions?: string;
  start_date: string;
  end_date?: string;
  is_active: boolean;
  patient_id: string;
  doctor_id: string;
}

interface MedicationLog {
  id: string;
  medication_id: string;
  taken_at: string;
  status: string;
  notes?: string;
}

export const Dashboard = () => {
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [patientDetails, setPatientDetails] = useState<PatientDetails | null>(null);
  const [medications, setMedications] = useState<Medication[]>([]);
  const [medicationLogs, setMedicationLogs] = useState<MedicationLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const { toast } = useToast();

  const loadUserData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Load profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (profile) {
        setUserProfile(profile);

        // Load patient details if user is a patient
        if (profile.role === 'patient') {
          const { data: patientData } = await supabase
            .from('patient_details')
            .select('*')
            .eq('user_id', user.id)
            .single();
          
          setPatientDetails(patientData);

          // Load medications for this patient
          const { data: meds, error: medsError } = await supabase
            .from('medications')
            .select('*')
            .eq('patient_id', user.id)
            .eq('is_active', true)
            .order('created_at', { ascending: false });

          if (medsError) throw medsError;
          setMedications(meds || []);

          // Load recent medication logs
          const { data: logs, error: logsError } = await supabase
            .from('medication_logs')
            .select('*')
            .eq('patient_id', user.id)
            .order('taken_at', { ascending: false })
            .limit(10);

          if (logsError) throw logsError;
          setMedicationLogs(logs || []);
        }
      }
    } catch (error) {
      console.error('Error loading user data:', error);
      toast({
        title: "Error",
        description: "Failed to load user data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUserData();
    
    // Set up real-time subscriptions
    const profileSubscription = supabase
      .channel('profile-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'profiles'
        },
        () => loadUserData()
      )
      .subscribe();

    const patientSubscription = supabase
      .channel('patient-details-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'patient_details'
        },
        () => loadUserData()
      )
      .subscribe();

    const medicationsSubscription = supabase
      .channel('medications-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'medications'
        },
        () => loadUserData()
      )
      .subscribe();

    const logsSubscription = supabase
      .channel('medication-logs-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'medication_logs'
        },
        () => loadUserData()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(profileSubscription);
      supabase.removeChannel(patientSubscription);
      supabase.removeChannel(medicationsSubscription);
      supabase.removeChannel(logsSubscription);
    };
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  const getWelcomeMessage = () => {
    if (!userProfile) return "Welcome back!";
    const firstName = userProfile.full_name?.split(' ')[0] || 'User';
    return `Welcome back, ${firstName}!`;
  };

  const getTodaysMedicationStats = () => {
    const today = new Date().toDateString();
    const todaysLogs = medicationLogs.filter(log => 
      new Date(log.taken_at).toDateString() === today
    );
    
    return {
      totalMedications: medications.length,
      takenToday: todaysLogs.length,
      compliance: medications.length > 0 ? Math.round((todaysLogs.length / medications.length) * 100) : 0
    };
  };

  const markMedicationAsTaken = async (medicationId: string) => {
    if (!userProfile) return;
    
    try {
      const { error } = await supabase
        .from('medication_logs')
        .insert({
          medication_id: medicationId,
          patient_id: userProfile.user_id,
          status: 'taken',
        });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Medication marked as taken",
      });

      loadUserData();
    } catch (error) {
      console.error('Error marking medication as taken:', error);
      toast({
        title: "Error",
        description: "Failed to log medication",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground">{getWelcomeMessage()} Here's your health overview.</p>
        </div>
        <Badge variant="outline" className="bg-success text-success-foreground">
          <CheckCircle className="h-4 w-4 mr-1" />
          All systems normal
        </Badge>
      </div>

      {/* Navigation Tabs */}
      <div className="flex space-x-1 mb-6">
        <Button 
          variant={activeTab === 'overview' ? 'default' : 'ghost'}
          onClick={() => setActiveTab('overview')}
        >
          Overview
        </Button>
        <Button 
          variant={activeTab === 'medications' ? 'default' : 'ghost'}
          onClick={() => setActiveTab('medications')}
        >
          Medications
        </Button>
      </div>

      {activeTab === 'overview' && (
        <>
          {/* Quick Stats */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card className="bg-gradient-card shadow-card cursor-pointer hover:shadow-lg transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Blood Glucose</p>
                    <p className="text-2xl font-bold text-foreground">--</p>
                    <p className="text-xs text-muted-foreground">No readings yet</p>
                  </div>
                  <Heart className="h-8 w-8 text-primary" />
                </div>
              </CardContent>
            </Card>

            <Card 
              className="bg-gradient-card shadow-card cursor-pointer hover:shadow-lg transition-shadow" 
              onClick={() => setActiveTab('medications')}
            >
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Medication</p>
                    <p className="text-2xl font-bold text-foreground">
                      {getTodaysMedicationStats().takenToday}/{getTodaysMedicationStats().totalMedications}
                    </p>
                    <p className="text-xs text-muted-foreground">Today's doses</p>
                  </div>
                  <Pill className="h-8 w-8 text-secondary" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-card shadow-card cursor-pointer hover:shadow-lg transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Exercise Today</p>
                    <p className="text-2xl font-bold text-foreground">--</p>
                    <p className="text-xs text-muted-foreground">No data yet</p>
                  </div>
                  <Activity className="h-8 w-8 text-accent" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-card shadow-card cursor-pointer hover:shadow-lg transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Next Appointment</p>
                    <p className="text-2xl font-bold text-foreground">--</p>
                    <p className="text-xs text-muted-foreground">No upcoming</p>
                  </div>
                  <Calendar className="h-8 w-8 text-primary" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Main Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Recent Medication Logs */}
            <Card className="lg:col-span-2 shadow-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Pill className="h-5 w-5 text-primary" />
                  Recent Medication Logs
                </CardTitle>
                <CardDescription>Your medication intake history</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {medicationLogs.length === 0 ? (
                    <div className="text-center py-8">
                      <Pill className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                      <p className="text-muted-foreground">No medication logs yet</p>
                      <p className="text-sm text-muted-foreground mt-2">
                        Start tracking your medications by clicking on the medications tab
                      </p>
                    </div>
                  ) : (
                    medicationLogs.slice(0, 5).map((log) => {
                      const medication = medications.find(med => med.id === log.medication_id);
                      return (
                        <div key={log.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                          <div>
                            <p className="font-medium">{medication?.medication_name || 'Unknown'}</p>
                            <p className="text-sm text-muted-foreground">
                              {new Date(log.taken_at).toLocaleDateString()} at {new Date(log.taken_at).toLocaleTimeString()}
                            </p>
                          </div>
                          <Badge className="bg-success text-success-foreground">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Taken
                          </Badge>
                        </div>
                      );
                    })
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Quick Actions & Alerts */}
            <div className="space-y-6">
              {/* Alerts */}
              <Card className="shadow-card">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-warning" />
                    Alerts & Reminders
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {medications.length > 0 ? (
                    medications.slice(0, 2).map((medication) => (
                      <div key={medication.id} className="flex items-start gap-3 p-3 bg-primary/10 rounded-lg border border-primary/20">
                        <Clock className="h-4 w-4 text-primary mt-0.5" />
                        <div className="text-sm">
                          <p className="font-medium">Medication Reminder</p>
                          <p className="text-muted-foreground">{medication.medication_name} - {medication.frequency}</p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-4">
                      <p className="text-sm text-muted-foreground">No active medications</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Quick Actions */}
              <Card className="shadow-card">
                <CardHeader>
                  <CardTitle>Quick Actions</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Button className="w-full" variant="default">
                    <Heart className="h-4 w-4 mr-2" />
                    Log Glucose Reading
                  </Button>
                  <Button 
                    className="w-full" 
                    variant="secondary"
                    onClick={() => setActiveTab('medications')}
                  >
                    <Pill className="h-4 w-4 mr-2" />
                    View Medications
                  </Button>
                  <Button className="w-full" variant="outline">
                    <Apple className="h-4 w-4 mr-2" />
                    Log Meal
                  </Button>
                </CardContent>
              </Card>

              {/* Progress */}
              <Card className="shadow-card">
                <CardHeader>
                  <CardTitle>Weekly Progress</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <div className="flex justify-between mb-2">
                      <span className="text-sm font-medium">Medication Adherence</span>
                      <span className="text-sm text-muted-foreground">{getTodaysMedicationStats().compliance}%</span>
                    </div>
                    <Progress value={getTodaysMedicationStats().compliance} className="h-2" />
                  </div>
                  <div>
                    <div className="flex justify-between mb-2">
                      <span className="text-sm font-medium">Exercise Goals</span>
                      <span className="text-sm text-muted-foreground">0%</span>
                    </div>
                    <Progress value={0} className="h-2" />
                  </div>
                  <div>
                    <div className="flex justify-between mb-2">
                      <span className="text-sm font-medium">Glucose in Range</span>
                      <span className="text-sm text-muted-foreground">0%</span>
                    </div>
                    <Progress value={0} className="h-2" />
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </>
      )}

      {activeTab === 'medications' && userProfile && (
        <MedicationManager userRole={userProfile.role} userId={userProfile.user_id} />
      )}
    </div>
  );
};