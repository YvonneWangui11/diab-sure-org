import { useState, useEffect, useCallback } from "react";
import { Navigation } from "@/components/Navigation";
import { Dashboard } from "@/components/Dashboard";
import { DoctorDashboard } from "@/components/DoctorDashboard";
import { AdminDashboard } from "@/components/AdminDashboard";
import { GlucoseTracking } from "@/components/GlucoseTracking";
import { NutritionTrackingEnhanced } from "@/components/NutritionTrackingEnhanced";
import { ExerciseTrackingEnhanced } from "@/components/ExerciseTrackingEnhanced";
import { AppointmentViewing } from "@/components/AppointmentViewing";
import { ProgressDashboard } from "@/components/ProgressDashboard";
import { EducationHub } from "@/components/EducationHub";
import { ProfilePage } from "@/components/ProfilePage";
import { LandingPage } from "@/components/LandingPage";
import { AuthPage } from "@/components/AuthPage";
import { FloatingYvonneButton } from "@/components/FloatingYvonneButton";
import { PageLoader } from "@/components/LoadingSpinner";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const Index = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userRole, setUserRole] = useState<string>("");
  const [currentPage, setCurrentPage] = useState("dashboard");
  const [showAuth, setShowAuth] = useState(false);
  const [userId, setUserId] = useState<string>("");
  const [isInitializing, setIsInitializing] = useState(true);
  const { toast } = useToast();

  const loadUserRole = useCallback(async (uid: string) => {
    try {
      const { data: roleData, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', uid)
        .maybeSingle();
      
      if (error) {
        console.error('Error loading user role:', error);
        return;
      }
      
      if (roleData) {
        setUserRole(roleData.role);
      }
    } catch (error) {
      console.error('Error loading user role:', error);
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    const initializeAuth = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('Session error:', error);
          if (mounted) setIsInitializing(false);
          return;
        }

        if (session && mounted) {
          setIsLoggedIn(true);
          setUserId(session.user.id);
          await loadUserRole(session.user.id);
        }
      } catch (error) {
        console.error('Auth initialization error:', error);
      } finally {
        if (mounted) setIsInitializing(false);
      }
    };

    initializeAuth();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;

        if (event === 'SIGNED_IN' && session) {
          setIsLoggedIn(true);
          setUserId(session.user.id);
          await loadUserRole(session.user.id);
          setShowAuth(false);
        } else if (event === 'SIGNED_OUT') {
          setIsLoggedIn(false);
          setUserRole("");
          setUserId("");
          setCurrentPage("dashboard");
          setShowAuth(false);
        } else if (event === 'TOKEN_REFRESHED') {
          // Token was refreshed, session is still valid
          console.log('Token refreshed');
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [loadUserRole]);

  const handleGetStarted = () => {
    setShowAuth(true);
  };

  const handleAuthSuccess = () => {
    setShowAuth(false);
  };

  const handleSignOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      
      setIsLoggedIn(false);
      setUserRole("");
      setUserId("");
      setShowAuth(false);
      setCurrentPage("dashboard");
      
      toast({
        title: "Signed out",
        description: "You have been successfully signed out.",
      });
    } catch (error) {
      console.error('Sign out error:', error);
      toast({
        title: "Error",
        description: "Failed to sign out. Please try again.",
        variant: "destructive",
      });
    }
  };

  const renderCurrentPage = () => {
    switch (currentPage) {
      case "dashboard":
        if (userRole === 'admin') return <AdminDashboard />;
        return userRole === 'clinician' ? <DoctorDashboard /> : <Dashboard onNavigate={setCurrentPage} />;
      case "glucose":
        return userId ? <GlucoseTracking userId={userId} /> : null;
      case "nutrition":
        return userId ? <NutritionTrackingEnhanced userId={userId} /> : null;
      case "exercise":
        return userId ? <ExerciseTrackingEnhanced userId={userId} /> : null;
      case "appointments":
        return userId ? <AppointmentViewing userId={userId} /> : null;
      case "progress":
        return userId ? <ProgressDashboard userId={userId} /> : null;
      case "education":
        return <EducationHub />;
      case "profile":
        return <ProfilePage onSignOut={handleSignOut} />;
      default:
        if (userRole === 'admin') return <AdminDashboard />;
        return userRole === 'clinician' ? <DoctorDashboard /> : <Dashboard onNavigate={setCurrentPage} />;
    }
  };

  // Show loading state during initialization
  if (isInitializing) {
    return <PageLoader text="Loading DiabeSure..." />;
  }

  if (!isLoggedIn && !showAuth) {
    return <LandingPage onGetStarted={handleGetStarted} />;
  }

  if (showAuth) {
    return <AuthPage onAuthSuccess={handleAuthSuccess} />;
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation 
        currentPage={currentPage} 
        onPageChange={setCurrentPage}
        onSignOut={handleSignOut}
      />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {renderCurrentPage()}
      </main>
      <FloatingYvonneButton />
    </div>
  );
};

export default Index;
