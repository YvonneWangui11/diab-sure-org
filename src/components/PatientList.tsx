import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Search, User, Calendar, Activity, UserPlus, X, Check, UserMinus, Mail, Phone } from "lucide-react";
import { LoadingSpinner } from "./LoadingSpinner";
import { format } from "date-fns";

interface Patient {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  phone: string;
  date_of_birth: string;
  status: string;
  last_activity?: string;
}

interface AvailablePatient {
  user_id: string;
  full_name: string;
  email: string;
  phone: string | null;
  date_of_birth: string | null;
}

interface PatientListProps {
  doctorId: string;
  onSelectPatient: (patientId: string, patientName: string) => void;
}

export const PatientList = ({ doctorId, onSelectPatient }: PatientListProps) => {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [availablePatients, setAvailablePatients] = useState<AvailablePatient[]>([]);
  const [availableSearchQuery, setAvailableSearchQuery] = useState("");
  const [loadingAvailable, setLoadingAvailable] = useState(false);
  const [addingPatient, setAddingPatient] = useState<string | null>(null);
  const [removeDialogOpen, setRemoveDialogOpen] = useState(false);
  const [patientToRemove, setPatientToRemove] = useState<Patient | null>(null);
  const [removingPatient, setRemovingPatient] = useState(false);
  const { toast } = useToast();

  const loadPatients = async () => {
    try {
      setLoading(true);
      
      // Get patients mapped to this doctor
      const { data: mappings, error: mappingsError } = await supabase
        .from('doctor_patients')
        .select('patient_id')
        .eq('doctor_id', doctorId)
        .eq('status', 'active');

      if (mappingsError) throw mappingsError;

      if (!mappings || mappings.length === 0) {
        setPatients([]);
        return;
      }

      const patientIds = mappings.map(m => m.patient_id);

      // Get patient profiles
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .in('user_id', patientIds);

      if (profilesError) throw profilesError;

      const formattedPatients: Patient[] = profiles?.map(profile => ({
        id: profile.id,
        user_id: profile.user_id,
        full_name: profile.full_name,
        email: profile.email,
        phone: profile.phone || '',
        date_of_birth: profile.date_of_birth || '',
        status: 'active',
      })) || [];

      setPatients(formattedPatients);
    } catch (error) {
      console.error('Error loading patients:', error);
      toast({
        title: "Error",
        description: "Failed to load patient list",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadAvailablePatients = async () => {
    try {
      setLoadingAvailable(true);

      // Get all users with patient role
      const { data: patientRoles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'patient');

      if (rolesError) throw rolesError;

      if (!patientRoles || patientRoles.length === 0) {
        setAvailablePatients([]);
        return;
      }

      const allPatientIds = patientRoles.map(r => r.user_id);

      // Get patients already assigned to this doctor
      const { data: existingMappings } = await supabase
        .from('doctor_patients')
        .select('patient_id')
        .eq('doctor_id', doctorId)
        .eq('status', 'active');

      const assignedPatientIds = new Set(existingMappings?.map(m => m.patient_id) || []);

      // Filter out already assigned patients
      const availablePatientIds = allPatientIds.filter(id => !assignedPatientIds.has(id));

      if (availablePatientIds.length === 0) {
        setAvailablePatients([]);
        return;
      }

      // Get profiles of available patients
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('user_id, full_name, email, phone, date_of_birth')
        .in('user_id', availablePatientIds);

      if (profilesError) throw profilesError;

      setAvailablePatients(profiles || []);
    } catch (error) {
      console.error('Error loading available patients:', error);
      toast({
        title: "Error",
        description: "Failed to load available patients",
        variant: "destructive",
      });
    } finally {
      setLoadingAvailable(false);
    }
  };

  const assignPatient = async (patientId: string) => {
    try {
      setAddingPatient(patientId);

      const { error } = await supabase
        .from('doctor_patients')
        .insert({
          doctor_id: doctorId,
          patient_id: patientId,
          status: 'active',
        });

      if (error) {
        // Check if it's a unique constraint violation (patient already assigned)
        if (error.code === '23505') {
          // Update existing record to active status
          const { error: updateError } = await supabase
            .from('doctor_patients')
            .update({ status: 'active' })
            .eq('doctor_id', doctorId)
            .eq('patient_id', patientId);

          if (updateError) throw updateError;
        } else {
          throw error;
        }
      }

      toast({
        title: "Patient Assigned",
        description: "Patient has been added to your roster",
      });

      // Refresh both lists
      await loadPatients();
      await loadAvailablePatients();
    } catch (error) {
      console.error('Error assigning patient:', error);
      toast({
        title: "Error",
        description: "Failed to assign patient",
        variant: "destructive",
      });
    } finally {
      setAddingPatient(null);
    }
  };

  const removePatient = async () => {
    if (!patientToRemove) return;

    try {
      setRemovingPatient(true);

      const { error } = await supabase
        .from('doctor_patients')
        .update({ status: 'inactive' })
        .eq('doctor_id', doctorId)
        .eq('patient_id', patientToRemove.user_id);

      if (error) throw error;

      toast({
        title: "Patient Removed",
        description: "Patient has been removed from your roster",
      });

      setRemoveDialogOpen(false);
      setPatientToRemove(null);
      await loadPatients();
    } catch (error) {
      console.error('Error removing patient:', error);
      toast({
        title: "Error",
        description: "Failed to remove patient",
        variant: "destructive",
      });
    } finally {
      setRemovingPatient(false);
    }
  };

  useEffect(() => {
    loadPatients();

    const subscription = supabase
      .channel('doctor-patients-changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'doctor_patients',
        filter: `doctor_id=eq.${doctorId}`
      }, () => {
        loadPatients();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [doctorId]);

  useEffect(() => {
    if (addDialogOpen) {
      loadAvailablePatients();
    }
  }, [addDialogOpen]);

  const filteredPatients = patients.filter(patient => 
    patient.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    patient.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredAvailablePatients = availablePatients.filter(patient =>
    patient.full_name.toLowerCase().includes(availableSearchQuery.toLowerCase()) ||
    patient.email.toLowerCase().includes(availableSearchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <LoadingSpinner size="lg" text="Loading patients..." />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">My Patients</h2>
          <p className="text-muted-foreground">Manage and monitor your patients</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="secondary">{patients.length} patients</Badge>
          <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <UserPlus className="h-4 w-4 mr-2" />
                Add Patient
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-hidden flex flex-col">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <UserPlus className="h-5 w-5" />
                  Add Patient to Roster
                </DialogTitle>
                <DialogDescription>
                  Search for patients and add them to your care roster
                </DialogDescription>
              </DialogHeader>
              
              <div className="relative mt-2">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name or email..."
                  value={availableSearchQuery}
                  onChange={(e) => setAvailableSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>

              <div className="flex-1 overflow-y-auto min-h-[200px] max-h-[400px] mt-4">
                {loadingAvailable ? (
                  <div className="flex items-center justify-center py-8">
                    <LoadingSpinner size="md" text="Loading patients..." />
                  </div>
                ) : filteredAvailablePatients.length === 0 ? (
                  <div className="text-center py-8">
                    <User className="h-12 w-12 mx-auto mb-3 text-muted-foreground opacity-50" />
                    <p className="text-muted-foreground">
                      {availableSearchQuery 
                        ? "No patients found matching your search" 
                        : "No unassigned patients available"}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {filteredAvailablePatients.map((patient) => (
                      <div
                        key={patient.user_id}
                        className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                            <User className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <p className="font-medium">{patient.full_name}</p>
                            <div className="flex items-center gap-3 text-sm text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Mail className="h-3 w-3" />
                                {patient.email}
                              </span>
                              {patient.phone && (
                                <span className="flex items-center gap-1">
                                  <Phone className="h-3 w-3" />
                                  {patient.phone}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <Button
                          size="sm"
                          onClick={() => assignPatient(patient.user_id)}
                          disabled={addingPatient === patient.user_id}
                        >
                          {addingPatient === patient.user_id ? (
                            <LoadingSpinner size="sm" />
                          ) : (
                            <>
                              <Check className="h-4 w-4 mr-1" />
                              Add
                            </>
                          )}
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <DialogFooter className="mt-4">
                <Button variant="outline" onClick={() => setAddDialogOpen(false)}>
                  Done
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by name or email..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      <div className="grid gap-4">
        {filteredPatients.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12">
              <User className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <h3 className="text-lg font-medium mb-2">
                {searchQuery ? 'No patients found' : 'No patients assigned yet'}
              </h3>
              <p className="text-muted-foreground mb-4">
                {searchQuery 
                  ? 'Try adjusting your search terms' 
                  : 'Add patients to your roster to start managing their care'}
              </p>
              {!searchQuery && (
                <Button onClick={() => setAddDialogOpen(true)}>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Add Your First Patient
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          filteredPatients.map((patient) => (
            <Card 
              key={patient.id} 
              className="hover:shadow-lg transition-shadow group"
            >
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div 
                    className="flex items-center gap-3 cursor-pointer flex-1"
                    onClick={() => onSelectPatient(patient.user_id, patient.full_name)}
                  >
                    <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                      <User className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="group-hover:text-primary transition-colors">
                        {patient.full_name}
                      </CardTitle>
                      <CardDescription>{patient.email}</CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
                      Active
                    </Badge>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                      onClick={(e) => {
                        e.stopPropagation();
                        setPatientToRemove(patient);
                        setRemoveDialogOpen(true);
                      }}
                    >
                      <UserMinus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div 
                  className="flex items-center gap-6 text-sm text-muted-foreground cursor-pointer"
                  onClick={() => onSelectPatient(patient.user_id, patient.full_name)}
                >
                  {patient.date_of_birth && (
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      Born: {format(new Date(patient.date_of_birth), 'MMM d, yyyy')}
                    </div>
                  )}
                  {patient.phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4" />
                      {patient.phone}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Remove Patient Confirmation Dialog */}
      <AlertDialog open={removeDialogOpen} onOpenChange={setRemoveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Patient from Roster?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove <strong>{patientToRemove?.full_name}</strong> from your patient roster? 
              You can add them back later if needed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={removingPatient}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={removePatient}
              disabled={removingPatient}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {removingPatient ? (
                <>
                  <LoadingSpinner size="sm" className="mr-2" />
                  Removing...
                </>
              ) : (
                <>
                  <UserMinus className="h-4 w-4 mr-2" />
                  Remove Patient
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
