import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, Clock, MapPin, User, FileText, Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { exportAppointmentToCalendar, exportAllAppointments } from "@/utils/calendarExport";

interface Appointment {
  id: string;
  doctor_id: string;
  patient_id: string;
  start_time: string;
  end_time?: string;
  status: string;
  notes?: string;
  created_at: string;
}

interface AppointmentViewingProps {
  userId: string;
}

export const AppointmentViewing = ({ userId }: AppointmentViewingProps) => {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const loadAppointments = async () => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('appointments')
        .select('*')
        .eq('patient_id', userId)
        .order('start_time', { ascending: true });

      if (error) throw error;
      setAppointments(data || []);
    } catch (error) {
      console.error('Error loading appointments:', error);
      toast({
        title: "Error",
        description: "Failed to load appointments",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAppointments();

    const appointmentsSubscription = supabase
      .channel('appointments-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'appointments'
        },
        () => {
          loadAppointments();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(appointmentsSubscription);
    };
  }, [userId]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'scheduled':
        return 'bg-blue-100 text-blue-800';
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return {
      date: date.toLocaleDateString('en-KE', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      }),
      time: date.toLocaleTimeString('en-KE', { 
        hour: '2-digit', 
        minute: '2-digit' 
      })
    };
  };

  const upcomingAppointments = appointments.filter(
    apt => new Date(apt.start_time) >= new Date() && apt.status !== 'cancelled'
  );
  
  const pastAppointments = appointments.filter(
    apt => new Date(apt.start_time) < new Date() || apt.status === 'cancelled'
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">My Appointments</h2>
        <p className="text-muted-foreground">
          View your scheduled and past appointments with your clinician
        </p>
      </div>

      {/* Upcoming Appointments */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-semibold">Upcoming Appointments</h3>
          {upcomingAppointments.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                exportAllAppointments(upcomingAppointments);
                toast({
                  title: "Success",
                  description: "Appointments exported to calendar file",
                });
              }}
            >
              <Download className="h-4 w-4 mr-2" />
              Export All
            </Button>
          )}
        </div>
        {upcomingAppointments.length === 0 ? (
          <Card>
            <CardContent className="text-center py-8">
              <Calendar className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">No upcoming appointments</p>
              <p className="text-sm text-muted-foreground mt-2">
                Your clinician will schedule appointments for you
              </p>
            </CardContent>
          </Card>
        ) : (
          upcomingAppointments.map((appointment) => {
            const { date, time } = formatDateTime(appointment.start_time);
            return (
              <Card key={appointment.id} className="border-l-4 border-l-primary">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <CardTitle className="flex items-center gap-2">
                        <Calendar className="h-5 w-5 text-primary" />
                        Clinic Appointment
                      </CardTitle>
                      <CardDescription>{date}</CardDescription>
                    </div>
                    <Badge className={getStatusColor(appointment.status)}>
                      {appointment.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-4 text-sm">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span>{time}</span>
                    </div>
                    {appointment.end_time && (
                      <span className="text-muted-foreground">
                        - {formatDateTime(appointment.end_time).time}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <span>JKUAT Hospital</span>
                  </div>
                  {appointment.notes && (
                    <div className="flex items-start gap-2 text-sm p-3 bg-muted/50 rounded-lg">
                      <FileText className="h-4 w-4 text-muted-foreground mt-0.5" />
                      <div>
                        <p className="font-medium mb-1">Appointment Notes:</p>
                        <p className="text-muted-foreground">{appointment.notes}</p>
                      </div>
                    </div>
                  )}
                  <div className="flex gap-2 pt-2">
                    <Button
                      size="sm"
                      variant="default"
                      onClick={() => {
                        exportAppointmentToCalendar(appointment);
                        toast({
                          title: "Success",
                          description: "Appointment exported to calendar file",
                        });
                      }}
                    >
                      <Calendar className="h-4 w-4 mr-2" />
                      Add to Calendar
                    </Button>
                    <Button size="sm" variant="outline">
                      Request Reschedule
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* Past Appointments */}
      {pastAppointments.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-xl font-semibold">Past Appointments</h3>
          {pastAppointments.slice(0, 5).map((appointment) => {
            const { date, time } = formatDateTime(appointment.start_time);
            return (
              <Card key={appointment.id} className="opacity-75">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <CardTitle className="text-base">Clinic Appointment</CardTitle>
                      <CardDescription>{date} at {time}</CardDescription>
                    </div>
                    <Badge className={getStatusColor(appointment.status)} variant="outline">
                      {appointment.status}
                    </Badge>
                  </div>
                </CardHeader>
                {appointment.notes && (
                  <CardContent>
                    <p className="text-sm text-muted-foreground">{appointment.notes}</p>
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};