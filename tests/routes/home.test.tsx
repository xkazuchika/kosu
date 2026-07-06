import { render, screen } from "@testing-library/react";

import { LandingPage } from "../../app/components/landing-page";

test("renders the kosu landing message", () => {
  render(<LandingPage />);

  expect(screen.getByRole("heading", { name: "軽量なセルフホスト工数管理" })).toBeInTheDocument();
  expect(screen.getByText(/小規模チーム/)).toBeInTheDocument();
});
