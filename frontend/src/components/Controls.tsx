import { ActionIcon, Button, Group, Slider, Stack, Text } from "@mantine/core";
import { MAX_SHIFT } from "../types";

interface Props {
  shift: number;
  volume: number;
  busy: boolean;
  canReset: boolean;
  onShift: (s: number) => void;
  onVolume: (v: number) => void;
  onReset: () => void;
}

export default function Controls({ shift, volume, busy, canReset, onShift, onVolume, onReset }: Props) {
  return (
    <Stack gap="md">
      <Group justify="space-between" align="center">
        <Text size="sm" fw={600}>
          Pitch
        </Text>
        <Group gap="xs">
          <ActionIcon
            variant="light"
            aria-label="Semitone down"
            data-testid="shift-down"
            disabled={busy || shift <= -MAX_SHIFT}
            onClick={() => onShift(shift - 1)}
          >
            −
          </ActionIcon>
          <Text w={80} ta="center" ff="monospace" data-testid="shift-value">
            {shift > 0 ? `+${shift}` : shift} st
          </Text>
          <ActionIcon
            variant="light"
            aria-label="Semitone up"
            data-testid="shift-up"
            disabled={busy || shift >= MAX_SHIFT}
            onClick={() => onShift(shift + 1)}
          >
            +
          </ActionIcon>
        </Group>
      </Group>

      <Group justify="space-between" align="center" wrap="nowrap">
        <Text size="sm" fw={600}>
          Volume
        </Text>
        <Slider
          flex={1}
          ml="md"
          value={volume}
          onChange={onVolume}
          min={0}
          max={100}
          label={(v) => `${v}%`}
          aria-label="Volume"
          data-testid="volume"
        />
      </Group>

      <Button variant="default" onClick={onReset} disabled={!canReset} data-testid="reset">
        Reset
      </Button>
    </Stack>
  );
}
