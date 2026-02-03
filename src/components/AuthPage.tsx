import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Heart, Eye, EyeOff, AlertCircle, CheckCircle2, ArrowLeft } from "lucide-react";
import { z } from "zod";

interface AuthPageProps {
  onAuthSuccess: () => void;
  defaultRole?: "patient" | "clinician" | null;
}

// Validation schemas
const emailSchema = z.string().email("Please enter a valid email address");
const passwordSchema = z.string().min(8, "Password must be at least 8 characters");
const nameSchema = z.string().min(2, "Name must be at least 2 characters").max(100, "Name is too long");
const phoneSchema = z.string().regex(/^(\+?254|0)?[17]\d{8}$/, "Please enter a valid Kenyan phone number").optional().or(z.literal(""));

export const AuthPage = ({ onAuthSuccess, defaultRole }: AuthPageProps) => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    fullName: "",
    phone: "",
    dateOfBirth: "",
    role: defaultRole === "clinician" ? "doctor" : defaultRole === "patient" ? "patient" : "",
    // Doctor specific fields
    specialization: "",
    licenseNumber: "",
    hospitalAffiliation: "",
    yearsOfExperience: "",
    consultationFee: "",
    availabilityHours: "",
    // Patient specific fields
    medicalHistory: "",
    emergencyContactName: "",
    emergencyContactPhone: "",
    insuranceProvider: "",
    insuranceId: ""
  });
  const { toast } = useToast();

  // Determine display mode based on defaultRole
  const isClinicianMode = defaultRole === "clinician";

  const validateField = (field: string, value: string): string | null => {
    try {
      switch (field) {
        case "email":
          emailSchema.parse(value);
          break;
        case "password":
          passwordSchema.parse(value);
          break;
        case "fullName":
          if (isSignUp) nameSchema.parse(value);
          break;
        case "phone":
          if (value) phoneSchema.parse(value);
          break;
      }
      return null;
    } catch (error) {
      if (error instanceof z.ZodError) {
        return error.errors[0].message;
      }
      return "Invalid input";
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    
    const emailError = validateField("email", formData.email);
    if (emailError) newErrors.email = emailError;
    
    const passwordError = validateField("password", formData.password);
    if (passwordError) newErrors.password = passwordError;
    
    if (isSignUp) {
      const nameError = validateField("fullName", formData.fullName);
      if (nameError) newErrors.fullName = nameError;
      
      // Only validate role if no default was provided
      if (!formData.role && !defaultRole) {
        newErrors.role = "Please select a role";
      }
      
      if (formData.role === 'doctor') {
        if (!formData.specialization) newErrors.specialization = "Specialization is required";
        if (!formData.licenseNumber) newErrors.licenseNumber = "License number is required";
      }
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      toast({
        title: "Validation Error",
        description: "Please fix the errors in the form",
        variant: "destructive",
      });
      return;
    }
    
    setLoading(true);

    try {
      if (isSignUp) {
        const { data, error } = await supabase.auth.signUp({
          email: formData.email.trim().toLowerCase(),
          password: formData.password,
          options: {
            emailRedirectTo: `${window.location.origin}/`,
            data: {
              full_name: formData.fullName.trim(),
              role: formData.role
            }
          }
        });

        if (error) throw error;

        if (data.user && !data.user.email_confirmed_at) {
          toast({
            title: "Account created successfully!",
            description: "Please check your email to verify your account, then complete your profile setup."
          });
        } else if (data.user) {
          // User is authenticated, create profile
          const { error: profileError } = await supabase
            .from('profiles')
            .insert({
              user_id: data.user.id,
              email: formData.email.trim().toLowerCase(),
              full_name: formData.fullName.trim(),
              phone: formData.phone || null,
              date_of_birth: formData.dateOfBirth || null,
            });

          if (profileError) throw profileError;

          // Create user role
          const roleValue = formData.role === 'doctor' ? 'clinician' : 'patient';
          const { error: roleError } = await supabase
            .from('user_roles')
            .insert({
              user_id: data.user.id,
              role: roleValue
            });
          
          if (roleError) throw roleError;

          // Create role-specific details
          if (formData.role === 'doctor') {
            const { error: doctorError } = await supabase
              .from('doctor_details')
              .insert({
                user_id: data.user.id,
                specialization: formData.specialization,
                license_number: formData.licenseNumber,
                hospital_affiliation: formData.hospitalAffiliation || null,
                years_of_experience: parseInt(formData.yearsOfExperience) || null,
                consultation_fee: parseFloat(formData.consultationFee) || null,
                availability_hours: formData.availabilityHours || null
              });

            if (doctorError) throw doctorError;
          } else if (formData.role === 'patient') {
            const { error: patientError } = await supabase
              .from('patient_details')
              .insert({
                user_id: data.user.id,
                medical_history: formData.medicalHistory || null,
                emergency_contact_name: formData.emergencyContactName || null,
                emergency_contact_phone: formData.emergencyContactPhone || null,
                insurance_provider: formData.insuranceProvider || null,
                insurance_id: formData.insuranceId || null
              });

            if (patientError) throw patientError;
          }

          toast({
            title: "Account created successfully!",
            description: "Please check your email to verify your account."
          });
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: formData.email.trim().toLowerCase(),
          password: formData.password
        });

        if (error) {
          if (error.message.includes("Invalid login credentials")) {
            throw new Error("Invalid email or password. Please check your credentials and try again.");
          }
          if (error.message.includes("Email not confirmed")) {
            throw new Error("Please verify your email address before signing in. Check your inbox for the verification link.");
          }
          throw error;
        }

        toast({
          title: "Welcome back!",
          description: "You have successfully signed in."
        });
        onAuthSuccess();
      }
    } catch (error: any) {
      console.error('Auth error:', error);
      toast({
        title: "Authentication Error",
        description: error.message || "An unexpected error occurred. Please try again.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: "" }));
    }
  };

  const handleBackToLanding = () => {
    window.location.reload();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/20 via-background to-secondary/20 flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-elevated">
        <CardHeader className="text-center">
          <button 
            onClick={handleBackToLanding}
            className="absolute top-4 left-4 p-2 hover:bg-muted rounded-lg transition-colors"
            aria-label="Go back"
          >
            <ArrowLeft className="h-5 w-5 text-muted-foreground" />
          </button>
          <div className="flex items-center justify-center gap-2 mb-2">
            <Heart className="h-8 w-8 text-primary" />
            <span className="text-2xl font-bold bg-gradient-primary bg-clip-text text-transparent">
              DiabeSure
            </span>
          </div>
          {isClinicianMode && (
            <Badge className="mx-auto mb-2 bg-secondary/20 text-secondary-foreground border-secondary/30">
              Clinician Portal
            </Badge>
          )}
          <CardTitle>
            {isSignUp 
              ? isClinicianMode ? "Register as Clinician" : "Create Patient Account" 
              : isClinicianMode ? "Clinician Sign In" : "Welcome Back"
            }
          </CardTitle>
          <CardDescription>
            {isSignUp 
              ? isClinicianMode 
                ? "Register to access the clinician dashboard and manage patients" 
                : "Join DiabeSure to manage your diabetes journey" 
              : isClinicianMode 
                ? "Sign in to access your clinician dashboard" 
                : "Sign in to continue your health journey"
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => handleInputChange("email", e.target.value)}
                placeholder="your.email@example.com"
                className={errors.email ? "border-destructive" : ""}
                required
                autoComplete="email"
                aria-describedby={errors.email ? "email-error" : undefined}
              />
              {errors.email && (
                <p id="email-error" className="text-sm text-destructive flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {errors.email}
                </p>
              )}
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={formData.password}
                  onChange={(e) => handleInputChange("password", e.target.value)}
                  placeholder={isSignUp ? "At least 8 characters" : "Enter your password"}
                  className={errors.password ? "border-destructive pr-10" : "pr-10"}
                  required
                  autoComplete={isSignUp ? "new-password" : "current-password"}
                  aria-describedby={errors.password ? "password-error" : undefined}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.password && (
                <p id="password-error" className="text-sm text-destructive flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {errors.password}
                </p>
              )}
            </div>

            {isSignUp && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="fullName">Full Name</Label>
                  <Input
                    id="fullName"
                    value={formData.fullName}
                    onChange={(e) => handleInputChange("fullName", e.target.value)}
                    placeholder="John Doe"
                    className={errors.fullName ? "border-destructive" : ""}
                    required
                    autoComplete="name"
                  />
                  {errors.fullName && (
                    <p className="text-sm text-destructive flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      {errors.fullName}
                    </p>
                  )}
                </div>

                {/* Only show role selector if no default role was specified */}
                {!defaultRole && (
                  <div className="space-y-2">
                    <Label htmlFor="role">I am a</Label>
                    <Select onValueChange={(value) => handleInputChange("role", value)} required>
                      <SelectTrigger className={errors.role ? "border-destructive" : ""}>
                        <SelectValue placeholder="Select your role" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="patient">Patient</SelectItem>
                        <SelectItem value="doctor">Doctor / Clinician</SelectItem>
                      </SelectContent>
                    </Select>
                    {errors.role && (
                      <p className="text-sm text-destructive flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        {errors.role}
                      </p>
                    )}
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="phone">Phone (Optional)</Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => handleInputChange("phone", e.target.value)}
                    placeholder="+254 7XX XXX XXX"
                    autoComplete="tel"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="dateOfBirth">Date of Birth</Label>
                  <Input
                    id="dateOfBirth"
                    type="date"
                    value={formData.dateOfBirth}
                    onChange={(e) => handleInputChange("dateOfBirth", e.target.value)}
                    max={new Date().toISOString().split('T')[0]}
                  />
                </div>

                {formData.role === 'doctor' && (
                  <>
                    <Alert className="bg-muted">
                      <CheckCircle2 className="h-4 w-4" />
                      <AlertDescription>
                        Please provide your professional details for verification
                      </AlertDescription>
                    </Alert>
                    <div className="space-y-2">
                      <Label htmlFor="specialization">Specialization *</Label>
                      <Input
                        id="specialization"
                        value={formData.specialization}
                        onChange={(e) => handleInputChange("specialization", e.target.value)}
                        placeholder="e.g., Endocrinology, Internal Medicine"
                        className={errors.specialization ? "border-destructive" : ""}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="licenseNumber">Medical License Number *</Label>
                      <Input
                        id="licenseNumber"
                        value={formData.licenseNumber}
                        onChange={(e) => handleInputChange("licenseNumber", e.target.value)}
                        placeholder="e.g., KMPDC/12345"
                        className={errors.licenseNumber ? "border-destructive" : ""}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="hospitalAffiliation">Hospital Affiliation</Label>
                      <Input
                        id="hospitalAffiliation"
                        value={formData.hospitalAffiliation}
                        onChange={(e) => handleInputChange("hospitalAffiliation", e.target.value)}
                        placeholder="e.g., JKUAT Hospital"
                      />
                    </div>
                  </>
                )}

                {formData.role === 'patient' && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="emergencyContactName">Emergency Contact Name</Label>
                      <Input
                        id="emergencyContactName"
                        value={formData.emergencyContactName}
                        onChange={(e) => handleInputChange("emergencyContactName", e.target.value)}
                        placeholder="Name of emergency contact"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="emergencyContactPhone">Emergency Contact Phone</Label>
                      <Input
                        id="emergencyContactPhone"
                        value={formData.emergencyContactPhone}
                        onChange={(e) => handleInputChange("emergencyContactPhone", e.target.value)}
                        placeholder="+254 7XX XXX XXX"
                        autoComplete="tel"
                      />
                    </div>
                  </>
                )}
              </>
            )}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  {isSignUp ? "Creating Account..." : "Signing In..."}
                </span>
              ) : (
                isSignUp ? "Create Account" : "Sign In"
              )}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <Button
              variant="link"
              onClick={() => {
                setIsSignUp(!isSignUp);
                setErrors({});
              }}
              className="text-sm"
            >
              {isSignUp ? "Already have an account? Sign in" : "Don't have an account? Sign up"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};