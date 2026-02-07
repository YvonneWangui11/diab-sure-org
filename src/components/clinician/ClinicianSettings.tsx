import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { 
  Settings, Bell, Shield, Clock, Save, User, 
  Building, Award, Phone, Mail, Calendar
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { LoadingSpinner } from "@/components/LoadingSpinner";

interface ClinicianSettingsProps {
  userId?: string;
}

export const ClinicianSettings = ({ userId }: ClinicianSettingsProps) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState({
    full_name: "",
    email: "",
    phone: "",
  });
  const [doctorDetails, setDoctorDetails] = useState({
    specialization: "",
    license_number: "",
    hospital_affiliation: "",
    years_of_experience: "",
    consultation_fee: "",
    availability_hours: "",
  });
  const [notificationSettings, setNotificationSettings] = useState({
    criticalAlerts: true,
    appointmentReminders: true,
    patientMessages: true,
    weeklyReports: false,
    emailNotifications: true,
    pushNotifications: true,
  });
  const { toast } = useToast();

  useEffect(() => {
    loadSettings();
  }, [userId]);

  const loadSettings = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const uid = userId || user?.id;
      if (!uid) return;

      const [profileRes, doctorRes] = await Promise.all([
        supabase.from("profiles").select("*").eq("user_id", uid).single(),
        supabase.from("doctor_details").select("*").eq("user_id", uid).single(),
      ]);

      if (profileRes.data) {
        setProfile({
          full_name: profileRes.data.full_name || "",
          email: profileRes.data.email || "",
          phone: profileRes.data.phone || "",
        });
      }

      if (doctorRes.data) {
        setDoctorDetails({
          specialization: doctorRes.data.specialization || "",
          license_number: doctorRes.data.license_number || "",
          hospital_affiliation: doctorRes.data.hospital_affiliation || "",
          years_of_experience: doctorRes.data.years_of_experience?.toString() || "",
          consultation_fee: doctorRes.data.consultation_fee?.toString() || "",
          availability_hours: doctorRes.data.availability_hours || "",
        });
      }
    } catch (error) {
      console.error("Error loading settings:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProfile = async () => {
    try {
      setSaving(true);
      const { data: { user } } = await supabase.auth.getUser();
      const uid = userId || user?.id;
      if (!uid) return;

      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          full_name: profile.full_name,
          phone: profile.phone,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", uid);

      if (profileError) throw profileError;

      const { error: doctorError } = await supabase
        .from("doctor_details")
        .update({
          specialization: doctorDetails.specialization,
          hospital_affiliation: doctorDetails.hospital_affiliation || null,
          years_of_experience: parseInt(doctorDetails.years_of_experience) || null,
          consultation_fee: parseFloat(doctorDetails.consultation_fee) || null,
          availability_hours: doctorDetails.availability_hours || null,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", uid);

      if (doctorError) throw doctorError;

      toast({
        title: "Settings Saved",
        description: "Your profile has been updated successfully.",
      });
    } catch (error) {
      console.error("Error saving settings:", error);
      toast({
        title: "Error",
        description: "Failed to save settings. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner size="lg" text="Loading settings..." />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Settings className="h-6 w-6" />
          Clinician Settings
        </h2>
        <p className="text-muted-foreground">
          Manage your profile and preferences
        </p>
      </div>

      {/* Profile Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Profile Information
          </CardTitle>
          <CardDescription>
            Update your personal and professional details
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="full_name">Full Name</Label>
              <Input
                id="full_name"
                value={profile.full_name}
                onChange={(e) => setProfile({ ...profile, full_name: e.target.value })}
                placeholder="Dr. John Doe"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  value={profile.email}
                  disabled
                  className="pl-10 bg-muted"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="phone"
                  value={profile.phone}
                  onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                  placeholder="+254 7XX XXX XXX"
                  className="pl-10"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Professional Details */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Award className="h-5 w-5" />
            Professional Details
          </CardTitle>
          <CardDescription>
            Your medical credentials and specialization
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="specialization">Specialization</Label>
              <Input
                id="specialization"
                value={doctorDetails.specialization}
                onChange={(e) => setDoctorDetails({ ...doctorDetails, specialization: e.target.value })}
                placeholder="e.g., Endocrinology"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="license_number">License Number</Label>
              <div className="relative">
                <Shield className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="license_number"
                  value={doctorDetails.license_number}
                  disabled
                  className="pl-10 bg-muted"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Contact admin to update license number
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="hospital">Hospital Affiliation</Label>
              <div className="relative">
                <Building className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="hospital"
                  value={doctorDetails.hospital_affiliation}
                  onChange={(e) => setDoctorDetails({ ...doctorDetails, hospital_affiliation: e.target.value })}
                  placeholder="JKUAT Hospital"
                  className="pl-10"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="experience">Years of Experience</Label>
              <Input
                id="experience"
                type="number"
                value={doctorDetails.years_of_experience}
                onChange={(e) => setDoctorDetails({ ...doctorDetails, years_of_experience: e.target.value })}
                placeholder="10"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fee">Consultation Fee (KES)</Label>
              <Input
                id="fee"
                type="number"
                value={doctorDetails.consultation_fee}
                onChange={(e) => setDoctorDetails({ ...doctorDetails, consultation_fee: e.target.value })}
                placeholder="2000"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="hours">Availability Hours</Label>
              <div className="relative">
                <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="hours"
                  value={doctorDetails.availability_hours}
                  onChange={(e) => setDoctorDetails({ ...doctorDetails, availability_hours: e.target.value })}
                  placeholder="Mon-Fri: 8AM-5PM"
                  className="pl-10"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Notification Preferences */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Notification Preferences
          </CardTitle>
          <CardDescription>
            Configure how you receive alerts and updates
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-base">Critical Alerts</Label>
                <p className="text-sm text-muted-foreground">
                  Receive immediate notifications for critical patient alerts
                </p>
              </div>
              <Switch
                checked={notificationSettings.criticalAlerts}
                onCheckedChange={(checked) => 
                  setNotificationSettings({ ...notificationSettings, criticalAlerts: checked })
                }
              />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-base">Appointment Reminders</Label>
                <p className="text-sm text-muted-foreground">
                  Get notified before scheduled appointments
                </p>
              </div>
              <Switch
                checked={notificationSettings.appointmentReminders}
                onCheckedChange={(checked) => 
                  setNotificationSettings({ ...notificationSettings, appointmentReminders: checked })
                }
              />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-base">Patient Messages</Label>
                <p className="text-sm text-muted-foreground">
                  Receive notifications for new patient messages
                </p>
              </div>
              <Switch
                checked={notificationSettings.patientMessages}
                onCheckedChange={(checked) => 
                  setNotificationSettings({ ...notificationSettings, patientMessages: checked })
                }
              />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-base">Weekly Reports</Label>
                <p className="text-sm text-muted-foreground">
                  Receive weekly summary of patient progress
                </p>
              </div>
              <Switch
                checked={notificationSettings.weeklyReports}
                onCheckedChange={(checked) => 
                  setNotificationSettings({ ...notificationSettings, weeklyReports: checked })
                }
              />
            </div>
          </div>

          <Separator />

          <div className="space-y-4">
            <h4 className="font-medium">Notification Channels</h4>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div className="flex items-center gap-3">
                  <Mail className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <Label className="text-base">Email</Label>
                    <p className="text-xs text-muted-foreground">Via email</p>
                  </div>
                </div>
                <Switch
                  checked={notificationSettings.emailNotifications}
                  onCheckedChange={(checked) => 
                    setNotificationSettings({ ...notificationSettings, emailNotifications: checked })
                  }
                />
              </div>
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div className="flex items-center gap-3">
                  <Bell className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <Label className="text-base">Push</Label>
                    <p className="text-xs text-muted-foreground">Browser notifications</p>
                  </div>
                </div>
                <Switch
                  checked={notificationSettings.pushNotifications}
                  onCheckedChange={(checked) => 
                    setNotificationSettings({ ...notificationSettings, pushNotifications: checked })
                  }
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={handleSaveProfile} disabled={saving} size="lg">
          {saving ? (
            <LoadingSpinner size="sm" className="mr-2" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          Save Changes
        </Button>
      </div>
    </div>
  );
};
