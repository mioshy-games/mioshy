import { GameForm } from "@/components/dashboard/GameForm";
import { getDefaultGameFormValues } from "@/lib/game-form-defaults";

export default function NewGamePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">New game</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Create a game, wheel, and save before adding questions.
        </p>
      </div>
      <GameForm
        gameId={null}
        defaultValues={getDefaultGameFormValues()}
        initialQuestions={[]}
      />
    </div>
  );
}
