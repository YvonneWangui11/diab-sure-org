import { useState } from "react";
import { Menu, X, Heart, Activity, Calendar, BookOpen, User, LogOut, TrendingUp, Apple, Dumbbell, Droplet, MessageSquare, Pill } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface PatientNavigationProps {
  currentPage: string;
  onPageChange: (page: string) => void;
  onSignOut?: () => void;
}

export const PatientNavigation = ({ currentPage, onPageChange, onSignOut }: PatientNavigationProps) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const menuItems = [
    { id: "dashboard", label: "My Dashboard", icon: Activity },
    { id: "glucose", label: "Glucose", icon: Droplet },
    { id: "nutrition", label: "Nutrition", icon: Apple },
    { id: "exercise", label: "Exercise", icon: Dumbbell },
    { id: "medications", label: "Medications", icon: Pill },
    { id: "appointments", label: "My Appointments", icon: Calendar },
    { id: "progress", label: "My Progress", icon: TrendingUp },
    { id: "education", label: "Learn", icon: BookOpen },
    { id: "messages", label: "Messages", icon: MessageSquare },
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
            <Heart className="h-8 w-8 text-primary" />
            <span className="text-xl font-bold bg-gradient-primary bg-clip-text text-transparent">
              DiabeSure
            </span>
          </button>

          {/* Role Badge - Desktop */}
          <div className="hidden md:flex items-center">
            <Badge variant="outline" className="mr-4 bg-primary/10 text-primary border-primary/30">
              Patient Portal
            </Badge>
          </div>

          {/* Desktop Menu */}
          <div className="hidden lg:flex items-center space-x-1">
            {menuItems.slice(0, 7).map((item) => {
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
              variant={currentPage === 'messages' ? "default" : "ghost"}
              size="sm"
              onClick={() => onPageChange('messages')}
            >
              <MessageSquare className="h-4 w-4" />
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
              <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">
                Patient Portal
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
