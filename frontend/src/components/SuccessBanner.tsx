import { Button, Group, Paper, Text, Title } from "@mantine/core";
import type { Match } from "../types";

interface Props {
  match: Match;
  onReplay: () => void;
  onReset: () => void; // closes the pop-up and clears the input
}

export default function SuccessBanner({ match, onReplay, onReset }: Props) {
  const pct = Math.round(match.confidence * 100);
  return (
    <Paper className="banner" p="lg" radius="md" data-testid="success-banner">
      <Text className="banner-kicker">♪ Melody recognized ♪</Text>
      <Title order={2} className="banner-title" data-testid="banner-title">
        {match.title}
      </Title>
      <Text className="banner-origin">{match.origin}</Text>
      <Text size="sm" mt="sm" data-testid="banner-confidence">
        {pct}% match
        {match.delta !== 0 && ` · played ${match.delta > 0 ? "+" : ""}${match.delta} st from the original`}
      </Text>
      <Group justify="center" mt="md" gap="sm">
        <Button size="xs" variant="outline" color="yellow" onClick={onReplay} data-testid="replay">
          Replay jingle
        </Button>
        <Button size="xs" color="yellow" onClick={onReset} data-testid="banner-reset">
          Reset
        </Button>
      </Group>
    </Paper>
  );
}
