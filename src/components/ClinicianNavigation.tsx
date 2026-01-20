import { useState } from "react";
import { Menu, X, Heart, Users, Calendar, Pill, MessageSquare, User, LogOut, Activity, FileText, AlertTriangle, Stethoscope } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface ClinicianNavigationProps {
  currentPage: string;
  onPageChange: (page: string) => void;
  onSignOut?: () => void;
}

export const ClinicianNavigation = ({ currentPage, onPageChange, onSignOut }: ClinicianNavigationProps) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const menuItems = [
    { id: "dashboard", label: "Overview", icon: Activity },
    { id: "patients", label: "My Patients", icon: Users },
    { id: "appointments", label: "Appointments", icon: Calendar },
    { id: "prescriptions", label: "Prescriptions", icon: Pill },
    { id: "alerts", label: "Health Alerts", icon: AlertTriangle },
    { id: "messages", label: "Messages", icon: MessageSquare },
    { id: "reports", label: "Reports", icon: FileText },
    { id: "profile", label: "Profile", icon: User },
  ];

  return (
    <nav className="bg-card shadow-card border-b border-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <button 
            onClick={() => onPageChange('dashboard')}
            className="flex items-center space-x-2 hover:opacity-80 transition-opacity"
          >
            <Stethoscope className="h-8 w-8 text-secondary" />
            <span className="text-xl font-bold bg-gradient-primary bg-clip-text text-transparent">
              DiabeSure
            </span>
          </button>

          {/* Role Badge - Desktop */}
          <div className="hidden md:flex items-center">
            <Badge variant="outline" className="mr-4 bg-secondary/10 text-secondary border-secondary/30">
              Clinician Portal
            </Badge>
          </div>

          {/* Desktop Menu */}
          <div className="hidden lg:flex items-center space-x-1">
            {menuItems.slice(0, 6).map((item) => {
              const IconComponent = item.icon;
              return (
                <Button
                  key={item.id}
                  variant={currentPage === item.id ? "default" : "ghost"}
                  size="sm"
                  onClick={() => onPageChange(item.id)}
                  className="flex items-center space-x-1"
                >
                  <IconComponent className="h-4 w-4" />
                  <span className="hidden xl:inline">{item.label}</span>
                </Button>
              );
            })}
            <Button
              variant={currentPage === 'reports' ? "default" : "ghost"}
              size="sm"
              onClick={() => onPageChange('reports')}
            >
              <FileText className="h-4 w-4" />
            </Button>
            <Button
              variant={currentPage === 'profile' ? "default" : "ghost"}
              size="sm"
              onClick={() => onPageChange('profile')}
            >
              <User className="h-4 w-4" />
            </Button>
            <Button 
              variant="ghost" 
              size="sm" 
              className="ml-2 text-destructive"
              onClick={onSignOut}
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>

          {/* Mobile Menu Button */}
          <div className="lg:hidden">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
            >
              {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </Button>
          </div>
        </div>

        {/* Mobile Menu */}
        {isMenuOpen && (
          <div className="lg:hidden py-4 border-t border-border">
            <div className="mb-3">
              <Badge variant="outline" className="bg-secondary/10 text-secondary border-secondary/30">
                Clinician Portal
              </Badge>
            </div>
            <div className="flex flex-col space-y-2">
              {menuItems.map((item) => {
                const IconComponent = item.icon;
                return (
                  <Button
                    key={item.id}
                    variant={currentPage === item.id ? "default" : "ghost"}
                    size="sm"
                    onClick={() => {
                      onPageChange(item.id);
                      setIsMenuOpen(false);
                    }}
                    className="justify-start"
                  >
                    <IconComponent className="h-4 w-4 mr-2" />
                    {item.label}
                  </Button>
                );
              })}
              <Button 
                variant="ghost" 
                size="sm" 
                className="justify-start text-destructive"
                onClick={onSignOut}
              >
                <LogOut className="h-4 w-4 mr-2" />
                Logout
              </Button>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
};
