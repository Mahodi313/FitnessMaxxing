// app/app/(app)/index.tsx
//
// Phase 3 post-login placeholder. Temporary surface — Phase 4 replaces with
// real plans/exercises home (per CONTEXT.md D-17: "Sign-out-knapp synlig
// i (app)-gruppen tills Phase 4 bygger riktig settings-yta. Knappen är inte
// snyggt placerad — den är funktionell.").
//
// Selectors (CONTEXT.md D-10): separate narrow selectors for email and signOut
// so this screen only re-renders when those slices change.
//
// Sign-out flow (CONTEXT.md D-16):
//   tap → useAuthStore.signOut() → queryClient.clear() → supabase.auth.signOut()
//        → onAuthStateChange listener flips status to 'anonymous'
//        → root Stack.Protected re-evaluates → user lands in (auth)/sign-in
//        → NO imperative router.replace
//
// UI-SPEC.md Color §60/30/10 + F15 dark-mode pairs verified.
import { Text, View, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuthStore } from "@/lib/auth-store";

export default function AppHome() {
  const email = useAuthStore((s) => s.session?.user.email);
  const signOut = useAuthStore((s) => s.signOut);

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-gray-900">
      <View className="flex-1 items-center justify-center gap-6 px-4">
        <Text className="text-3xl font-semibold text-gray-900 dark:text-gray-50">
          FitnessMaxxing
        </Text>
        <Text className="text-base text-gray-900 dark:text-gray-50">
          Inloggad som {email ?? "(okänt)"}
        </Text>
        <Text className="text-base text-gray-500 dark:text-gray-400">
          Plan-skapande kommer i nästa fas.
        </Text>
        <Pressable
          onPress={signOut}
          className="w-full rounded-lg bg-blue-600 dark:bg-blue-500 py-4 items-center justify-center active:opacity-80"
        >
          <Text className="text-base font-semibold text-white">Logga ut</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
