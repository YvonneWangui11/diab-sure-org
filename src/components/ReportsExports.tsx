import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Download, FileText, Users, Activity, Calendar } from "lucide-react";
import { format } from "date-fns";

type ReportType = "users" | "appointments" | "medications" | "audit_logs" | "exercise_logs" | "meal_logs";

export const ReportsExports = () => {
  const [selectedReport, setSelectedReport] = useState<ReportType>("users");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

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

  const generateReport = async () => {
    try {
      setLoading(true);
      let data;
      let error;

      switch (selectedReport) {
        case "users":
          const usersResult = await supabase
            .from("profiles")
            .select(`
              user_id,
              full_name,
              email,
              phone,
              date_of_birth,
              created_at
            `);
          data = usersResult.data;
          error = usersResult.error;
          break;

        case "appointments":
          const appointmentsResult = await supabase
            .from("appointments")
            .select(`
              id,
              start_time,
              end_time,
              status,
              notes,
              created_at
            `);
          data = appointmentsResult.data;
          error = appointmentsResult.error;
          break;

        case "medications":
          const medicationsResult = await supabase
            .from("medications")
            .select(`
              id,
              medication_name,
              dosage,
              frequency,
              start_date,
              end_date,
              is_active,
              created_at
            `);
          data = medicationsResult.data;
          error = medicationsResult.error;
          break;

        case "audit_logs":
          const auditResult = await supabase
            .from("audit_logs")
            .select("*")
            .order("created_at", { ascending: false })
            .limit(1000);
          data = auditResult.data;
          error = auditResult.error;
          break;

        case "exercise_logs":
          const exerciseResult = await supabase
            .from("exercise_logs")
            .select(`
              id,
              exercise_type,
              duration_minutes,
              intensity,
              date_time,
              note,
              created_at
            `)
            .order("date_time", { ascending: false })
            .limit(1000);
          data = exerciseResult.data;
          error = exerciseResult.error;
          break;

        case "meal_logs":
          const mealResult = await supabase
            .from("meal_logs")
            .select(`
              id,
              meal_type,
              description,
              portion_size,
              date_time,
              note,
              created_at
            `)
            .order("date_time", { ascending: false })
            .limit(1000);
          data = mealResult.data;
          error = mealResult.error;
          break;
      }

      if (error) throw error;

      exportToCSV(data || [], selectedReport);

      toast({
        title: "Success",
        description: "Report exported successfully",
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const reportOptions = [
    { value: "users", label: "Users Report", icon: Users, description: "Export all user profiles" },
    { value: "appointments", label: "Appointments Report", icon: Calendar, description: "Export appointment records" },
    { value: "medications", label: "Medications Report", icon: Activity, description: "Export medication data" },
    { value: "exercise_logs", label: "Exercise Logs Report", icon: Activity, description: "Export exercise tracking data" },
    { value: "meal_logs", label: "Meal Logs Report", icon: Activity, description: "Export nutrition tracking data" },
    { value: "audit_logs", label: "Audit Logs Report", icon: FileText, description: "Export system audit logs (last 1000)" },
  ];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Reports & Exports
          </CardTitle>
          <CardDescription>
            Generate and download system reports in CSV format
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {reportOptions.map((option) => {
                const Icon = option.icon;
                return (
                  <Card
                    key={option.value}
                    className={`cursor-pointer transition-all hover:shadow-md ${
                      selectedReport === option.value ? "border-primary ring-2 ring-primary/20" : ""
                    }`}
                    onClick={() => setSelectedReport(option.value as ReportType)}
                  >
                    <CardContent className="p-4 space-y-2">
                      <div className="flex items-center gap-2">
                        <Icon className="h-5 w-5 text-primary" />
                        <h3 className="font-semibold">{option.label}</h3>
                      </div>
                      <p className="text-sm text-muted-foreground">{option.description}</p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>

          <div className="flex justify-end">
            <Button
              onClick={generateReport}
              disabled={loading}
              className="w-full sm:w-auto"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Generating...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 mr-2" />
                  Export Report
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};