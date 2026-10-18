import { MantineProvider } from "@mantine/core";
import { render } from "@testing-library/react";
import type { ReactElement } from "react";

export const renderWithMantine = (ui: ReactElement) =>
  render(<MantineProvider env="test">{ui}</MantineProvider>);
