import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Pill, Calendar, Clock, CheckCircle } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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

interface MedicationManagerProps {
  userRole: string;
  userId: string;
}

export const MedicationManager = ({ userRole, userId }: MedicationManagerProps) => {
  const [medications, setMedications] = useState<Medication[]>([]);
  const [medicationLogs, setMedicationLogs] = useState<MedicationLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddingMedication, setIsAddingMedication] = useState(false);
  const { toast } = useToast();

  // Form state for adding medication (doctor only)
  const [newMedication, setNewMedication] = useState({
    patient_id: '',
    medication_name: '',
    dosage: '',
    frequency: '',
    instructions: '',
    start_date: new Date().toISOString().split('T')[0],
    end_date: '',
  });

  // Load medications and logs
  const loadMedicationData = async () => {
    try {
      setLoading(true);
      
      if (userRole === 'doctor') {
        // Load all medications prescribed by this doctor
        const { data: meds, error: medsError } = await supabase
          .from('medications')
          .select('*')
          .eq('doctor_id', userId)
          .eq('is_active', true)
          .order('created_at', { ascending: false });

        if (medsError) throw medsError;
        setMedications(meds || []);

        // Load logs for these medications
        if (meds && meds.length > 0) {
          const medicationIds = meds.map(med => med.id);
          const { data: logs, error: logsError } = await supabase
            .from('medication_logs')
            .select('*')
            .in('medication_id', medicationIds)
            .order('taken_at', { ascending: false });

          if (logsError) throw logsError;
          setMedicationLogs(logs || []);
        }
      } else {
        // Load medications for this patient
        const { data: meds, error: medsError } = await supabase
          .from('medications')
          .select('*')
          .eq('patient_id', userId)
          .eq('is_active', true)
          .order('created_at', { ascending: false });

        if (medsError) throw medsError;
        setMedications(meds || []);

        // Load logs for this patient
        const { data: logs, error: logsError } = await supabase
          .from('medication_logs')
          .select('*')
          .eq('patient_id', userId)
          .order('taken_at', { ascending: false });

        if (logsError) throw logsError;
        setMedicationLogs(logs || []);
      }
    } catch (error) {
      console.error('Error loading medication data:', error);
      toast({
        title: "Error",
        description: "Failed to load medication data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Add new medication (doctor only)
  const handleAddMedication = async () => {
    try {
      const { error } = await supabase
        .from('medications')
        .insert({
          ...newMedication,
          doctor_id: userId,
          end_date: newMedication.end_date || null,
        });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Medication prescribed successfully",
      });

      setIsAddingMedication(false);
      setNewMedication({
        patient_id: '',
        medication_name: '',
        dosage: '',
        frequency: '',
        instructions: '',
        start_date: new Date().toISOString().split('T')[0],
        end_date: '',
      });
      loadMedicationData();
    } catch (error) {
      console.error('Error adding medication:', error);
      toast({
        title: "Error",
        description: "Failed to prescribe medication",
        variant: "destructive",
      });
    }
  };

  // Mark medication as taken (patient only)
  const handleMarkAsTaken = async (medicationId: string) => {
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
        description: "Medication marked as taken",
      });

      loadMedicationData();
    } catch (error) {
      console.error('Error marking medication as taken:', error);
      toast({
        title: "Error",
        description: "Failed to log medication",
        variant: "destructive",
      });
    }
  };

  // Get today's logs for a medication
  const getTodaysLogs = (medicationId: string) => {
    const today = new Date().toDateString();
    return medicationLogs.filter(log => 
      log.medication_id === medicationId && 
      new Date(log.taken_at).toDateString() === today
    );
  };

  // Set up real-time subscriptions
  useEffect(() => {
    loadMedicationData();

    const medicationsSubscription = supabase
      .channel('medications-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'medications'
        },
        () => {
          loadMedicationData();
        }
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
        () => {
          loadMedicationData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(medicationsSubscription);
      supabase.removeChannel(logsSubscription);
    };
  }, [userId, userRole]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Medication Management</h2>
          <p className="text-muted-foreground">
            {userRole === 'doctor' 
              ? 'Manage patient medications and monitor adherence' 
              : 'View your medications and track intake'
            }
          </p>
        </div>
        {userRole === 'doctor' && (
          <Dialog open={isAddingMedication} onOpenChange={setIsAddingMedication}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Prescribe Medication
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Prescribe New Medication</DialogTitle>
                <DialogDescription>
                  Add a new medication prescription for a patient
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="patient_id">Patient ID</Label>
                  <Input
                    id="patient_id"
                    value={newMedication.patient_id}
                    onChange={(e) => setNewMedication(prev => ({ ...prev, patient_id: e.target.value }))}
                    placeholder="Enter patient user ID"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="medication_name">Medication Name</Label>
                  <Input
                    id="medication_name"
                    value={newMedication.medication_name}
                    onChange={(e) => setNewMedication(prev => ({ ...prev, medication_name: e.target.value }))}
                    placeholder="e.g., Metformin"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="dosage">Dosage</Label>
                  <Input
                    id="dosage"
                    value={newMedication.dosage}
                    onChange={(e) => setNewMedication(prev => ({ ...prev, dosage: e.target.value }))}
                    placeholder="e.g., 500mg"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="frequency">Frequency</Label>
                  <Select
                    value={newMedication.frequency}
                    onValueChange={(value) => setNewMedication(prev => ({ ...prev, frequency: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select frequency" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Once daily">Once daily</SelectItem>
                      <SelectItem value="Twice daily">Twice daily</SelectItem>
                      <SelectItem value="Three times daily">Three times daily</SelectItem>
                      <SelectItem value="As needed">As needed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="instructions">Instructions</Label>
                  <Textarea
                    id="instructions"
                    value={newMedication.instructions}
                    onChange={(e) => setNewMedication(prev => ({ ...prev, instructions: e.target.value }))}
                    placeholder="Special instructions..."
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="grid gap-2">
                    <Label htmlFor="start_date">Start Date</Label>
                    <Input
                      id="start_date"
                      type="date"
                      value={newMedication.start_date}
                      onChange={(e) => setNewMedication(prev => ({ ...prev, start_date: e.target.value }))}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="end_date">End Date (Optional)</Label>
                    <Input
                      id="end_date"
                      type="date"
                      value={newMedication.end_date}
                      onChange={(e) => setNewMedication(prev => ({ ...prev, end_date: e.target.value }))}
                    />
                  </div>
                </div>
                <Button onClick={handleAddMedication} className="w-full">
                  Prescribe Medication
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="grid gap-4">
        {medications.length === 0 ? (
          <Card>
            <CardContent className="text-center py-8">
              <Pill className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">
                {userRole === 'doctor' 
                  ? 'No medications prescribed yet' 
                  : 'No medications prescribed for you yet'
                }
              </p>
            </CardContent>
          </Card>
        ) : (
          medications.map((medication) => {
            const todaysLogs = getTodaysLogs(medication.id);
            const isTakenToday = todaysLogs.length > 0;
            
            return (
              <Card key={medication.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Pill className="h-5 w-5" />
                        {medication.medication_name}
                      </CardTitle>
                      <CardDescription>
                        {medication.dosage} • {medication.frequency}
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      {isTakenToday && (
                        <Badge variant="secondary" className="bg-green-100 text-green-800">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Taken Today
                        </Badge>
                      )}
                      {userRole === 'patient' && !isTakenToday && (
                        <Button
                          size="sm"
                          onClick={() => handleMarkAsTaken(medication.id)}
                        >
                          Mark as Taken
                        </Button>
                      )}
                    </div>
                  </div>
                </CardHeader>
                {(medication.instructions || userRole === 'doctor') && (
                  <CardContent>
                    {medication.instructions && (
                      <p className="text-sm text-muted-foreground mb-2">
                        <strong>Instructions:</strong> {medication.instructions}
                      </p>
                    )}
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        Started: {new Date(medication.start_date).toLocaleDateString()}
                      </div>
                      {medication.end_date && (
                        <div className="flex items-center gap-1">
                          <Calendar className="h-4 w-4" />
                          Ends: {new Date(medication.end_date).toLocaleDateString()}
                        </div>
                      )}
                      {userRole === 'doctor' && (
                        <div className="flex items-center gap-1">
                          <Clock className="h-4 w-4" />
                          Logs today: {todaysLogs.length}
                        </div>
                      )}
                    </div>
                  </CardContent>
                )}
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
};