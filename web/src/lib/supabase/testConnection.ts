import { supabase } from "./client";

export interface ConnectionTestResult {
  success: boolean;
  message: string;
}

export async function testConnection(): Promise<ConnectionTestResult> {
  const { error } = await supabase.from("exams").select("id").limit(1);

  if (error) {
    // "does not exist" still proves the connection works
    if (error.code === "42P01") {
      return {
        success: true,
        message: "Connected (exams table not created yet)",
      };
    }

    return {
      success: false,
      message: `Connection error: ${error.message} (code: ${error.code})`,
    };
  }

  return { success: true, message: "Connected to Supabase" };
}
