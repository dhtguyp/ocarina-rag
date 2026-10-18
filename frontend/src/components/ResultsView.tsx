import { Badge, Group, Paper, Progress, Stack, Text } from "@mantine/core";
import type { Match } from "../types";

const pct = (x: number) => `${(x * 100).toFixed(0)}%`;

export default function ResultsView({ matches }: { matches: Match[] }) {
  return (
    <Stack gap="sm" data-testid="results">
      <Text size="sm" c="dimmed" ta="center">
        No confident match. Closest melodies:
      </Text>
      {matches.map((m) => (
        <Paper key={m.slug} p="sm" radius="md" withBorder data-testid={`result-${m.slug}`}>
          <Group justify="space-between" mb={4}>
            <div>
              <Text fw={600}>{m.title}</Text>
              <Text size="xs" c="dimmed">
                {m.origin}
              </Text>
            </div>
            <Text fw={700}>{pct(m.confidence)}</Text>
          </Group>
          <Progress value={m.confidence * 100} size="sm" mb={6} />
          <Group gap="xs">
            <Badge variant="light" color="teal">
              Interval {pct(m.interval_sim)}
            </Badge>
            <Badge variant="light" color="orange">
              Pitch penalty −{pct(m.pitch_penalty)}
              {m.delta !== 0 && ` (${m.delta > 0 ? "+" : ""}${m.delta} st)`}
            </Badge>
          </Group>
        </Paper>
      ))}
    </Stack>
  );
}
