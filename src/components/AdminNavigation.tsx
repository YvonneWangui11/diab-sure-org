import { useState } from "react";
import { Menu, X, Heart, Users, Shield, Settings, MessageSquare, User, LogOut, Activity, FileText, BarChart3, Database } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface AdminNavigationProps {
  currentPage: string;
  onPageChange: (page: string) => void;
  onSignOut?: () => void;
}

export const AdminNavigation = ({ currentPage, onPageChange, onSignOut }: AdminNavigationProps) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const menuItems = [
    { id: "dashboard", label: "Admin Overview", icon: Activity },
    { id: "users", label: "User Management", icon: Users },
    { id: "roles", label: "Roles & Access", icon: Shield },
    { id: "announcements", label: "Announcements", icon: MessageSquare },
    { id: "data-retention", label: "Data Retention", icon: Database },
    { id: "audit-logs", label: "Audit Logs", icon: FileText },
    { id: "reports", label: "Reports", icon: BarChart3 },
    { id: "settings", label: "Settings", icon: Settings },
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
            <Shield className="h-8 w-8 text-destructive" />
            <span className="text-xl font-bold bg-gradient-primary bg-clip-text text-transparent">
              DiabeSure Admin
            </span>
          </button>

          {/* Role Badge - Desktop */}
          <div className="hidden md:flex items-center">
            <Badge variant="outline" className="mr-4 bg-destructive/10 text-destructive border-destructive/30">
              Admin Portal
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
              <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/30">
                Admin Portal
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
