import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Users, Calendar, Activity, TrendingUp, MessageSquare, AlertTriangle, Clock, Stethoscope, UserPlus, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { PatientList } from "./PatientList";
import { PatientProgressView } from "./PatientProgressView";
import { AppointmentScheduling } from "./AppointmentScheduling";
import { MedicationManager } from "./MedicationManager";
import { MessagingCenter } from "./MessagingCenter";
import { EmptyState } from "./EmptyState";
import { AnnouncementBanner } from "./AnnouncementBanner";

interface ClinicianDashboardProps {
  userId: string;
  currentPage: string;
  onNavigate: (page: string) => void;
}

interface PatientSummary {
  id: string;
  patient_id: string;
  full_name: string;
  email: string;
  status: string;
}

interface HealthAlert {
  id: string;
  patient_id: string;
  alert_type: string;
  message: string;
  severity: string;
  resolved: boolean;
  created_at: string;
}

interface Appointment {
  id: string;
  patient_id: string;
  start_time: string;
  status: string;
  notes?: string;
}

export const ClinicianDashboard = ({ userId, currentPage, onNavigate }: ClinicianDashboardProps) => {
  const [userProfile, setUserProfile] = useState<any>(null);
  const [doctorDetails, setDoctorDetails] = useState<any>(null);
  const [patients, setPatients] = useState<PatientSummary[]>([]);
  const [healthAlerts, setHealthAlerts] = useState<HealthAlert[]>([]);
  const [todaysAppointments, setTodaysAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [selectedPatientName, setSelectedPatientName] = useState<string>('');
  const { toast } = useToast();

  useEffect(() => {
    if (userId) {
      loadClinicianData();

      const channel = supabase
        .channel('clinician-dashboard-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'doctor_patients' }, () => loadClinicianData())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'health_alerts' }, () => loadClinicianData())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments' }, () => loadClinicianData())
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [userId]);

  const loadClinicianData = async () => {
    try {
      // Load doctor profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .single();
      
      setUserProfile(profile);

      // Load doctor details
      const { data: doctorData } = await supabase
        .from('doctor_details')
        .select('*')
        .eq('user_id', userId)
        .single();
      
      setDoctorDetails(doctorData);

      // Load assigned patients
      const { data: patientRelations } = await supabase
        .from('doctor_patients')
        .select(`
          id,
          patient_id,
          status,
          profiles!doctor_patients_patient_id_fkey(full_name, email)
        `)
        .eq('doctor_id', userId)
        .eq('status', 'active');

      if (patientRelations) {
        const formattedPatients = patientRelations.map((rel: any) => ({
          id: rel.id,
          patient_id: rel.patient_id,
          full_name: rel.profiles?.full_name || 'Unknown',
          email: rel.profiles?.email || '',
          status: rel.status,
        }));
        setPatients(formattedPatients);
      }

      // Load unresolved health alerts for this doctor's patients
      const { data: alerts } = await supabase
        .from('health_alerts')
        .select('*')
        .eq('doctor_id', userId)
        .eq('resolved', false)
        .order('created_at', { ascending: false })
        .limit(10);
      
      setHealthAlerts(alerts || []);

      // Load today's appointments
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const { data: appointments } = await supabase
        .from('appointments')
        .select('*')
        .eq('doctor_id', userId)
        .gte('start_time', today.toISOString())
        .lt('start_time', tomorrow.toISOString())
        .order('start_time', { ascending: true });
      
      setTodaysAppointments(appointments || []);

    } catch (error) {
      console.error('Error loading clinician data:', error);
      toast({
        title: "Error",
        description: "Failed to load dashboard data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const resolveAlert = async (alertId: string) => {
    try {
      const { error } = await supabase
        .from('health_alerts')
        .update({ resolved: true, updated_at: new Date().toISOString() })
        .eq('id', alertId);

      if (error) throw error;

      toast({
        title: "Alert Resolved",
        description: "The health alert has been marked as resolved.",
      });
      
      loadClinicianData();
    } catch (error) {
      console.error('Error resolving alert:', error);
      toast({
        title: "Error",
        description: "Failed to resolve alert",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-secondary"></div>
      </div>
    );
  }

  const getDoctorName = () => userProfile?.full_name ? `Dr. ${userProfile.full_name}` : 'Doctor';
  const getSpecialization = () => doctorDetails?.specialization || 'General Practice';

  // Render different views based on currentPage
  const renderContent = () => {
    switch (currentPage) {
      case 'patients':
        if (selectedPatientId) {
          return (
            <div className="space-y-4">
              <Button variant="ghost" onClick={() => setSelectedPatientId(null)}>
                ← Back to Patient List
              </Button>
              <PatientProgressView patientId={selectedPatientId} patientName={selectedPatientName} />
            </div>
          );
        }
        return (
          <PatientList 
            doctorId={userId} 
            onSelectPatient={(patientId, patientName) => {
              setSelectedPatientId(patientId);
              setSelectedPatientName(patientName);
            }} 
          />
        );

      case 'appointments':
        return <AppointmentScheduling doctorId={userId} />;

      case 'prescriptions':
        return <MedicationManager userRole="doctor" userId={userId} />;

      case 'alerts':
        return (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-warning" />
                Health Alerts
              </CardTitle>
              <CardDescription>Monitor and respond to patient health alerts</CardDescription>
            </CardHeader>
            <CardContent>
              {healthAlerts.length === 0 ? (
                <EmptyState
                  icon={AlertTriangle}
                  title="No active alerts"
                  description="All patient alerts have been resolved."
                />
              ) : (
                <div className="space-y-4">
                  {healthAlerts.map((alert) => {
                    const patient = patients.find(p => p.patient_id === alert.patient_id);
                    return (
                      <div 
                        key={alert.id} 
                        className={`p-4 rounded-lg border ${
                          alert.severity === 'high' ? 'border-destructive/50 bg-destructive/5' :
                          alert.severity === 'medium' ? 'border-warning/50 bg-warning/5' :
                          'border-border bg-muted/50'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <Badge variant={alert.severity === 'high' ? 'destructive' : 'secondary'}>
                                {alert.severity}
                              </Badge>
                              <span className="font-medium">{alert.alert_type}</span>
                            </div>
                            <p className="text-sm text-muted-foreground mb-1">
                              Patient: {patient?.full_name || 'Unknown'}
                            </p>
                            <p className="text-sm">{alert.message}</p>
                            <p className="text-xs text-muted-foreground mt-2">
                              {new Date(alert.created_at).toLocaleString()}
                            </p>
                          </div>
                          <Button size="sm" variant="outline" onClick={() => resolveAlert(alert.id)}>
                            Resolve
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        );

      case 'messages':
        return <MessagingCenter userRole="clinician" />;

      case 'reports':
        return (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                Reports & Analytics
              </CardTitle>
              <CardDescription>Generate and view patient reports</CardDescription>
            </CardHeader>
            <CardContent>
              <EmptyState
                icon={FileText}
                title="Reports coming soon"
                description="Patient analytics and report generation will be available here."
              />
            </CardContent>
          </Card>
        );

      default:
        // Dashboard overview
        return (
          <>
            {/* Quick Stats */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card className="cursor-pointer hover:shadow-lg transition-all" onClick={() => onNavigate('patients')}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">My Patients</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{patients.length}</div>
                  <p className="text-xs text-muted-foreground">Active patients under your care</p>
                </CardContent>
              </Card>

              <Card className="cursor-pointer hover:shadow-lg transition-all" onClick={() => onNavigate('appointments')}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Today's Appointments</CardTitle>
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{todaysAppointments.length}</div>
                  <p className="text-xs text-muted-foreground">Scheduled for today</p>
                </CardContent>
              </Card>

              <Card className="cursor-pointer hover:shadow-lg transition-all" onClick={() => onNavigate('alerts')}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Active Alerts</CardTitle>
                  <AlertTriangle className="h-4 w-4 text-warning" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{healthAlerts.length}</div>
                  <p className="text-xs text-muted-foreground">Require attention</p>
                </CardContent>
              </Card>

              <Card className="cursor-pointer hover:shadow-lg transition-all" onClick={() => onNavigate('messages')}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Messages</CardTitle>
                  <MessageSquare className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">--</div>
                  <p className="text-xs text-muted-foreground">Patient communications</p>
                </CardContent>
              </Card>
            </div>

            {/* Main Content */}
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Today's Schedule */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="h-5 w-5 text-primary" />
                    Today's Schedule
                  </CardTitle>
                  <CardDescription>Your appointments for today</CardDescription>
                </CardHeader>
                <CardContent>
                  {todaysAppointments.length === 0 ? (
                    <EmptyState
                      icon={Calendar}
                      title="No appointments today"
                      description="Your schedule is clear for today."
                    />
                  ) : (
                    <div className="space-y-3">
                      {todaysAppointments.map((apt) => {
                        const patient = patients.find(p => p.patient_id === apt.patient_id);
                        return (
                          <div key={apt.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                            <div className="flex items-center gap-3">
                              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                                <Users className="h-5 w-5 text-primary" />
                              </div>
                              <div>
                                <p className="font-medium">{patient?.full_name || 'Unknown Patient'}</p>
                                <p className="text-sm text-muted-foreground">
                                  {new Date(apt.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </p>
                              </div>
                            </div>
                            <Badge variant={apt.status === 'confirmed' ? 'default' : 'secondary'}>
                              {apt.status}
                            </Badge>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Recent Alerts */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-warning" />
                    Recent Alerts
                  </CardTitle>
                  <CardDescription>Patient health alerts requiring attention</CardDescription>
                </CardHeader>
                <CardContent>
                  {healthAlerts.length === 0 ? (
                    <EmptyState
                      icon={AlertTriangle}
                      title="No active alerts"
                      description="All alerts have been addressed."
                    />
                  ) : (
                    <div className="space-y-3">
                      {healthAlerts.slice(0, 5).map((alert) => {
                        const patient = patients.find(p => p.patient_id === alert.patient_id);
                        return (
                          <div 
                            key={alert.id} 
                            className={`p-3 rounded-lg border ${
                              alert.severity === 'high' ? 'border-destructive/30 bg-destructive/5' : 'border-border bg-muted/50'
                            }`}
                          >
                            <div className="flex items-start justify-between">
                              <div>
                                <p className="font-medium text-sm">{patient?.full_name || 'Unknown'}</p>
                                <p className="text-sm text-muted-foreground">{alert.message}</p>
                              </div>
                              <Badge variant={alert.severity === 'high' ? 'destructive' : 'secondary'} className="text-xs">
                                {alert.severity}
                              </Badge>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
                <CardDescription>Common tasks for managing your practice</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-4">
                  <Button className="h-20 flex flex-col space-y-2" onClick={() => onNavigate('patients')}>
                    <Users className="h-6 w-6" />
                    <span>View Patients</span>
                  </Button>
                  <Button variant="outline" className="h-20 flex flex-col space-y-2" onClick={() => onNavigate('appointments')}>
                    <Calendar className="h-6 w-6" />
                    <span>Manage Appointments</span>
                  </Button>
                  <Button variant="outline" className="h-20 flex flex-col space-y-2" onClick={() => onNavigate('prescriptions')}>
                    <Activity className="h-6 w-6" />
                    <span>Prescribe Medication</span>
                  </Button>
                  <Button variant="outline" className="h-20 flex flex-col space-y-2" onClick={() => onNavigate('messages')}>
                    <MessageSquare className="h-6 w-6" />
                    <span>Send Message</span>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Announcements */}
      <AnnouncementBanner userRole="clinician" />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {currentPage === 'dashboard' ? 'Clinician Dashboard' : 
             currentPage === 'patients' ? 'My Patients' :
             currentPage === 'appointments' ? 'Appointments' :
             currentPage === 'prescriptions' ? 'Prescriptions' :
             currentPage === 'alerts' ? 'Health Alerts' :
             currentPage === 'messages' ? 'Messages' :
             currentPage === 'reports' ? 'Reports' : 'Dashboard'}
          </h1>
          <p className="text-muted-foreground">
            Welcome, {getDoctorName()} • {getSpecialization()}
          </p>
          {doctorDetails?.license_number && (
            <p className="text-sm text-muted-foreground">License: {doctorDetails.license_number}</p>
          )}
        </div>
        <Badge variant="secondary" className="h-fit bg-secondary/10 text-secondary border-secondary/30">
          <Stethoscope className="h-4 w-4 mr-1" />
          Clinician Portal
        </Badge>
      </div>

      {renderContent()}
    </div>
  );
};
