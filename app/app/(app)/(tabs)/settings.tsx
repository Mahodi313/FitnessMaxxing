// app/app/(app)/(tabs)/settings.tsx
//
// Phase 4 Plan 02: Inställningar tab — sign-out home + placeholder per
// CONTEXT.md D-15/D-16. Phase 7 fills with dark-mode-toggle, ev. radera-konto.
//
// Sign-out logic copied verbatim from Phase 3 (app)/index.tsx (now deleted):
//   tap → useAuthStore.signOut() → queryClient.clear() →
//   supabase.auth.signOut() → onAuthStateChange listener flips status to
//   'anonymous' → root Stack.Protected re-evaluates → user lands in
//   (auth)/sign-in. NO imperative router.replace.
//
// NO confirmation dialog on sign-out per UI-SPEC §"No destructive
// confirmation for: Sign-out" (sign-out is non-destructive — reversible by
// signing back in).
//
// References:
//   - 04-CONTEXT.md D-15, D-16
//   - 04-UI-SPEC.md §Inställningar tab + §"No destructive confirmation for"
import { Text, View, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuthStore } from "@/lib/auth-store";

export default function SettingsTab() {
  const email = useAuthStore((s) => s.session?.user.email);
  const signOut = useAuthStore((s) => s.signOut);

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-gray-900">
      <View className="flex-1 px-4 pt-12 gap-6">
        <Text className="text-3xl font-semibold text-gray-900 dark:text-gray-50">
          Inställningar
        </Text>
        {email && (
          <Text className="text-base text-gray-500 dark:text-gray-400">
            {email}
          </Text>
        )}
        <Text className="text-base text-gray-500 dark:text-gray-400">
          Mer kommer i Phase 7.
        </Text>
        <View className="flex-1" />
        <Pressable
          onPress={signOut}
          accessibilityRole="button"
          accessibilityLabel="Logga ut"
          className="w-full rounded-lg bg-blue-600 dark:bg-blue-500 py-4 items-center justify-center active:opacity-80"
        >
          <Text className="text-base font-semibold text-white">Logga ut</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
