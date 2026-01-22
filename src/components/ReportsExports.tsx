import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { 
  Download, FileText, Users, Activity, Calendar, 
  TrendingUp, TrendingDown, Minus, ChevronRight, BarChart3,
  User, Pill, Utensils, Dumbbell, FileDown
} from "lucide-react";
import { format, subDays, parseISO, startOfDay, endOfDay } from "date-fns";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, BarChart, Bar, Legend } from "recharts";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { LoadingSpinner } from "./LoadingSpinner";

interface PatientSummary {
  user_id: string;
  full_name: string;
  email: string;
  glucoseReadings: number;
  avgGlucose: number;
  glucoseTrend: 'up' | 'down' | 'stable';
  mealLogs: number;
  exerciseLogs: number;
  medicationAdherence: number;
  lastActivity: string | null;
}

interface GlucoseData {
  date: string;
  value: number;
  patientName: string;
}

export const ReportsExports = () => {
  const [loading, setLoading] = useState(true);
  const [patients, setPatients] = useState<PatientSummary[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<string>("all");
  const [dateRange, setDateRange] = useState<"7" | "14" | "30" | "90">("30");
  const [glucoseData, setGlucoseData] = useState<GlucoseData[]>([]);
  const [aggregateStats, setAggregateStats] = useState({
    totalReadings: 0,
    avgGlucose: 0,
    inRange: 0,
    highReadings: 0,
    lowReadings: 0,
    totalMeals: 0,
    totalExercise: 0,
  });
  const [exporting, setExporting] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadData();
  }, [dateRange, selectedPatient]);

  const loadData = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get assigned patients
      const { data: patientMappings } = await supabase
        .from('doctor_patients')
        .select('patient_id')
        .eq('doctor_id', user.id)
        .eq('status', 'active');

      if (!patientMappings || patientMappings.length === 0) {
        setPatients([]);
        setLoading(false);
        return;
      }

      const patientIds = patientMappings.map(p => p.patient_id);
      const startDate = subDays(new Date(), parseInt(dateRange));

      // Get patient profiles
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name, email')
        .in('user_id', patientIds);

      if (!profiles) {
        setLoading(false);
        return;
      }

      // Get glucose readings
      const glucoseQuery = supabase
        .from('glucose_readings')
        .select('*')
        .in('patient_id', selectedPatient === 'all' ? patientIds : [selectedPatient])
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: true });

      const { data: glucoseReadings } = await glucoseQuery;

      // Get meal logs
      const { data: mealLogs } = await supabase
        .from('meal_logs')
        .select('*')
        .in('patient_id', selectedPatient === 'all' ? patientIds : [selectedPatient])
        .gte('date_time', startDate.toISOString());

      // Get exercise logs
      const { data: exerciseLogs } = await supabase
        .from('exercise_logs')
        .select('*')
        .in('patient_id', selectedPatient === 'all' ? patientIds : [selectedPatient])
        .gte('date_time', startDate.toISOString());

      // Get medication intake
      const { data: medicationIntake } = await supabase
        .from('medication_intake')
        .select('*')
        .in('patient_id', selectedPatient === 'all' ? patientIds : [selectedPatient])
        .gte('scheduled_time', startDate.toISOString());

      // Process patient summaries
      const profileMap = new Map(profiles.map(p => [p.user_id, p]));
      const patientSummaries: PatientSummary[] = [];

      for (const patientId of patientIds) {
        const profile = profileMap.get(patientId);
        if (!profile) continue;

        const patientGlucose = glucoseReadings?.filter(g => g.patient_id === patientId) || [];
        const patientMeals = mealLogs?.filter(m => m.patient_id === patientId) || [];
        const patientExercise = exerciseLogs?.filter(e => e.patient_id === patientId) || [];
        const patientMeds = medicationIntake?.filter(m => m.patient_id === patientId) || [];

        const avgGlucose = patientGlucose.length > 0 
          ? patientGlucose.reduce((sum, g) => sum + g.glucose_value, 0) / patientGlucose.length 
          : 0;

        // Calculate trend (compare first half to second half)
        let trend: 'up' | 'down' | 'stable' = 'stable';
        if (patientGlucose.length >= 4) {
          const midpoint = Math.floor(patientGlucose.length / 2);
          const firstHalf = patientGlucose.slice(0, midpoint);
          const secondHalf = patientGlucose.slice(midpoint);
          const firstAvg = firstHalf.reduce((sum, g) => sum + g.glucose_value, 0) / firstHalf.length;
          const secondAvg = secondHalf.reduce((sum, g) => sum + g.glucose_value, 0) / secondHalf.length;
          if (secondAvg > firstAvg + 10) trend = 'up';
          else if (secondAvg < firstAvg - 10) trend = 'down';
        }

        // Calculate medication adherence
        const takenMeds = patientMeds.filter(m => m.status === 'taken').length;
        const adherence = patientMeds.length > 0 ? (takenMeds / patientMeds.length) * 100 : 0;

        // Get last activity
        const activities = [
          ...(patientGlucose.map(g => g.created_at)),
          ...(patientMeals.map(m => m.date_time)),
          ...(patientExercise.map(e => e.date_time)),
        ].sort().reverse();

        patientSummaries.push({
          user_id: patientId,
          full_name: profile.full_name,
          email: profile.email,
          glucoseReadings: patientGlucose.length,
          avgGlucose: Math.round(avgGlucose),
          glucoseTrend: trend,
          mealLogs: patientMeals.length,
          exerciseLogs: patientExercise.length,
          medicationAdherence: Math.round(adherence),
          lastActivity: activities[0] || null,
        });
      }

      setPatients(patientSummaries);

      // Process glucose chart data
      const chartData: GlucoseData[] = (glucoseReadings || []).map(g => ({
        date: format(parseISO(g.created_at), 'MMM d'),
        value: g.glucose_value,
        patientName: profileMap.get(g.patient_id)?.full_name || 'Unknown',
      }));
      setGlucoseData(chartData);

      // Calculate aggregate stats
      const allGlucose = glucoseReadings || [];
      const inRangeCount = allGlucose.filter(g => g.glucose_value >= 70 && g.glucose_value <= 180).length;
      const highCount = allGlucose.filter(g => g.glucose_value > 180).length;
      const lowCount = allGlucose.filter(g => g.glucose_value < 70).length;

      setAggregateStats({
        totalReadings: allGlucose.length,
        avgGlucose: allGlucose.length > 0 
          ? Math.round(allGlucose.reduce((sum, g) => sum + g.glucose_value, 0) / allGlucose.length)
          : 0,
        inRange: allGlucose.length > 0 ? Math.round((inRangeCount / allGlucose.length) * 100) : 0,
        highReadings: highCount,
        lowReadings: lowCount,
        totalMeals: mealLogs?.length || 0,
        totalExercise: exerciseLogs?.length || 0,
      });

    } catch (error) {
      console.error('Error loading report data:', error);
      toast({
        title: "Error",
        description: "Failed to load report data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const exportToCSV = (data: any[], filename: string) => {
    if (!data || data.length === 0) {
      toast({
        variant: "destructive",
        title: "No data",
        description: "No data available to export",
      });
      return;
    }

    const headers = Object.keys(data[0]);
    const csvContent = [
      headers.join(","),
      ...data.map(row =>
        headers.map(header => {
          const value = row[header];
          if (value === null || value === undefined) return "";
          if (typeof value === "object") return JSON.stringify(value);
          return `"${value.toString().replace(/"/g, '""')}"`;
        }).join(",")
      )
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `${filename}_${format(new Date(), "yyyy-MM-dd")}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const generatePDFReport = async () => {
    try {
      setExporting(true);

      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      
      // Header
      doc.setFontSize(20);
      doc.setTextColor(33, 33, 33);
      doc.text("Patient Progress Report", pageWidth / 2, 20, { align: "center" });
      
      doc.setFontSize(12);
      doc.setTextColor(100, 100, 100);
      doc.text(`Generated: ${format(new Date(), "MMMM d, yyyy 'at' h:mm a")}`, pageWidth / 2, 28, { align: "center" });
      doc.text(`Date Range: Last ${dateRange} days`, pageWidth / 2, 34, { align: "center" });

      // Summary Statistics
      doc.setFontSize(14);
      doc.setTextColor(33, 33, 33);
      doc.text("Summary Statistics", 14, 48);
      
      const statsData = [
        ["Total Glucose Readings", aggregateStats.totalReadings.toString()],
        ["Average Glucose", `${aggregateStats.avgGlucose} mg/dL`],
        ["In Range (70-180)", `${aggregateStats.inRange}%`],
        ["High Readings (>180)", aggregateStats.highReadings.toString()],
        ["Low Readings (<70)", aggregateStats.lowReadings.toString()],
        ["Total Meals Logged", aggregateStats.totalMeals.toString()],
        ["Total Exercise Sessions", aggregateStats.totalExercise.toString()],
      ];

      autoTable(doc, {
        startY: 52,
        head: [["Metric", "Value"]],
        body: statsData,
        theme: "striped",
        headStyles: { fillColor: [79, 70, 229] },
        margin: { left: 14, right: 14 },
      });

      // Patient Summaries
      const finalY = (doc as any).lastAutoTable.finalY || 100;
      doc.setFontSize(14);
      doc.text("Patient Summaries", 14, finalY + 15);

      const patientData = patients.map(p => [
        p.full_name,
        p.glucoseReadings.toString(),
        `${p.avgGlucose} mg/dL`,
        p.glucoseTrend === 'up' ? '↑ Rising' : p.glucoseTrend === 'down' ? '↓ Falling' : '→ Stable',
        `${p.medicationAdherence}%`,
        p.mealLogs.toString(),
        p.exerciseLogs.toString(),
      ]);

      autoTable(doc, {
        startY: finalY + 20,
        head: [["Patient", "Readings", "Avg Glucose", "Trend", "Med Adherence", "Meals", "Exercise"]],
        body: patientData,
        theme: "striped",
        headStyles: { fillColor: [79, 70, 229] },
        margin: { left: 14, right: 14 },
        styles: { fontSize: 9 },
      });

      // Footer
      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(10);
        doc.setTextColor(150, 150, 150);
        doc.text(
          `Page ${i} of ${pageCount} | DiabeSure Clinician Report`,
          pageWidth / 2,
          doc.internal.pageSize.getHeight() - 10,
          { align: "center" }
        );
      }

      doc.save(`patient_progress_report_${format(new Date(), "yyyy-MM-dd")}.pdf`);

      toast({
        title: "Success",
        description: "PDF report generated successfully",
      });
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast({
        title: "Error",
        description: "Failed to generate PDF report",
        variant: "destructive",
      });
    } finally {
      setExporting(false);
    }
  };

  const exportPatientSummaries = () => {
    const data = patients.map(p => ({
      "Patient Name": p.full_name,
      "Email": p.email,
      "Glucose Readings": p.glucoseReadings,
      "Average Glucose (mg/dL)": p.avgGlucose,
      "Glucose Trend": p.glucoseTrend,
      "Meal Logs": p.mealLogs,
      "Exercise Logs": p.exerciseLogs,
      "Medication Adherence (%)": p.medicationAdherence,
      "Last Activity": p.lastActivity ? format(parseISO(p.lastActivity), "MMM d, yyyy h:mm a") : "N/A",
    }));
    exportToCSV(data, "patient_summaries");
  };

  const getTrendIcon = (trend: 'up' | 'down' | 'stable') => {
    switch (trend) {
      case 'up': return <TrendingUp className="h-4 w-4 text-orange-500" />;
      case 'down': return <TrendingDown className="h-4 w-4 text-green-500" />;
      default: return <Minus className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getAdherenceColor = (adherence: number) => {
    if (adherence >= 80) return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300";
    if (adherence >= 50) return "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300";
    return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300";
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <LoadingSpinner size="lg" text="Loading reports..." />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header & Filters */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <BarChart3 className="h-6 w-6" />
            Reports & Analytics
          </h2>
          <p className="text-muted-foreground">Patient progress summaries and health trends</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Select value={selectedPatient} onValueChange={setSelectedPatient}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Select patient" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Patients</SelectItem>
              {patients.map(p => (
                <SelectItem key={p.user_id} value={p.user_id}>{p.full_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={dateRange} onValueChange={(v: "7" | "14" | "30" | "90") => setDateRange(v)}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Date range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="14">Last 14 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Glucose Readings</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{aggregateStats.totalReadings}</div>
            <p className="text-xs text-muted-foreground">Avg: {aggregateStats.avgGlucose} mg/dL</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">In Range</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{aggregateStats.inRange}%</div>
            <p className="text-xs text-muted-foreground">70-180 mg/dL target</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Meals Logged</CardTitle>
            <Utensils className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{aggregateStats.totalMeals}</div>
            <p className="text-xs text-muted-foreground">Nutrition entries</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Exercise Sessions</CardTitle>
            <Dumbbell className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{aggregateStats.totalExercise}</div>
            <p className="text-xs text-muted-foreground">Activity logs</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="glucose">Glucose Trends</TabsTrigger>
          <TabsTrigger value="patients">Patient Details</TabsTrigger>
          <TabsTrigger value="export">Export Data</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          {/* Glucose Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Glucose Trends</CardTitle>
              <CardDescription>Blood glucose readings over time</CardDescription>
            </CardHeader>
            <CardContent>
              {glucoseData.length === 0 ? (
                <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                  <div className="text-center">
                    <Activity className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>No glucose data available for this period</p>
                  </div>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={glucoseData}>
                    <defs>
                      <linearGradient id="glucoseGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="date" className="text-xs" />
                    <YAxis domain={[50, 300]} className="text-xs" />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--background))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }}
                      formatter={(value: number) => [`${value} mg/dL`, 'Glucose']}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="value" 
                      stroke="hsl(var(--primary))" 
                      fill="url(#glucoseGradient)"
                      strokeWidth={2}
                    />
                    {/* Target range reference lines */}
                    <Line type="monotone" dataKey={() => 70} stroke="#22c55e" strokeDasharray="5 5" dot={false} />
                    <Line type="monotone" dataKey={() => 180} stroke="#f97316" strokeDasharray="5 5" dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Patient Summary Grid */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Patient Summaries</CardTitle>
                <CardDescription>Quick overview of all patient metrics</CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={exportPatientSummaries}>
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
            </CardHeader>
            <CardContent>
              {patients.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No patients assigned yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {patients.map(patient => (
                    <div 
                      key={patient.user_id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors gap-3"
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <User className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium">{patient.full_name}</p>
                          <p className="text-sm text-muted-foreground">
                            Last active: {patient.lastActivity 
                              ? format(parseISO(patient.lastActivity), "MMM d, h:mm a") 
                              : "No activity"}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 sm:gap-4">
                        <div className="flex items-center gap-1.5">
                          <Activity className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">{patient.avgGlucose} mg/dL</span>
                          {getTrendIcon(patient.glucoseTrend)}
                        </div>
                        <Badge className={getAdherenceColor(patient.medicationAdherence)}>
                          <Pill className="h-3 w-3 mr-1" />
                          {patient.medicationAdherence}%
                        </Badge>
                        <Badge variant="secondary">
                          <Utensils className="h-3 w-3 mr-1" />
                          {patient.mealLogs}
                        </Badge>
                        <Badge variant="secondary">
                          <Dumbbell className="h-3 w-3 mr-1" />
                          {patient.exerciseLogs}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="glucose" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Detailed Glucose Analysis</CardTitle>
              <CardDescription>Comprehensive blood glucose tracking and patterns</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Range Distribution */}
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="p-4 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
                  <div className="text-sm font-medium text-green-700 dark:text-green-300">In Range</div>
                  <div className="text-2xl font-bold text-green-600 dark:text-green-400">{aggregateStats.inRange}%</div>
                  <div className="text-xs text-green-600/80 dark:text-green-400/80">70-180 mg/dL</div>
                </div>
                <div className="p-4 rounded-lg bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800">
                  <div className="text-sm font-medium text-orange-700 dark:text-orange-300">High</div>
                  <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">{aggregateStats.highReadings}</div>
                  <div className="text-xs text-orange-600/80 dark:text-orange-400/80">&gt;180 mg/dL</div>
                </div>
                <div className="p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                  <div className="text-sm font-medium text-red-700 dark:text-red-300">Low</div>
                  <div className="text-2xl font-bold text-red-600 dark:text-red-400">{aggregateStats.lowReadings}</div>
                  <div className="text-xs text-red-600/80 dark:text-red-400/80">&lt;70 mg/dL</div>
                </div>
              </div>

              {/* Line Chart */}
              {glucoseData.length > 0 && (
                <ResponsiveContainer width="100%" height={400}>
                  <LineChart data={glucoseData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="date" className="text-xs" />
                    <YAxis domain={[50, 300]} className="text-xs" />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--background))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }}
                      formatter={(value: number, name: string, props: any) => [
                        `${value} mg/dL`,
                        props.payload.patientName
                      ]}
                    />
                    <Legend />
                    <Line 
                      type="monotone" 
                      dataKey="value" 
                      stroke="hsl(var(--primary))" 
                      strokeWidth={2}
                      dot={{ fill: 'hsl(var(--primary))', strokeWidth: 2 }}
                      name="Glucose Level"
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="patients" className="space-y-4">
          {patients.map(patient => (
            <Card key={patient.user_id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                      <User className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <CardTitle>{patient.full_name}</CardTitle>
                      <CardDescription>{patient.email}</CardDescription>
                    </div>
                  </div>
                  <Badge className={getAdherenceColor(patient.medicationAdherence)}>
                    Med Adherence: {patient.medicationAdherence}%
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="p-3 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                      <Activity className="h-4 w-4" />
                      Glucose Readings
                    </div>
                    <div className="text-xl font-bold">{patient.glucoseReadings}</div>
                    <div className="flex items-center gap-1 text-sm">
                      Avg: {patient.avgGlucose} mg/dL
                      {getTrendIcon(patient.glucoseTrend)}
                    </div>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                      <Utensils className="h-4 w-4" />
                      Meal Logs
                    </div>
                    <div className="text-xl font-bold">{patient.mealLogs}</div>
                    <div className="text-sm text-muted-foreground">Nutrition entries</div>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                      <Dumbbell className="h-4 w-4" />
                      Exercise Sessions
                    </div>
                    <div className="text-xl font-bold">{patient.exerciseLogs}</div>
                    <div className="text-sm text-muted-foreground">Activity logs</div>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                      <Calendar className="h-4 w-4" />
                      Last Activity
                    </div>
                    <div className="text-lg font-medium">
                      {patient.lastActivity 
                        ? format(parseISO(patient.lastActivity), "MMM d")
                        : "N/A"}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {patient.lastActivity 
                        ? format(parseISO(patient.lastActivity), "h:mm a")
                        : "No activity"}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="export" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileDown className="h-5 w-5" />
                Export Reports
              </CardTitle>
              <CardDescription>
                Download patient data and progress reports
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={generatePDFReport}>
                  <CardContent className="p-4 flex items-start gap-3">
                    <div className="h-10 w-10 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                      <FileText className="h-5 w-5 text-red-600 dark:text-red-400" />
                    </div>
                    <div>
                      <h3 className="font-semibold">PDF Report</h3>
                      <p className="text-sm text-muted-foreground">Complete patient progress summary</p>
                    </div>
                  </CardContent>
                </Card>

                <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={exportPatientSummaries}>
                  <CardContent className="p-4 flex items-start gap-3">
                    <div className="h-10 w-10 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                      <Users className="h-5 w-5 text-green-600 dark:text-green-400" />
                    </div>
                    <div>
                      <h3 className="font-semibold">Patient Summaries</h3>
                      <p className="text-sm text-muted-foreground">CSV with all patient metrics</p>
                    </div>
                  </CardContent>
                </Card>

                <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => exportToCSV(glucoseData, 'glucose_data')}>
                  <CardContent className="p-4 flex items-start gap-3">
                    <div className="h-10 w-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                      <Activity className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <h3 className="font-semibold">Glucose Data</h3>
                      <p className="text-sm text-muted-foreground">Raw glucose readings CSV</p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="pt-4 border-t">
                <Button 
                  onClick={generatePDFReport} 
                  disabled={exporting}
                  className="w-full sm:w-auto"
                  size="lg"
                >
                  {exporting ? (
                    <>
                      <LoadingSpinner size="sm" className="mr-2" />
                      Generating PDF...
                    </>
                  ) : (
                    <>
                      <Download className="h-4 w-4 mr-2" />
                      Generate Full PDF Report
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};
