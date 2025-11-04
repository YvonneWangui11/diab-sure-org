import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Utensils, Plus, Target, Apple, Clock } from "lucide-react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";

const NutritionScene = () => (
  <Canvas camera={{ position: [0, 0, 5] }}>
    <ambientLight intensity={0.5} />
    <pointLight position={[10, 10, 10]} />
    <OrbitControls enableZoom={false} autoRotate autoRotateSpeed={2} />
    <mesh position={[-2, 0, 0]}>
      <sphereGeometry args={[1, 32, 32]} />
      <meshStandardMaterial color="#ef4444" />
    </mesh>
    <mesh position={[2, 0, 0]}>
      <boxGeometry args={[1.5, 1.5, 1.5]} />
      <meshStandardMaterial color="#22c55e" />
    </mesh>
    <mesh position={[0, -2, 0]}>
      <sphereGeometry args={[0.8, 32, 32]} />
      <meshStandardMaterial color="#f59e0b" />
    </mesh>
  </Canvas>
);

interface MealLog {
  id: string;
  name: string;
  calories: number;
  carbs: number;
  protein: number;
  fat: number;
  time: string;
  type: 'breakfast' | 'lunch' | 'dinner' | 'snack';
}

const mealPlans = [
  {
    id: 1,
    name: "Low Carb Mediterranean",
    description: "Perfect for diabetes management with healthy fats and proteins",
    calories: 1800,
    carbs: 45,
    meals: [
      { name: "Greek Yogurt with Berries", type: "Breakfast", calories: 250 },
      { name: "Grilled Chicken Salad", type: "Lunch", calories: 400 },
      { name: "Baked Salmon with Vegetables", type: "Dinner", calories: 450 },
      { name: "Mixed Nuts", type: "Snack", calories: 200 }
    ]
  },
  {
    id: 2,
    name: "Balanced Diabetic Plan",
    description: "Carefully portioned meals to maintain stable blood sugar",
    calories: 2000,
    carbs: 50,
    meals: [
      { name: "Oatmeal with Almonds", type: "Breakfast", calories: 300 },
      { name: "Turkey Wrap with Vegetables", type: "Lunch", calories: 450 },
      { name: "Lean Beef with Sweet Potato", type: "Dinner", calories: 500 },
      { name: "Apple with Peanut Butter", type: "Snack", calories: 180 }
    ]
  }
];

interface NutritionTrackingProps {
  userId: string;
}

export const NutritionTracking = ({ userId }: NutritionTrackingProps) => {
  const [mealLogs, setMealLogs] = useState<MealLog[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const [newMeal, setNewMeal] = useState({
    name: "",
    calories: "",
    carbs: "",
    protein: "",
    fat: "",
    type: "breakfast" as const
  });
  const [selectedPhoto, setSelectedPhoto] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const dailyTargets = {
    calories: 2000,
    carbs: 250,
    protein: 150,
    fat: 65
  };

  const totalNutrition = mealLogs.reduce(
    (total, meal) => ({
      calories: total.calories + meal.calories,
      carbs: total.carbs + meal.carbs,
      protein: total.protein + meal.protein,
      fat: total.fat + meal.fat
    }),
    { calories: 0, carbs: 0, protein: 0, fat: 0 }
  );

  const loadMealLogs = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('meal_logs')
        .select('*')
        .eq('patient_id', userId)
        .gte('date_time', new Date(new Date().setHours(0, 0, 0, 0)).toISOString())
        .order('date_time', { ascending: false });

      if (error) throw error;

      const formattedMeals: MealLog[] = data?.map(log => ({
        id: log.id,
        name: log.description,
        calories: 0, // Calculate from description or add separate field
        carbs: 0,
        protein: 0,
        fat: 0,
        time: new Date(log.date_time).toLocaleTimeString(),
        type: (log.meal_type || 'snack') as any
      })) || [];

      setMealLogs(formattedMeals);
    } catch (error) {
      console.error('Error loading meals:', error);
      toast({
        title: "Error",
        description: "Failed to load meal logs",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const addMeal = async () => {
    if (!newMeal.name || !newMeal.calories) return;

    try {
      setUploading(true);
      let photoUrl = null;

      // Upload photo if selected
      if (selectedPhoto) {
        const fileExt = selectedPhoto.name.split('.').pop();
        const filePath = `${userId}/${Date.now()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('meal-photos')
          .upload(filePath, selectedPhoto);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('meal-photos')
          .getPublicUrl(filePath);

        photoUrl = publicUrl;
      }

      const { error } = await supabase
        .from('meal_logs')
        .insert({
          patient_id: userId,
          meal_type: newMeal.type,
          description: `${newMeal.name} - ${newMeal.calories}cal, C:${newMeal.carbs}g, P:${newMeal.protein}g, F:${newMeal.fat}g`,
          portion_size: newMeal.calories,
          photo_url: photoUrl,
        });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Meal logged successfully",
      });

      setNewMeal({
        name: "",
        calories: "",
        carbs: "",
        protein: "",
        fat: "",
        type: "breakfast"
      });
      setSelectedPhoto(null);

      loadMealLogs();
    } catch (error) {
      console.error('Error adding meal:', error);
      toast({
        title: "Error",
        description: "Failed to log meal",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  useEffect(() => {
    loadMealLogs();

    const subscription = supabase
      .channel('meal-logs-changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'meal_logs',
        filter: `patient_id=eq.${userId}`
      }, () => {
        loadMealLogs();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [userId]);

  return (
    <div className="space-y-6">
      {/* 3D Nutrition Visualization */}
      <Card className="h-64">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Utensils className="h-5 w-5 text-primary" />
            Nutrition Balance Visualization
          </CardTitle>
        </CardHeader>
        <CardContent className="h-32">
          <NutritionScene />
        </CardContent>
      </Card>

      <Tabs defaultValue="tracking" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="tracking">Daily Tracking</TabsTrigger>
          <TabsTrigger value="plans">Meal Plans</TabsTrigger>
          <TabsTrigger value="progress">Progress</TabsTrigger>
        </TabsList>

        <TabsContent value="tracking" className="space-y-6">
          {/* Daily Overview */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Calories</p>
                    <p className="text-2xl font-bold">{totalNutrition.calories}</p>
                    <p className="text-xs text-muted-foreground">of {dailyTargets.calories}</p>
                  </div>
                  <Target className="h-8 w-8 text-primary" />
                </div>
                <Progress value={(totalNutrition.calories / dailyTargets.calories) * 100} className="mt-2" />
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Carbs (g)</p>
                    <p className="text-2xl font-bold">{totalNutrition.carbs}</p>
                    <p className="text-xs text-muted-foreground">of {dailyTargets.carbs}</p>
                  </div>
                  <Apple className="h-8 w-8 text-orange-500" />
                </div>
                <Progress value={(totalNutrition.carbs / dailyTargets.carbs) * 100} className="mt-2" />
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Protein (g)</p>
                    <p className="text-2xl font-bold">{totalNutrition.protein}</p>
                    <p className="text-xs text-muted-foreground">of {dailyTargets.protein}</p>
                  </div>
                  <div className="h-8 w-8 bg-green-500 rounded-full" />
                </div>
                <Progress value={(totalNutrition.protein / dailyTargets.protein) * 100} className="mt-2" />
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Fat (g)</p>
                    <p className="text-2xl font-bold">{totalNutrition.fat}</p>
                    <p className="text-xs text-muted-foreground">of {dailyTargets.fat}</p>
                  </div>
                  <div className="h-8 w-8 bg-yellow-500 rounded-full" />
                </div>
                <Progress value={(totalNutrition.fat / dailyTargets.fat) * 100} className="mt-2" />
              </CardContent>
            </Card>
          </div>

          {/* Add Meal Form */}
          <Card>
            <CardHeader>
              <CardTitle>Log a Meal</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
                <div className="lg:col-span-2">
                  <Label htmlFor="meal-name">Meal Name</Label>
                  <Input
                    id="meal-name"
                    value={newMeal.name}
                    onChange={(e) => setNewMeal({ ...newMeal, name: e.target.value })}
                    placeholder="e.g., Grilled Chicken Salad"
                  />
                </div>
                <div>
                  <Label htmlFor="meal-type">Type</Label>
                  <select
                    id="meal-type"
                    value={newMeal.type}
                    onChange={(e) => setNewMeal({ ...newMeal, type: e.target.value as any })}
                    className="w-full h-10 px-3 rounded-md border border-input bg-background"
                  >
                    <option value="breakfast">Breakfast</option>
                    <option value="lunch">Lunch</option>
                    <option value="dinner">Dinner</option>
                    <option value="snack">Snack</option>
                  </select>
                </div>
                <div>
                  <Label htmlFor="calories">Calories</Label>
                  <Input
                    id="calories"
                    type="number"
                    value={newMeal.calories}
                    onChange={(e) => setNewMeal({ ...newMeal, calories: e.target.value })}
                    placeholder="300"
                  />
                </div>
                <div>
                  <Label htmlFor="carbs">Carbs (g)</Label>
                  <Input
                    id="carbs"
                    type="number"
                    value={newMeal.carbs}
                    onChange={(e) => setNewMeal({ ...newMeal, carbs: e.target.value })}
                    placeholder="30"
                  />
                </div>
                <div>
                  <Label htmlFor="protein">Protein (g)</Label>
                  <Input
                    id="protein"
                    type="number"
                    value={newMeal.protein}
                    onChange={(e) => setNewMeal({ ...newMeal, protein: e.target.value })}
                    placeholder="25"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="meal-photo">Meal Photo (Optional)</Label>
                <Input
                  id="meal-photo"
                  type="file"
                  accept="image/*"
                  onChange={(e) => setSelectedPhoto(e.target.files?.[0] || null)}
                  className="cursor-pointer"
                />
                {selectedPhoto && (
                  <p className="text-sm text-muted-foreground mt-1">
                    Selected: {selectedPhoto.name}
                  </p>
                )}
              </div>
              <Button onClick={addMeal} disabled={uploading} className="w-full md:w-auto">
                <Plus className="h-4 w-4 mr-2" />
                {uploading ? "Uploading..." : "Add Meal"}
              </Button>
            </CardContent>
          </Card>

          {/* Meal History */}
          <Card>
            <CardHeader>
              <CardTitle>Today's Meals</CardTitle>
            </CardHeader>
            <CardContent>
              {mealLogs.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No meals logged today</p>
              ) : (
                <div className="space-y-4">
                  {mealLogs.map((meal) => (
                    <div key={meal.id} className="flex items-center justify-between p-4 bg-accent rounded-lg">
                      <div className="flex items-center gap-4">
                        <Badge variant="outline">{meal.type}</Badge>
                        <div>
                          <h4 className="font-medium">{meal.name}</h4>
                          <p className="text-sm text-muted-foreground flex items-center gap-2">
                            <Clock className="h-3 w-3" />
                            {meal.time}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">{meal.calories} cal</p>
                        <p className="text-xs text-muted-foreground">
                          C:{meal.carbs}g | P:{meal.protein}g | F:{meal.fat}g
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="plans" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {mealPlans.map((plan) => (
              <Card key={plan.id}>
                <CardHeader>
                  <CardTitle>{plan.name}</CardTitle>
                  <p className="text-sm text-muted-foreground">{plan.description}</p>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex justify-between text-sm">
                      <span>Daily Calories: {plan.calories}</span>
                      <span>Carbs: {plan.carbs}%</span>
                    </div>
                    <div className="space-y-2">
                      {plan.meals.map((meal, index) => (
                        <div key={index} className="flex justify-between items-center">
                          <div>
                            <p className="font-medium">{meal.name}</p>
                            <Badge variant="outline" className="text-xs">{meal.type}</Badge>
                          </div>
                          <span className="text-sm">{meal.calories} cal</span>
                        </div>
                      ))}
                    </div>
                    <Button className="w-full">Select This Plan</Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="progress">
          <Card>
            <CardHeader>
              <CardTitle>Weekly Nutrition Progress</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-center text-muted-foreground py-8">
                Progress charts will be available once you start logging meals consistently
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};