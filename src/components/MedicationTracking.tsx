import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { 
  Pill, 
  Plus, 
  Clock, 
  AlertTriangle, 
  CheckCircle,
  Calendar,
  Bell,
  Package
} from "lucide-react";

export const MedicationTracking = () => {
  const [isAddingMedication, setIsAddingMedication] = useState(false);

  const medications = [
    {
      id: 1,
      name: "Metformin",
      dosage: "500mg",
      frequency: "Twice daily",
      times: ["8:00 AM", "8:00 PM"],
      remaining: 28,
      total: 30,
      nextDose: "8:00 PM",
      taken: [true, false], // today's doses
      adherence: 92
    },
    {
      id: 2,
      name: "Glipizide",
      dosage: "5mg",
      frequency: "Once daily",
      times: ["8:00 AM"],
      remaining: 15,
      total: 30,
      nextDose: "Tomorrow 8:00 AM",
      taken: [true], // today's doses
      adherence: 88
    },
    {
      id: 3,
      name: "Insulin Glargine",
      dosage: "20 units",
      frequency: "Once daily",
      times: ["10:00 PM"],
      remaining: 8,
      total: 10,
      nextDose: "10:00 PM",
      taken: [false], // today's doses
      adherence: 95
    }
  ];

  const upcomingDoses = [
    { medication: "Metformin", time: "8:00 PM", dosage: "500mg", in: "2 hours" },
    { medication: "Insulin Glargine", time: "10:00 PM", dosage: "20 units", in: "4 hours" },
    { medication: "Metformin", time: "8:00 AM", dosage: "500mg", in: "Tomorrow" },
  ];

  const getStockStatus = (remaining: number, total: number) => {
    const percentage = (remaining / total) * 100;
    if (percentage <= 20) return { status: "critical", color: "destructive" };
    if (percentage <= 40) return { status: "low", color: "warning" };
    return { status: "good", color: "success" };
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Medication Tracking</h1>
          <p className="text-muted-foreground">Manage your medications and track adherence</p>
        </div>
        <Button onClick={() => setIsAddingMedication(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Medication
        </Button>
      </div>

      {/* Quick Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-gradient-card shadow-card">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Today's Adherence</p>
                <p className="text-2xl font-bold text-foreground">67%</p>
                <p className="text-xs text-warning">2 of 3 medications taken</p>
              </div>
              <CheckCircle className="h-8 w-8 text-primary" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-card shadow-card">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Next Dose</p>
                <p className="text-2xl font-bold text-foreground">2h</p>
                <p className="text-xs text-muted-foreground">Metformin 500mg</p>
              </div>
              <Clock className="h-8 w-8 text-secondary" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-card shadow-card">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Low Stock Alert</p>
                <p className="text-2xl font-bold text-foreground">1</p>
                <p className="text-xs text-destructive">Insulin needs refill</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-warning" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Current Medications */}
        <Card className="lg:col-span-2 shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Pill className="h-5 w-5 text-primary" />
              Current Medications
            </CardTitle>
            <CardDescription>Track your daily medications and adherence</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {medications.map((med) => {
              const stockStatus = getStockStatus(med.remaining, med.total);
              return (
                <div key={med.id} className="p-4 border border-border rounded-lg bg-muted/50">
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-semibold text-foreground">{med.name}</h3>
                        <Badge variant="outline">{med.dosage}</Badge>
                        <Badge className={`bg-${stockStatus.color} text-${stockStatus.color}-foreground`}>
                          {med.remaining} left
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">{med.frequency}</p>
                      
                      {/* Daily doses */}
                      <div className="flex flex-wrap gap-2 mb-3">
                        {med.times.map((time, index) => (
                          <div key={index} className="flex items-center gap-2">
                            <div className={`w-3 h-3 rounded-full ${
                              med.taken[index] ? 'bg-success' : 'bg-muted'
                            }`} />
                            <span className="text-sm">{time}</span>
                            {!med.taken[index] && (
                              <Button size="sm" variant="outline" className="ml-2">
                                Mark Taken
                              </Button>
                            )}
                          </div>
                        ))}
                      </div>

                      {/* Adherence */}
                      <div className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span>Weekly Adherence</span>
                          <span>{med.adherence}%</span>
                        </div>
                        <Progress value={med.adherence} className="h-2" />
                      </div>
                    </div>
                    
                    <div className="flex flex-col gap-2">
                      <Button size="sm" variant="outline">
                        <Bell className="h-4 w-4 mr-2" />
                        Set Reminder
                      </Button>
                      <Button size="sm" variant="outline">
                        <Package className="h-4 w-4 mr-2" />
                        Refill
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Upcoming Doses & Reminders */}
        <div className="space-y-6">
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-primary" />
                Upcoming Doses
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {upcomingDoses.map((dose, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-primary/10 rounded-lg border border-primary/20">
                  <div>
                    <p className="font-medium text-foreground">{dose.medication}</p>
                    <p className="text-sm text-muted-foreground">{dose.dosage} at {dose.time}</p>
                  </div>
                  <Badge variant="outline">{dose.in}</Badge>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Reminder Settings */}
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle>Reminder Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="email-reminders">Email Reminders</Label>
                <Switch id="email-reminders" defaultChecked />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="refill-alerts">Refill Alerts</Label>
                <Switch id="refill-alerts" defaultChecked />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="adherence-reports">Weekly Reports</Label>
                <Switch id="adherence-reports" defaultChecked />
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button className="w-full" variant="default">
                <CheckCircle className="h-4 w-4 mr-2" />
                Mark All Taken
              </Button>
              <Button className="w-full" variant="secondary">
                <Calendar className="h-4 w-4 mr-2" />
                Schedule Refills
              </Button>
              <Button className="w-full" variant="outline">
                <Bell className="h-4 w-4 mr-2" />
                Set Custom Alert
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};